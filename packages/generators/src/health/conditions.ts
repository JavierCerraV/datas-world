// Ficha de salud, fase 2 (spec 031 R-003, R-006): condiciones crónicas y salud física. Va después de la
// historia (030), porque el riesgo familiar mira a los padres, vivan o sean antepasados.
import { ageInYears, idNumber, makeEvent } from '@datas-world/engine';
import type { CauseRef, EntityId, HealthCondition, Rng, World, WorldEvent } from '@datas-world/engine';
import type { Catalog } from '../catalogs/schema.ts';
import { limitsWork } from './habits.ts';
import { stepAt } from './params.ts';
import type { HealthParams } from './params.ts';

const DAY = 1440;
const YEAR = 365 * DAY;

interface ConditionAttrs {
  minAge: number;
  risk?: Record<string, number>;
  physical: number;
  hereditary?: boolean;
}

/**
 * Condiciones crónicas (R-003). Para cada condición del catálogo, en orden:
 * 1. el riesgo de cada persona es la prevalencia del perfil a su edad × sus factores (sexo, peso, tabaco, alcohol,
 *    actividad, otras condiciones);
 * 2. los factores se normalizan por su media en el mundo, para que la prevalencia total siga siendo la del perfil;
 * 3. el antecedente familiar (padre o madre con la condición) multiplica después.
 * Las personas van de mayor a menor edad, así los padres se deciden antes que los hijos. Los antepasados solo
 * reciben las hereditarias (hipertensión y diabetes), para el riesgo familiar (decisión del usuario, 031 §10).
 */
export function generateConditions(
  world: World,
  livingIds: readonly EntityId[],
  ancestorIds: readonly EntityId[],
  catalog: Catalog,
  P: HealthParams,
  rng: Rng,
): WorldEvent[] {
  const c = world.components;
  const birth = (id: EntityId) => c.i32['demo.birthMinute']![idNumber(id)]!;
  const age = (id: EntityId) => ageInYears(birth(id), world.now, world.config.epoch);
  const u8 = (name: string, id: EntityId) => c.u8[name]![idNumber(id)]!;
  const has = (id: EntityId | undefined, key: string) =>
    id !== undefined && (world.citizens.get(id)?.conditions ?? []).some((h) => h.key === key);
  const add = (id: EntityId, h: HealthCondition) => {
    const p = world.citizens.get(id)!;
    p.conditions = [...(p.conditions ?? []), h].sort((a, b) => a.since - b.since);
  };
  const events: WorldEvent[] = [];
  const living = [...livingIds].sort((a, b) => birth(a) - birth(b) || idNumber(a) - idNumber(b));

  for (const entry of catalog.entries) {
    const a = entry.attrs as unknown as ConditionAttrs;
    const prevalence = P.conditionPrevalence[entry.key]!;

    // Antepasados: solo las hereditarias, con la prevalencia de los mayores.
    if (a.hereditary) {
      for (const id of ancestorIds) {
        const r = rng.fork('gen:health/ancestors').fork(id).fork(entry.key);
        if (!r.chance(stepAt(prevalence, 65))) continue;
        const since = birth(id) + r.int(Math.max(a.minAge, 45), 70) * YEAR;
        const death = c.i32['demo.deathMinute']?.[idNumber(id)] ?? 0;
        if (since >= 0 || (death !== 0 && since >= death)) continue;
        add(id, { key: entry.key, since, controlled: false });
      }
    }

    // Vivos: factores de riesgo normalizados por su media.
    const factor = (id: EntityId) => {
      const risk = a.risk ?? {};
      const p = world.citizens.get(id)!;
      let m = risk[p.sex!] ?? 1;
      const bmi = u8('health.bmiClass', id);
      if (bmi === 3) m *= risk.obese ?? 1;
      if (bmi === 2) m *= risk.overweight ?? 1;
      const tobacco = u8('health.tobacco', id);
      if (tobacco === 2) m *= risk.smoker ?? 1;
      if (tobacco === 1) m *= risk.exsmoker ?? 1;
      if (u8('health.alcohol', id) === 3) m *= risk.riskyAlcohol ?? 1;
      if (u8('health.activityDays', id) >= 5) m *= risk.active ?? 1;
      for (const [k, v] of Object.entries(risk)) if (k.includes('.') && has(id, k)) m *= v;
      return m;
    };
    const eligible = living.filter((id) => age(id) >= a.minAge);
    const factors = new Map(eligible.map((id) => [id, factor(id)]));
    const mean = eligible.length ? [...factors.values()].reduce((s, x) => s + x, 0) / eligible.length : 1;
    for (const id of eligible) {
      const p = world.citizens.get(id)!;
      const family = a.hereditary && (has(p.motherId, entry.key) || has(p.fatherId, entry.key));
      const risk = stepAt(prevalence, age(id)) * (factors.get(id)! / mean) * (family ? (a.risk?.family ?? 1) : 1);
      const r = rng.fork('gen:health/conditions').fork(id).fork(entry.key);
      if (!r.chance(Math.min(0.95, risk))) continue;
      const years = age(id);
      const at = Math.min(birth(id) + r.int(Math.max(a.minAge, years - 20), years) * YEAR + r.int(0, 364) * DAY, -DAY);
      const since = Math.min(Math.max(at, birth(id) + a.minAge * YEAR), -DAY);
      const h: HealthCondition = { key: entry.key, since, controlled: r.chance(P.controlledP) };
      add(id, h);
      const causes: CauseRef[] = [{ state: 'edad', value: years, weight: 0.5 }];
      if (u8('health.bmiClass', id) === 3) causes.push({ state: 'obesidad', entity: id, weight: 0.3 });
      if (u8('health.tobacco', id) === 2) causes.push({ state: 'tabaquismo', entity: id, weight: 0.3 });
      if (family) causes.push({ state: 'antecedente_familiar', entity: (has(p.motherId, entry.key) ? p.motherId : p.fatherId)!, weight: 0.3 });
      const e = makeEvent(world.counters, h.since, {
        type: 'CONDITION_DIAGNOSED',
        payload: { citizenId: id, condition: entry.key, name: entry.name, cie10: entry.code! },
        participants: [{ id, role: 'paciente' }],
        causes,
      });
      events.push(e);
      p.backstory?.push(e.id);
    }
  }
  return events;
}

/**
 * Salud física base (R-006): 1 − efectos de las condiciones (la mitad si está controlada) − edad − hábitos,
 * limitada a [0,05, 1]. Sustituye al valor constante de 007.
 */
export function computePhysical(world: World, livingIds: readonly EntityId[], catalog: Catalog): void {
  const c = world.components;
  const effect = new Map(catalog.entries.map((e) => [e.key, (e.attrs as unknown as ConditionAttrs).physical]));
  for (const id of livingIds) {
    const row = idNumber(id);
    const age = ageInYears(c.i32['demo.birthMinute']![row]!, world.now, world.config.epoch);
    let v = 1 - Math.max(0, age - 30) * 0.006;
    let burden = 0;
    for (const h of world.citizens.get(id)!.conditions ?? []) burden += (effect.get(h.key) ?? 0) * (h.controlled ? 0.5 : 1);
    v -= burden;
    // 010 R-006: las condiciones aceleran la caída de energía (EPOC 0,15 → × 1,3).
    if (c.f32['health.energyFactor']) c.f32['health.energyFactor'][row] = 1 + 2 * burden;
    if (c.u8['health.tobacco']![row] === 2) v -= 0.05;
    if (c.u8['health.bmiClass']![row] === 3) v -= 0.05;
    if (c.u8['health.alcohol']![row] === 3) v -= 0.05;
    if (c.u8['health.activityDays']![row]! >= 5) v += 0.03;
    if (limitsWork(world, id)) v -= 0.1;
    c.f32['health.physical']![row] = Math.min(1, Math.max(0.05, v));
  }
}
