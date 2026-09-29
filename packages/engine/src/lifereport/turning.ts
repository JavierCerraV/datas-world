// Puntos de inflexión (spec 020 R-002): los hechos de la persona con más consecuencias en su vida, por el grafo causal
// (019) en los 90 días siguientes y por el cambio de ánimo y de dinero en los 30 días siguientes.
import { why } from '../causality/why.ts';
import type { WorldEvent } from '../events.ts';
import { concerns } from './chapters.ts';
import { DAY, lambdaOf, pointAt, r3 } from './types.ts';
import type { ReportInput, TurningPoint } from './types.ts';

/** Lo que no es un hecho de su vida sino un registro de su memoria o de su rutina: ni punto de inflexión ni consecuencia. */
const NOT_FACTS = new Set([
  'CHAPTER_OPENED', 'CHAPTER_CLOSED', 'SCHEMA_FORMED', 'SCHEMA_REVISED', 'BOND_FORGOTTEN', 'DAY_STARTED', 'TRIP_TAKEN', 'THOUGHT_DERIVED',
  'WORLD_CREATED', 'WORLD_RESUMED', 'WORLD_PAUSED', 'EXTERNAL_INPUT_APPLIED', 'CAPABILITY_ENABLED',
  // Lo que se cuenta de un hecho no es una consecuencia en la vida de la persona (revisión de cierre de M3).
  'RUMOR_TOLD', 'RUMOR_DISTORTED', 'BELIEF_CORRECTED',
]);
/** Rutina: cuentan como consecuencia, pero no son puntos de inflexión por sí mismos (recuperarse de una gripa, tampoco). */
const ROUTINE = new Set(['LEISURE_DONE', 'SALARY_PAID', 'RENT_PAID', 'MET', 'DEVELOPMENT_YEAR', 'OVERSLEPT', 'ENCOUNTER', 'RECOVERED']);
/** Nodos del «¿por qué?» de cada punto de inflexión, para que se lea. */
const WHY_NODES = 15;
const CONSEQUENCE_DAYS = 90;
const CHANGE_DAYS = 30;
export const TURNING_POINTS = 5;

function scoreFacts(input: ReportInput): { e: WorldEvent; n: number; moodDelta: number | undefined; moneyDelta: number | undefined; score: number }[] {
  const { events, trajectory } = input;
  const children = new Map<string, WorldEvent[]>();
  for (const e of events) {
    if (NOT_FACTS.has(e.type)) continue;
    for (const c of e.causes) if ('event' in c) children.set(c.event, [...(children.get(c.event) ?? []), e]);
  }
  const consequences = (root: WorldEvent): number => {
    const seen = new Set<string>([root.id]);
    const queue = [root];
    while (queue.length) {
      for (const k of children.get(queue.shift()!.id) ?? []) {
        if (seen.has(k.id) || k.at > root.at + CONSEQUENCE_DAYS * DAY) continue;
        seen.add(k.id);
        queue.push(k);
      }
    }
    return seen.size - 1;
  };
  // Solo los hechos de su vida: los que le tocan y ocurrieron desde que nació (no las muertes de antes de nacer).
  const birth = input.view.components.i32['demo.birthMinute']?.[Number(input.id.slice(4))] ?? -Infinity;
  const scored = events
    .filter((e) => !NOT_FACTS.has(e.type) && !ROUTINE.has(e.type) && e.at >= birth && concerns(input.view, e, input.id))
    .map((e) => {
      const n = consequences(e);
      const a = pointAt(trajectory, Math.floor(e.at / DAY));
      const b = pointAt(trajectory, Math.floor(e.at / DAY) + CHANGE_DAYS);
      const moved = a && b && b.day > a.day;
      const moodDelta = moved ? r3(b.mood - a.mood) : undefined;
      const moneyDelta = moved ? b.money - a.money : undefined;
      const money = moneyDelta !== undefined ? Math.abs(moneyDelta) / Math.max(Math.abs(a!.money), 1_000_000) : 0;
      const score = n + 10 * Math.abs(moodDelta ?? 0) + 3 * money + 2 * e.importance + Math.abs(lambdaOf(e));
      return { e, n, moodDelta, moneyDelta, score };
    })
    .filter((x) => x.n > 0 || lambdaOf(x.e) !== 0 || x.e.importance >= 0.5)
    .sort((a, b) => b.score - a.score || (a.e.id < b.e.id ? -1 : 1));
  return scored;
}

/** Los hechos de su vida que pueden ser punto de inflexión, del más al menos decisivo (CA-001: se muestran 5). */
export const turningCandidates = (input: ReportInput): WorldEvent[] => scoreFacts(input).map((x) => x.e);

export function turningPoints(input: ReportInput): TurningPoint[] {
  const { get, names } = input;
  const scored = scoreFacts(input).slice(0, TURNING_POINTS);
  return scored.map((x) => ({
    event: x.e.id, consequences: x.n,
    ...(x.moodDelta !== undefined ? { moodDelta: x.moodDelta } : {}), ...(x.moneyDelta !== undefined ? { moneyDelta: x.moneyDelta } : {}),
    why: why(get, x.e.id, { depth: 3, maxNodes: WHY_NODES, view: input.view, ...(names ? { names } : {}) })!,
  })).sort((a, b) => (a.event < b.event ? -1 : 1));
}
