// Candidatas y aportes por fuente de control (spec 040 R-002, R-003; porta `decide` del prototipo). En un bloque
// flexible la persona compara seguir la rutina, comer, dormir un rato si está agotada y cada actividad de su ficha
// de esparcimiento (032 R-006) posible ahora: lugar abierto al llegar (004), dinero (015) y tiempo de ida y vuelta
// (016). El valor de cada candidata es la suma de sus aportes; no se lee el temperamento (040 INV-002).
import type { ActivityKind } from '../activity.ts';
import type { CauseRef } from '../events.ts';
import { discountKOf, discounted, leisureResponse, leisureStrength0 } from '../functions/history.ts';
import { directValue } from '../functions/learn.ts';
import { functionalValue } from '../relations/derive.ts';
import type { RelationalNetwork } from '../relations/types.ts';
import type { FunctionStore, LearningParams, Ontology } from '../functions/types.ts';
import { formatId } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import { enterRefusal } from '../mobility/enter.ts';
import { networkOf } from '../mobility/network.ts';
import type { MobilityParams } from '../mobility/params.ts';
import { planTrip } from '../mobility/trip.ts';
import type { Rng } from '../rng.ts';
import type { DayInfo } from '../routines/day.ts';
import { planAt } from '../routines/plan.ts';
import type { ActionRequest, WorldView } from '../simulation/system.ts';
import { activityOf } from './columns.ts';
import type { LeisureTable } from './columns.ts';
import { strengthContribution } from './select.ts';

/** Fuentes de control de la 040 R-003 (sin reglas verbales, valores ni contexto social hasta MF5 y M3). */
export type ControlSource = 'reforzador' | 'fuerza' | 'demorado' | 'regla' | 'aversion' | 'coste';

export interface SourceContribution {
  source: ControlSource;
  contribution: number;
  /** Estado o función implicada (`need.fun`, `ocio.deporte.futbol`, `lugar.ocio.bar`). */
  ref?: string;
  /** Eventos que formaron la función o la fuerza (019). */
  origins?: readonly string[];
}

export interface Option {
  action: ActionRequest;
  value: number;
  sources: SourceContribution[];
}

/** Demora de las consecuencias de las obligaciones (040 R-003) y su magnitud [M]. */
export const OBLIGATION_DELAY_DAYS = 5;
const OBLIGATION_MAGNITUDE = 0.4;

/** Parámetros de la acción que lee el validador. */
export interface ActionParams {
  activity: ActivityKind;
  until: number;
  /** Coste de la actividad (el del viaje lo cobra la movilidad al salir). */
  cost: number;
  /** Coste previsto del viaje de ida y vuelta, para comprobar que alcanza el dinero. */
  travelCost?: number;
  /** Clave de la ficha de esparcimiento, si es una afición. */
  leisure?: string;
}

export interface DecisionCtx {
  view: WorldView;
  row: number;
  now: number;
  here: number;
  home: number;
  /** Minuto hasta el que hay tiempo libre (próxima obligación o la hora de dormir). */
  cap: number;
  day: (at: number) => DayInfo;
  occ: ReadonlyMap<number, number>;
  P: MobilityParams;
  table: LeisureTable;
  /** Ontología y parámetros del aprendizaje, para las funciones aversivas presentes (036); sin ellas no aportan. */
  onto?: Ontology;
  learning?: LearningParams;
}

const DAY = 1440;
const minuteOf = (at: number) => ((at % DAY) + DAY) % DAY;
/** Actividades de la rutina que no se interrumpen por tiempo libre (turno, colegio, dormir). */
const HARD: ReadonlySet<ActivityKind> = new Set(['work', 'study', 'sleep']);

/** Hasta cuándo hay tiempo libre: el primer cuarto de hora (en las próximas 8 h) con una actividad firme. */
export function freeUntil(view: WorldView, row: number, now: number, day: (at: number) => DayInfo): number {
  for (let at = now + 15; at <= now + 8 * 60; at += 15) {
    const plan = planAt(view, row, day(at), minuteOf(at));
    if (HARD.has(plan.activity) && plan.flexibility <= 0.3) return at;
  }
  return now + 8 * 60;
}

/** 040 R-006: los 3 aportes de mayor magnitud como causas (`fuente.<fuente>:<ref>`), más sus eventos de origen. */
export function explainCauses(id: EntityId, sources: readonly SourceContribution[]): CauseRef[] {
  const top = [...sources]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution) || (a.source < b.source ? -1 : 1) || ((a.ref ?? '') < (b.ref ?? '') ? -1 : 1))
    .slice(0, 3);
  const total = top.reduce((s, f) => s + Math.abs(f.contribution), 0) || 1;
  const causes: CauseRef[] = top.map((f) => ({
    state: `fuente.${f.source}${f.ref ? `:${f.ref}` : ''}`,
    entity: id,
    value: Math.round(f.contribution * 100) / 100,
    weight: Math.round((Math.abs(f.contribution) / total) * 100) / 100,
  }));
  const origins = [...new Set(top.flatMap((f) => f.origins ?? []))].slice(0, 3);
  for (const e of origins) causes.push({ event: e as EntityId, weight: 0.1 });
  return causes;
}

const valueOf = (sources: readonly SourceContribution[]) => sources.reduce((s, f) => s + f.contribution, 0);

/** Minutos entre dos veces de una afición según su frecuencia mensual (032). */
export const intervalOf = (perMonth: number): number => (30 * DAY) / Math.max(0.1, perMonth);

/** Aportes de seguir la rutina en un bloque flexible (040 R-003): la rutina como regla y, en las obligaciones, sus consecuencias demoradas. */
function routineSources(activity: ActivityKind, energy: number, k: number): SourceContribution[] {
  const delayed: SourceContribution = { source: 'demorado', contribution: discounted(OBLIGATION_MAGNITUDE, OBLIGATION_DELAY_DAYS, k), ref: 'hist.discountK' };
  switch (activity) {
    case 'job_search':
    case 'chores':
    case 'care':
      return [{ source: 'regla', contribution: 0.45, ref: `rutina.${activity}` }, delayed];
    case 'study':
      return [{ source: 'regla', contribution: 0.35, ref: 'rutina.study' }, delayed];
    case 'errands':
      return [{ source: 'regla', contribution: 0.45, ref: 'rutina.errands' }];
    case 'sleep':
      return [{ source: 'regla', contribution: 2, ref: 'rutina.siesta' }];
    default:
      // Descansar en casa (prototipo `descansar`: 0,3 + 0,2 × cansancio).
      return [{ source: 'reforzador', contribution: 0.3 + 0.2 * (1 - energy), ref: 'need.energy' }];
  }
}

/**
 * 040 R-003: funciones aversivas presentes (actividad y lugar) en una respuesta de acercamiento. Es el valor
 * funcional (037 R-006): el aprendido o el derivado por la red relacional, si es mayor.
 */
function aversion(
  c: DecisionCtx,
  store: FunctionStore | undefined,
  net: RelationalNetwork | undefined,
  stims: readonly string[],
  ctx: string,
): SourceContribution | undefined {
  if ((!store && !net) || !c.onto || !c.learning) return undefined;
  const directOf = (s: string) => directValue(store, c.onto!, s, ctx, c.now, c.learning!);
  const values = stims.map((x) => functionalValue(net, directOf, x, ctx));
  const v = values.reduce((s, x) => s + x.value, 0);
  if (v >= 0) return undefined;
  const origins = [
    ...(store?.f.filter((f) => stims.includes(f.s) && f.v < 0).flatMap((f) => f.src) ?? []),
    ...values.flatMap((x) => (x.derived && net ? x.derived.path.flatMap((k) => net.e[k]?.src ?? []) : [])),
  ];
  return { source: 'aversion', contribution: 0.5 * v, ref: stims.join('+'), origins };
}

export function buildOptions(c: DecisionCtx, rng: Rng): Option[] {
  const { view, row, now, here, home, cap } = c;
  const id = formatId('CIT', row);
  const f = view.components.f32;
  const energy = f['need.energy']![row]!;
  const hunger = f['need.hunger']![row]!;
  const fun = f['need.fun']![row]!;
  const social = f['need.social']![row]!;
  const options: Option[] = [];
  const add = (kind: string, params: ActionParams, sources: SourceContribution[], target = 0) =>
    options.push({
      action: { actor: id, kind, ...(target ? { target: formatId('PLC', target) } : {}), params, reason: explainCauses(id, sources) },
      value: valueOf(sources),
      sources,
    });

  // Seguir la rutina (el bloque flexible que toca), comprometida por una hora como mucho. En el tiempo libre,
  // seguir la rutina es descansar en casa (`idle`): la diversión la dan las aficiones elegidas.
  const plan = planAt(view, row, c.day(now), minuteOf(now));
  const routine: ActivityKind = plan.activity === 'leisure' ? 'idle' : plan.activity;
  add('follow_routine', { activity: routine, until: Math.min(now + 60, cap), cost: 0 }, routineSources(plan.activity, energy, discountKOf(view, row)));

  // Comer donde esté (prototipo: hambre > 0,35); con hambre crítica, casi seguro (CA-003). El hambre es la
  // operación motivadora del reforzador comida (R-007).
  if (hunger < 0.65)
    add('eat', { activity: 'eat', until: Math.min(now + rng.int(30, 50), cap), cost: 0 }, [
      { source: 'reforzador', contribution: 1.5 * (1 - hunger) + (4 * Math.max(0, 0.25 - hunger)) / 0.25, ref: 'need.hunger' },
    ]);

  // Dormir un rato en casa si está agotada.
  if (energy < 0.3 && home)
    add('rest', { activity: 'sleep', until: Math.min(now + 60, cap), cost: 0 }, [{ source: 'reforzador', contribution: 0.3 + 2 * (0.3 - energy), ref: 'need.energy' }], home);

  // Aficiones de la ficha (032 R-006), en orden de clave.
  const person = view.citizens.get(id);
  const store = person?.functions as FunctionStore | undefined; // solo se lee (netValue no muta)
  const relNet = person?.network as RelationalNetwork | undefined;
  const net = networkOf(view);
  for (const interest of [...(person?.leisure ?? [])].sort((a, b) => (a.key < b.key ? -1 : 1))) {
    const a = c.table[interest.key];
    if (!a) continue;
    // El lugar: el más cercano de sus tipos que esté abierto al llegar, o la casa si se puede hacer allí.
    let best: { place: number; out: number; back: number; travelCost: number } | undefined;
    const candidates = [...a.placeKinds.flatMap((k) => net.byKind.get(k) ?? []), ...(a.atHome || a.placeKinds.length === 0 ? [home] : [])];
    for (const place of [...new Set(candidates)].sort((x, y) => x - y)) {
      if (!place) continue;
      const out = place === here ? { minutes: 0, cost: 0 } : planTrip(view, row, here, place, now, null, c.P);
      if (!out) continue;
      if (place !== home && enterRefusal(view, row, place, now + out.minutes, c.occ) !== null) continue;
      const back = place === home ? { minutes: 0, cost: 0 } : planTrip(view, row, place, home, now + out.minutes + a.hours * 60, null, c.P);
      if (!back) continue;
      if (!best || out.minutes < best.out) best = { place, out: out.minutes, back: back.minutes, travelCost: out.cost + back.cost };
    }
    if (!best) continue;
    // Tiempo: ida, al menos la mitad de la actividad y vuelta antes de la próxima obligación.
    const stay = Math.min(a.hours * 60, cap - now - best.out - best.back);
    if (stay < a.hours * 30) continue;
    // El dinero no filtra la opción: si no alcanza, el validador la rechaza y se elige otra (R-006).
    const cost = a.cost;
    const totalCost = cost + best.travelCost;
    const response = store?.r.find((x) => x.r === leisureResponse(interest.key));
    const placeKind = view.places.get(formatId('PLC', best.place))?.kind;
    const sources: SourceContribution[] = [
      // Operaciones motivadoras (R-007): aburrimiento y soledad multiplican la magnitud del reforzador; la saciedad
      // (haberlo hecho hace poco respecto a su intervalo) la resta.
      { source: 'reforzador', contribution: 0.8 * (1 - fun), ref: 'need.fun' },
      { source: 'reforzador', contribution: a.group === 'solo' ? 0 : 0.4 * (1 - social), ref: 'need.social' },
      {
        source: 'reforzador',
        contribution: 3 * (Math.min(2, (now - (interest.lastDone ?? now - intervalOf(interest.perMonth))) / intervalOf(interest.perMonth)) - 1),
        ref: `saciedad.${interest.key}`,
      },
      // Fuerza aprendida de la respuesta (036 R-002); sin almacén, la de partida de la ficha.
      {
        source: 'fuerza',
        contribution: strengthContribution(response?.w ?? leisureStrength0(interest.affinity)),
        ref: leisureResponse(interest.key),
        ...(response?.src ? { origins: response.src } : {}),
      },
      { source: 'coste', contribution: -0.3 * Math.min(1, totalCost / 50_000), ref: 'dinero' },
      { source: 'coste', contribution: -0.25 * Math.min(2, best.out / 60), ref: 'viaje' },
      { source: 'coste', contribution: -0.3 * a.physical * Math.max(0, 0.5 - energy), ref: 'need.energy' },
    ];
    const av = aversion(c, store, relNet, [`actividad.${interest.key}`, ...(placeKind ? [`lugar.${placeKind}`] : [])], placeKind ? `lugar.${placeKind}` : '');
    if (av) sources.push(av);
    add(
      'leisure',
      { activity: activityOf(interest.key, a), until: now + best.out + Math.round(stay), cost, travelCost: best.travelCost, leisure: interest.key },
      sources,
      best.place,
    );
  }
  return options;
}
