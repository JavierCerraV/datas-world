// Opciones y utilidad (spec 017 R-001, R-002; porta `decide` del prototipo). En un bloque flexible la persona
// compara seguir la rutina, comer, dormir un rato si está agotada y cada actividad de su ficha de esparcimiento
// (032 R-006) posible ahora: lugar abierto al llegar (004), dinero (015) y tiempo de ida y vuelta (016).
import type { ActivityKind } from '../activity.ts';
import type { CauseRef } from '../events.ts';
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
import { legacyTrait } from '../temperament/legacy.ts';
import { activityOf } from './columns.ts';
import type { LeisureTable } from './columns.ts';

export interface Factor {
  factor: string;
  contribution: number;
}

export interface Option {
  action: ActionRequest;
  utility: number;
  explain: Factor[];
}

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

/** Los 3 factores de mayor peso, como causas del evento (R-005). */
export function explainCauses(id: EntityId, explain: readonly Factor[]): CauseRef[] {
  const top = [...explain].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution) || (a.factor < b.factor ? -1 : 1)).slice(0, 3);
  const total = top.reduce((s, f) => s + Math.abs(f.contribution), 0) || 1;
  return top.map((f) => ({ state: `decision.${f.factor}`, entity: id, value: Math.round(f.contribution * 100) / 100, weight: Math.round((Math.abs(f.contribution) / total) * 100) / 100 }));
}

const utilityOf = (explain: readonly Factor[]) => explain.reduce((s, f) => s + f.contribution, 0);

/** Minutos entre dos veces de una afición según su frecuencia mensual (032). */
export const intervalOf = (perMonth: number): number => (30 * DAY) / Math.max(0.1, perMonth);

/** Utilidad de seguir la rutina en un bloque flexible, según la actividad planificada. */
function routineFactors(activity: ActivityKind, energy: number, conscientiousness: number): Factor[] {
  switch (activity) {
    case 'job_search':
    case 'chores':
    case 'care':
      return [{ factor: 'obligacion', contribution: 0.45 }, { factor: 'responsabilidad', contribution: 0.4 * conscientiousness }];
    case 'study':
      return [{ factor: 'obligacion', contribution: 0.35 }, { factor: 'responsabilidad', contribution: 0.4 * conscientiousness }];
    case 'errands':
      return [{ factor: 'obligacion', contribution: 0.45 }];
    case 'sleep':
      return [{ factor: 'siesta', contribution: 2 }];
    default:
      // Descansar en casa (prototipo `descansar`: 0,3 + 0,2 × cansancio).
      return [{ factor: 'descanso', contribution: 0.3 }, { factor: 'cansancio', contribution: 0.2 * (1 - energy) }];
  }
}

export function buildOptions(c: DecisionCtx, rng: Rng): Option[] {
  const { view, row, now, here, home, cap } = c;
  const id = formatId('CIT', row);
  const f = view.components.f32;
  const energy = f['need.energy']![row]!;
  const hunger = f['need.hunger']![row]!;
  const fun = f['need.fun']![row]!;
  const social = f['need.social']![row]!;
  const conscientiousness = legacyTrait(view, row, 'conscientiousness'); // @deprecated: se retira en MF3 (040)
  const options: Option[] = [];
  const add = (kind: string, params: ActionParams, explain: Factor[], target = 0) =>
    options.push({
      action: { actor: id, kind, ...(target ? { target: formatId('PLC', target) } : {}), params, reason: explainCauses(id, explain) },
      utility: utilityOf(explain),
      explain,
    });

  // Seguir la rutina (el bloque flexible que toca), comprometida por una hora como mucho. En el tiempo libre,
  // seguir la rutina es descansar en casa (`idle`): la diversión la dan las aficiones elegidas.
  const plan = planAt(view, row, c.day(now), minuteOf(now));
  const routine: ActivityKind = plan.activity === 'leisure' ? 'idle' : plan.activity;
  add('follow_routine', { activity: routine, until: Math.min(now + 60, cap), cost: 0 }, routineFactors(plan.activity, energy, conscientiousness));

  // Comer donde esté (prototipo: hambre > 0,35); con hambre crítica, casi seguro (CA-001).
  if (hunger < 0.65)
    add('eat', { activity: 'eat', until: Math.min(now + rng.int(30, 50), cap), cost: 0 }, [
      { factor: 'hambre', contribution: 1.5 * (1 - hunger) },
      { factor: 'hambre_critica', contribution: 4 * Math.max(0, 0.25 - hunger) / 0.25 },
    ]);

  // Dormir un rato en casa si está agotada.
  if (energy < 0.3 && home)
    add('rest', { activity: 'sleep', until: Math.min(now + 60, cap), cost: 0 }, [{ factor: 'cansancio', contribution: 0.3 + 2 * (0.3 - energy) }], home);

  // Aficiones de la ficha (032 R-006), en orden de clave.
  const person = view.citizens.get(id);
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
    add(
      'leisure',
      { activity: activityOf(interest.key, a), until: now + best.out + Math.round(stay), cost, travelCost: best.travelCost, leisure: interest.key },
      [
        { factor: 'diversion', contribution: 0.8 * (1 - fun) },
        { factor: 'afinidad', contribution: 0.5 * interest.affinity },
        { factor: 'compania', contribution: a.group === 'solo' ? 0 : 0.4 * (1 - social) },
        // Frecuencia de la ficha: apetece más cuanto más tiempo pasa desde la última vez respecto a su intervalo.
        { factor: 'costumbre', contribution: 3 * (Math.min(2, (now - (interest.lastDone ?? now - intervalOf(interest.perMonth))) / intervalOf(interest.perMonth)) - 1) },
        { factor: 'coste', contribution: -0.3 * Math.min(1, totalCost / 50_000) },
        { factor: 'viaje', contribution: -0.25 * Math.min(2, best.out / 60) },
        { factor: 'cansancio', contribution: -0.3 * a.physical * Math.max(0, 0.5 - energy) },
      ],
      best.place,
    );
  }
  return options;
}
