// Trayectoria previa (spec 007 R-006; spec 008): eventos con fecha anterior al presente del mundo.
// Sus causas son `{ state: 'backstory' }` (014: todo evento no espontáneo lleva causas).
import { ageInYears, idNumber, makeEvent, toCalendar } from '@datas-world/engine';
import type { EntityId, Rng, World, WorldEvent } from '@datas-world/engine';
import type { Catalog } from '../catalogs/schema.ts';
import { COMPLETION_AGE, minuteOf } from './people.ts';

const CAUSE = [{ state: 'backstory', weight: 1 }];
const YEAR = 525_600;
const DAY = 1_440;

const birthOf = (world: World, id: EntityId) => world.components.i32['demo.birthMinute']![idNumber(id)]!;

/** Minuto del cumpleaños número `years` de alguien nacido en `birth` (mismo día y mes). */
function anniversary(world: World, birth: number, years: number): number {
  const b = toCalendar(birth, world.config.epoch);
  const day = b.month === 2 && b.day === 29 ? 28 : b.day;
  return minuteOf(world.config.epoch, b.year + years, b.month, day);
}

function push(world: World, events: WorldEvent[], e: WorldEvent, who: readonly EntityId[]): void {
  events.push(e);
  for (const id of who) world.citizens.get(id)!.backstory!.push(e.id);
}

/** Hecho de infancia (a los 8 años) y fin de estudios (al terminar el nivel más alto). */
export function personBackstory(
  world: World,
  id: EntityId,
  level: number,
  levels: Catalog,
  childhood: Catalog,
  r: Rng,
  events: WorldEvent[],
): void {
  const birth = birthOf(world, id);
  const age = ageInYears(birth, world.now, world.config.epoch);
  if (age >= 8) {
    const kind = childhood.entries[r.int(0, childhood.entries.length - 1)]!;
    const at = Math.min(anniversary(world, birth, 8), -DAY);
    const e = makeEvent(world.counters, at, {
      type: 'CHILDHOOD_EVENT',
      payload: { citizenId: id, kind: kind.key, text: kind.name },
      participants: [{ id, role: 'protagonista' }],
      causes: CAUSE,
    });
    push(world, events, e, [id]);
  }
  if (level >= 1) {
    const done = anniversary(world, birth, COMPLETION_AGE[level]!);
    const b = toCalendar(done, world.config.epoch);
    // Fin del año escolar o académico (calendario A: noviembre), sin pasar del presente.
    const at = Math.min(minuteOf(world.config.epoch, b.year, 11, 30), -DAY);
    const name = levels.entries.find((e) => (e.attrs as { column: number }).column === level)!.name;
    const e = makeEvent(world.counters, Math.max(at, birth + DAY), {
      type: 'STUDIES_COMPLETED',
      payload: { citizenId: id, level, levelName: name },
      participants: [{ id, role: 'protagonista' }],
      causes: CAUSE,
    });
    push(world, events, e, [id]);
  }
}

/**
 * Formación del hogar: antes del nacimiento del hijo mayor (si lo hay) o unos años atrás, pero nunca antes de
 * que el fundador más joven cumpliera 18. Los fundadores son los miembros que no son hijos de otro miembro
 * (un hijo adulto no fundó el hogar de sus padres). Participan los miembros nacidos antes de esa fecha.
 */
export function householdBackstory(world: World, householdId: EntityId, r: Rng, events: WorldEvent[]): void {
  const h = world.households.get(householdId)!;
  const births = h.memberIds.map((id) => ({ id, birth: birthOf(world, id) }));
  const kids = h.kinship.filter((k) => k.kind === 'parent').map((k) => k.to);
  const founders = births.filter(
    (b) => !kids.includes(b.id) && ageInYears(b.birth, world.now, world.config.epoch) >= 18,
  );
  const floor = Math.max(...founders.map((a) => anniversary(world, a.birth, 18)));
  const oldestKid = births.filter((b) => kids.includes(b.id)).sort((a, b) => a.birth - b.birth)[0];
  let at: number;
  if (oldestKid && h.template !== 'extended') at = oldestKid.birth - r.int(0, 2 * 365) * DAY;
  else at = -r.int(1, Math.max(1, Math.floor(-floor / YEAR) || 1)) * YEAR - r.int(0, 364) * DAY;
  at = Math.min(Math.max(at, floor), -DAY);
  const who = births.filter((b) => b.birth <= at).map((b) => b.id);
  const participants = (who.length > 0 ? who : [h.headId!]).map((id) => ({ id, role: 'miembro' }));
  const e = makeEvent(world.counters, at, {
    type: 'HOUSEHOLD_FORMED',
    payload: { householdId, template: h.template, members: [...h.memberIds] },
    participants,
    causes: CAUSE,
  });
  push(
    world,
    events,
    e,
    participants.map((p) => p.id),
  );
}

/** Ordena la trayectoria de cada persona por fecha (007 INV-003). */
export function sortBackstories(world: World, events: readonly WorldEvent[]): void {
  const at = new Map(events.map((e) => [e.id, e.at]));
  for (const c of world.citizens.values()) c.backstory?.sort((a, b) => at.get(a)! - at.get(b)! || (a < b ? -1 : 1));
}
