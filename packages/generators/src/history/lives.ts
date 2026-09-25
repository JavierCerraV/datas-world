// Hechos de vida del pasado (spec 030 R-004 a R-006): uniones, nacimientos, migraciones y muertes.
import { idNumber, makeEvent } from '@datas-world/engine';
import type { CauseRef, EntityId, Rng, World, WorldEvent } from '@datas-world/engine';
import type { Catalog } from '../catalogs/schema.ts';
import { meanDeathAge } from './params.ts';
import type { Clock, HistoricalEvent, HistoryParams } from './params.ts';

const DAY = 1440;
const YEAR = 365 * DAY;
const MAX_AGE = 100;
const MIGRATION_EFFECTS = ['ruralUrbanMigration', 'forcedDisplacement', 'displacement'] as const;
/**
 * Efectos de muerte del catálogo, a quién afectan y cómo se nombra la causa. Un efecto violento multiplica
 * el riesgo de muerte violenta (una parte `violentDeathShare` del total); uno no violento, el de muerte por
 * cualquier causa (p. ej. la pandemia en mayores).
 */
const DEATH_EFFECTS: {
  effect: string;
  violent: boolean;
  applies: (age: number, sex: string, rural: boolean) => boolean;
  cause: string;
}[] = [
  { effect: 'violentDeathRural', violent: true, applies: (_a, _s, rural) => rural, cause: 'violencia' },
  { effect: 'violentDeathYoungMen', violent: true, applies: (a, s) => s === 'M' && a >= 15 && a < 40, cause: 'violencia' },
  { effect: 'deathElderly', violent: false, applies: (a) => a >= 65, cause: 'enfermedad' },
];

/** Fracción de las muertes que se atribuye a un hecho con efecto k (exceso de riesgo sobre el total). */
export function attributableShare(k: number, violent: boolean, violentShare: number): number {
  if (k <= 1) return 0;
  if (!violent) return 1 - 1 / k;
  const excess = violentShare * (k - 1);
  return excess / (1 + excess);
}

export interface LivesInput {
  world: World;
  livingIds: readonly EntityId[];
  ancestorIds: readonly EntityId[];
  birthplaces: Catalog;
  history: readonly HistoricalEvent[];
  context: Map<string, WorldEvent>;
  P: HistoryParams;
  clock: Clock;
  municipalityId: EntityId;
  townAt: number;
  rng: Rng;
}

/** Genera los eventos de vida en orden: uniones → nacimientos → migraciones → muertes (cada muerte tras sus hechos). */
export function generateLives(inp: LivesInput): WorldEvent[] {
  const { world, P, clock, municipalityId } = inp;
  const c = world.components;
  const birth = c.i32['demo.birthMinute']!;
  const death = c.i32['demo.deathMinute']!;
  const floor = clock.at(P.foundingYear);
  const events: WorldEvent[] = [];
  const last = new Map<EntityId, number>();
  const all = [...inp.livingIds, ...inp.ancestorIds].sort((a, b) => idNumber(a) - idNumber(b));
  const bornOf = (id: EntityId) => birth[idNumber(id)]!;
  const rural = (bp: string) =>
    Boolean((inp.birthplaces.entries.find((e) => e.key === bp)?.attrs as { rural?: boolean } | undefined)?.rural);
  const placeName = (bp: string) =>
    bp === municipalityId ? world.places.get(bp)!.name : (inp.birthplaces.entries.find((e) => e.key === bp)?.name ?? bp);
  const record = (e: WorldEvent, ids: EntityId[]) => {
    events.push(e);
    for (const id of ids) {
      world.citizens.get(id)!.backstory?.push(e.id);
      last.set(id, Math.max(last.get(id) ?? e.at, e.at));
    }
  };
  const contextCauses = (year: number, at: number, effects: readonly string[], weight: number): CauseRef[] =>
    inp.history
      .filter((h) => year >= h.startYear && year <= h.endYear && effects.some((k) => (h.effects[k] ?? 1) > 1))
      .map((h) => inp.context.get(h.key))
      .filter((e): e is WorldEvent => e !== undefined && e.at <= at)
      .map((e) => ({ event: e.id, weight }));

  // Uniones: una por pareja de padres con algún antepasado, antes de su primer hijo común.
  const firstChild = new Map<string, { mother: EntityId; father: EntityId; at: number }>();
  for (const id of all) {
    const p = world.citizens.get(id)!;
    if (!p.motherId || !p.fatherId) continue;
    if (!world.citizens.get(p.motherId)!.ancestor && !world.citizens.get(p.fatherId)!.ancestor) continue;
    const key = `${p.motherId}+${p.fatherId}`;
    const prev = firstChild.get(key);
    if (!prev || bornOf(id) < prev.at) firstChild.set(key, { mother: p.motherId, father: p.fatherId, at: bornOf(id) });
  }
  const unionOf = new Map<string, WorldEvent>();
  for (const [key, u] of [...firstChild].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const r = inp.rng.fork('hist:unions').fork(key);
    const adult = Math.max(bornOf(u.mother), bornOf(u.father)) + 16 * YEAR;
    const at = Math.max(u.at - r.int(1, 3 * 365) * DAY, adult);
    if (at < floor || at >= u.at) continue;
    const e = makeEvent(world.counters, at, {
      type: 'UNION_FORMED',
      payload: { a: u.mother, b: u.father },
      participants: [{ id: u.mother, role: 'pareja' }, { id: u.father, role: 'pareja' }],
      causes: [{ state: 'encuentro', weight: 1 }],
    });
    record(e, [u.mother, u.father]);
    unionOf.set(key, e);
  }

  // Nacimientos desde 1900 (R-004: los anteriores quedan solo como referencia).
  for (const id of all) {
    const at = bornOf(id);
    if (at < floor || at >= 0) continue;
    const p = world.citizens.get(id)!;
    const union = unionOf.get(`${p.motherId}+${p.fatherId}`);
    const parents = [p.motherId, p.fatherId].filter((x): x is EntityId => x !== undefined);
    const e = makeEvent(world.counters, at, {
      type: 'CITIZEN_BORN',
      payload: { citizenId: id, placeName: placeName(p.birthplace!) },
      participants: [
        { id, role: 'nacido' },
        ...(p.motherId ? [{ id: p.motherId, role: 'madre' }] : []),
        ...(p.fatherId ? [{ id: p.fatherId, role: 'padre' }] : []),
      ],
      causes: union ? [{ event: union.id, weight: 1 }] : [{ state: 'nacimiento', weight: 1 }],
    });
    record(e, [id, ...parents.filter((x) => at >= bornOf(x))]);
  }

  // Migraciones (R-005): llega al municipio quien nació fuera y vive allí o tuvo allí a un hijo.
  const childrenHere = new Map<EntityId, number>();
  for (const id of all) {
    const p = world.citizens.get(id)!;
    if (p.birthplace !== municipalityId) continue;
    for (const par of [p.motherId, p.fatherId])
      if (par) childrenHere.set(par, Math.min(childrenHere.get(par) ?? 0, bornOf(id)));
  }
  const living = new Set(inp.livingIds);
  for (const id of all) {
    const p = world.citizens.get(id)!;
    if (p.birthplace === municipalityId || (!living.has(id) && !childrenHere.has(id))) continue;
    const r = inp.rng.fork('hist:migration').fork(id);
    const hi = Math.min(childrenHere.get(id) ?? 0, 0) - DAY;
    let lo = Math.max(bornOf(id) + 15 * YEAR, floor, inp.townAt + DAY);
    if (lo > hi) lo = Math.max(bornOf(id) + DAY, floor, inp.townAt + DAY);
    if (lo > hi) continue;
    const fromRural = rural(p.birthplace!);
    const years: { y: number; w: number }[] = [];
    for (let y = clock.yearOf(lo); y <= clock.yearOf(hi); y++) {
      const w = fromRural
        ? inp.history
            .filter((h) => y >= h.startYear && y <= h.endYear)
            .reduce((s, h) => s * MIGRATION_EFFECTS.reduce((m, k) => m * (h.effects[k] ?? 1), 1), 1)
        : 1;
      years.push({ y, w });
    }
    let x = r.next() * years.reduce((s, t) => s + t.w, 0);
    const year = (years.find((t) => (x -= t.w) < 0) ?? years[years.length - 1]!).y;
    const at = Math.min(Math.max(clock.randomDay(r, year), lo), hi);
    const drivers = fromRural ? contextCauses(year, at, MIGRATION_EFFECTS, 0.6) : [];
    const e = makeEvent(world.counters, at, {
      type: 'MIGRATED',
      payload: { citizenId: id, from: placeName(p.birthplace!), to: placeName(municipalityId) },
      participants: [{ id, role: 'migrante' }],
      causes: [...drivers, { state: 'buscar_oportunidades', weight: 0.4 }],
    });
    record(e, [id]);
  }

  // Muertes (R-004): edad media por año de nacimiento; nadie muere antes de sus propios hechos.
  for (const id of inp.ancestorIds) {
    const p = world.citizens.get(id)!;
    const r = inp.rng.fork('hist:deaths').fork(id);
    const b = bornOf(id);
    const by = clock.yearOf(b);
    const lb = Math.max(last.get(id) ?? b, childrenOf(world, all, id, bornOf)) + DAY;
    const sampled = b + Math.round(r.normal(meanDeathAge(P, by), P.deathAgeSd) * YEAR) + r.int(0, 364) * DAY;
    const at = Math.min(Math.max(sampled, lb), Math.max(b + MAX_AGE * YEAR, lb));
    if (at >= 0) continue; // vive fuera del mundo: deathMinute = 0
    death[idNumber(id)] = at;
    if (at < floor) continue;
    const age = Math.floor((at - b) / YEAR);
    const year = clock.yearOf(at);
    let cause = 'natural';
    const causes: CauseRef[] = [{ state: 'edad', value: age, weight: 1 }];
    for (const d of DEATH_EFFECTS) {
      if (!d.applies(age, p.sex!, rural(p.birthplace!))) continue;
      const h = inp.history.find(
        (x) => year >= x.startYear && year <= x.endYear && (x.effects[d.effect] ?? 1) > 1 && (inp.context.get(x.key)?.at ?? 0) <= at,
      );
      if (h && r.chance(attributableShare(h.effects[d.effect]!, d.violent, P.violentDeathShare))) {
        cause = d.cause;
        causes.push({ event: inp.context.get(h.key)!.id, weight: 0.8 });
        break;
      }
    }
    const e = makeEvent(world.counters, at, {
      type: 'CITIZEN_DIED',
      payload: { citizenId: id, age, cause },
      participants: [{ id, role: 'fallecido' }],
      causes,
    });
    record(e, [id]);
  }
  return events;
}

/** Nacimiento del último hijo de una persona (o −∞ si no tiene). */
function childrenOf(world: World, all: readonly EntityId[], id: EntityId, bornOf: (id: EntityId) => number): number {
  let latest = Number.NEGATIVE_INFINITY;
  for (const k of all) {
    const p = world.citizens.get(k)!;
    if (p.motherId === id || p.fatherId === id) latest = Math.max(latest, bornOf(k));
  }
  return latest;
}
