// Sistema `needs` (spec 010 R-001 a R-003, R-006): porta `updateNeeds` del prototipo por tick, con las necesidades
// en "1 = satisfecha", las emociones, la resiliencia y la ficha de salud (031). Solo lee y devuelve parches.
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import { MINUTES_PER_DAY } from '../calendar.ts';
import type { NewEvent } from '../events.ts';
import { formatId } from '../ids.ts';
import type { Patch, System, SystemOutput, TickCtx, WorldView } from '../simulation/system.ts';
import { legacyTraits } from '../temperament/legacy.ts';
import { EMOTIONS } from './columns.ts';
import { needsParams } from './params.ts';

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const WORK = new Set<number>([ACTIVITY.work, ACTIVITY.study]);
// Sin posiciones aún (016): la compañía se aproxima por la actividad (en M2, bloque D, pasa a ocupación real).
const COMPANY = new Set<number>([ACTIVITY.work, ACTIVITY.study, ACTIVITY.socialize, ACTIVITY.leisure, ACTIVITY.care]);
const FUN = new Set<number>([ACTIVITY.leisure, ACTIVITY.socialize, ACTIVITY.exercise]);

// Fecha en que se leen los parámetros del perfil: el presente del mundo (no cambian con el tiempo en M2).
const dateOf = (view: WorldView) => view.config.epoch.slice(0, 10);

function step(view: WorldView, ctx: TickCtx): SystemOutput {
  const P = needsParams(view.config.profile!, dateOf(view));
  const R = P.rates;
  const S = P.stress;
  const M = P.mood;
  const dt = view.config.tickMinutes / 60;
  const f = view.components.f32;
  const i = view.components.i32;
  const u = view.components.u8;
  const events: NewEvent[] = [];
  // Un parche por columna con todas las filas (`setMany`): con miles de celdas por tick es la forma rápida.
  const columns = new Map<string, { type: 'f32' | 'i32'; rows: number[]; values: number[] }>();
  const set = (column: string, row: number, value: number, type: 'f32' | 'i32' = 'f32') => {
    let c = columns.get(column);
    if (!c) columns.set(column, (c = { type, rows: [], values: [] }));
    c.rows.push(row);
    c.values.push(type === 'f32' ? clamp(value) : value);
  };
  const emoDecay = Math.pow(0.5, dt / R.emotionHalfLife!);
  // Compañía (010 R-001, prototipo `updateNeeds`): despierto y con alguien más despierto en el mismo lugar. Con
  // posiciones (016, `loc.place`), por ocupación; sin ellas, aproximada por la actividad, como en el bloque B.
  const loc = i['loc.place'];
  const awakeAt = new Map<number, number>();
  if (loc)
    for (const row of ctx.citizens) {
      const a = u[ACTIVITY_COLUMN]![row]!;
      if (loc[row]! > 0 && a !== ACTIVITY.sleep && a !== ACTIVITY.sick) awakeAt.set(loc[row]!, (awakeAt.get(loc[row]!) ?? 0) + 1);
    }

  for (const row of ctx.citizens) {
    const act = u[ACTIVITY_COLUMN]![row]!;
    const sickNow = u['health.acute']![row]! > 0;
    const rest = act === ACTIVITY.sleep || act === ACTIVITY.sick;
    const stress = f['state.stress']![row]!;
    let energy = f['need.energy']![row]!;
    let hunger = f['need.hunger']![row]!;
    let social = f['need.social']![row]!;
    let hygiene = f['need.hygiene']![row]!;
    let fun = f['need.fun']![row]!;

    // R-001 (prototipo `updateNeeds`) y R-006: la ficha de salud acelera la caída de energía.
    if (rest) {
      energy += R.energyRest! * dt * (1 - R.restStress! * stress) * (act === ACTIVITY.sick ? R.sickRest! : 1);
      hunger -= R.hungerRest! * dt;
    } else {
      const work = WORK.has(act);
      energy -= (work ? R.energyWork! : R.energyAwake!) * dt * (1 + R.energyStress! * stress) * f['health.energyFactor']![row]!;
      hunger -= (work ? R.hungerWork! : R.hungerAwake!) * dt;
      hygiene -= R.hygieneAwake! * dt;
    }
    const traits = legacyTraits(view, row); // @deprecated: sustituido por funciones y carga aversiva en MF2 y MF6
    const extraversion = traits.extraversion;
    // 043 R-019.2: charlar con un visitante del laboratorio también es estar acompañado.
    const company = act === ACTIVITY.conversation || (loc ? (awakeAt.get(loc[row]!) ?? 0) > 1 : COMPANY.has(act));
    if (!rest && company) social += R.socialCompany! * dt;
    else social -= (rest ? R.socialRest! : R.socialAlone! * (0.5 + extraversion)) * dt;
    if (FUN.has(act)) fun += R.funLeisure! * dt;
    else if (!rest) fun -= R.funAwake! * dt;
    if (act === ACTIVITY.wash) hygiene = 1;
    if (act === ACTIVITY.eat) hunger += R.eatRate! * dt; // 010 R-001: comer sacia (prototipo: desayuno −0,4, comida −0,65)
    // El reposo de un enfermo cuenta como sueño: si no, cada día de enfermedad sumaría una noche entera de deuda.
    if (rest) set('state.sleptToday', row, i['state.sleptToday']![row]! + view.config.tickMinutes, 'i32');

    // R-002: el estrés tiende a un objetivo; los estresores se modulan por neuroticismo y resiliencia.
    const neuroticism = traits.neuroticism;
    const resilience = traits.resilience;
    const occ = view.citizens.get(formatId('CIT', row))?.occupation;
    const ageYears = (view.now - i['demo.birthMinute']![row]!) / (365.25 * MINUTES_PER_DAY);
    const money = i.money?.[row] ?? 0;
    let stressors = 0;
    if (ageYears >= 18) stressors += money < 0 ? S.negativeMoney! : money < S.lowMoneyThreshold! ? S.lowMoney! : 0;
    if (occ?.kind === 'none' && occ.reason === 'unemployed') stressors += S.unemployed!;
    if (hunger < 0.2) stressors += S.hungry!;
    if (energy < 0.15) stressors += S.exhausted!;
    if (sickNow) stressors += S.sick!;
    if ((view.components.u8['econ.debtPressure']?.[row] ?? 0) === 1) stressors += S.debt ?? 0; // 015 R-005
    const stab = 1 - neuroticism;
    const target = S.base! + S.instability! * (1 - stab) + stressors * (0.5 + neuroticism) * (1.5 - resilience);
    const newStress = clamp(stress + (clamp(target) - stress) * R.stressRate! * dt);
    if (stress < S.peak! && newStress >= S.peak!) {
      const id = formatId('CIT', row);
      events.push({
        type: 'STRESS_PEAK',
        payload: { citizenId: id, value: Math.round(newStress * 100) / 100 },
        participants: [{ id, role: 'persona' }],
        causes: [
          { state: 'estresores', entity: id, value: Math.round(stressors * 100) / 100, weight: 0.7 },
          { state: 'neuroticismo', entity: id, value: Math.round(neuroticism * 100) / 100, weight: 0.3 },
        ],
      });
    }

    // R-003: el ánimo tiende a su objetivo (línea base, energía, estrés, soledad, hambre, emociones y diversión).
    const emo = EMOTIONS.map((e) => f[e]![row]! * emoDecay);
    const valence = emo[0]! - (emo[1]! + emo[2]! + emo[3]! + emo[4]!) / 4;
    const moodTarget =
      f['state.moodBaseline']![row]! +
      M.energy! * (energy - 0.5) -
      M.stress! * (newStress - M.stressRef!) -
      M.loneliness! * (1 - social) -
      M.hunger! * Math.max(0, 1 - hunger - 0.5) +
      M.valence! * valence -
      M.fun! * (1 - fun - 0.3);
    const mood = f['state.mood']![row]!;

    set('need.energy', row, energy);
    set('need.hunger', row, hunger);
    set('need.social', row, social);
    set('need.hygiene', row, hygiene);
    set('need.fun', row, fun);
    set('state.stress', row, newStress);
    set('state.mood', row, mood + (clamp(moodTarget) - mood) * R.moodRate! * dt);
    EMOTIONS.forEach((e, k) => set(e, row, emo[k]!));
  }
  const patches: Patch[] = [...columns].map(([column, c]) => ({ op: 'setMany', type: c.type, column, rows: c.rows, values: c.values }));
  return { patches, events };
}

export const needsSystem: System = {
  // Orden 0 en la fase `needs`: corre antes que la enfermedad (orden 1).
  id: 'needs',
  phase: 'needs',
  order: 0,
  capability: 'needs',
  cadence: 'tick',
  minLevel: 1,
  run: (view, ctx) => step(view, ctx),
  // Hasta que haya personas en nivel 1 (021 R-011), la variante gruesa es el mismo cálculo.
  runCoarse: (view, ctx) => step(view, ctx),
};
