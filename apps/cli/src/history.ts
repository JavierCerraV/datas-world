// world:history y citizen:report (spec 030 R-008): la historia y la vida de cada persona, siempre desde el
// registro de eventos y el estado persistido, nunca inventadas al consultar (CLAUDE.md §8).
import { parseArgs } from 'node:util';
import { daysFromCivil, eventText, idNumber, parseEpoch } from '@datas-world/engine';
import type { CauseRef, Citizen, EntityId, World, WorldEvent } from '@datas-world/engine';
import { loadCatalog } from '@datas-world/generators';
import { WorldRepository, eventsById, openReadonly, queryEvents } from '@datas-world/persistence';
import type { Db } from '@datas-world/persistence';
import { DEFAULT_DB, UsageError, dayOf, nameOf, toInt, withDb, withNames } from './common.ts';
import type { Io } from './common.ts';
import { fichaLines, temperamentLines } from './ficha.ts';

/** Minuto del 1 de enero de `year` en el mundo. */
const yearStart = (world: World, year: number): number => {
  const e = parseEpoch(world.config.epoch);
  return (daysFromCivil(year, 1, 1) - daysFromCivil(e.year, e.month, e.day)) * 1440;
};

/** Texto breve de las causas: nombre del hecho histórico, tipo del evento causante o estado. */
function causesText(world: World, db: Db, causes: readonly CauseRef[]): string {
  const ids = causes.filter((c): c is { event: EntityId; weight: number } => 'event' in c).map((c) => c.event);
  const byId = new Map(eventsById(db, ids).map((e) => [e.id, e]));
  return causes
    .map((c) => {
      if (!('event' in c)) return c.state;
      const e = byId.get(c.event);
      if (!e) return c.event;
      return e.type === 'HISTORICAL_CONTEXT' ? (e.payload as { name: string }).name : withNames(world, eventText(e));
    })
    .join('; ');
}

const line = (world: World, db: Db, e: WorldEvent, causes: boolean) =>
  `${dayOf(e.at, world.config.epoch)}  ${withNames(world, eventText(e))}${causes && e.causes.length ? `  ← ${causesText(world, db, e.causes)}` : ''}`;

export function worldHistory(args: string[], io: Io): void {
  const { values: v } = parseArgs({
    args,
    allowNegative: true, // --no-causes
    options: {
      from: { type: 'string' },
      to: { type: 'string' },
      type: { type: 'string' },
      citizen: { type: 'string' },
      place: { type: 'string' },
      limit: { type: 'string', default: '500' },
      causes: { type: 'boolean', default: true },
      db: { type: 'string', default: DEFAULT_DB },
    },
  });
  withDb(openReadonly(v.db), (db) => {
    const world = new WorldRepository(db).loadWorld();
    const events = queryEvents(db, {
      ...(v.from !== undefined ? { from: yearStart(world, toInt('from', v.from)) } : {}),
      ...(v.to !== undefined ? { to: yearStart(world, toInt('to', v.to) + 1) } : {}),
      ...(v.type !== undefined ? { types: v.type.split(',').map((t) => t.trim().toUpperCase()) } : {}),
      ...(v.citizen !== undefined ? { participant: v.citizen as EntityId } : {}),
      ...(v.place !== undefined ? { place: v.place as EntityId } : {}),
      limit: toInt('limit', v.limit, 1),
    });
    for (const e of events) io.out(line(world, db, e, v.causes));
    io.out(`(${events.length} eventos)`);
  });
}

export function citizenReport(args: string[], io: Io): void {
  const { values: v, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { db: { type: 'string', default: DEFAULT_DB } },
  });
  const id = positionals[0] as EntityId | undefined;
  if (!id || !/^CIT-\d+$/.test(id)) throw new UsageError('Uso: citizen:report CIT-000123');
  withDb(openReadonly(v.db), (db) => {
    const world = new WorldRepository(db).loadWorld();
    const c = world.citizens.get(id);
    if (!c) throw new UsageError(`No existe ${id}`);
    for (const l of citizenLines(world, db, c)) io.out(l);
  });
}

const birthplaces = () => new Map(loadCatalog('birthplaces').entries.map((e) => [e.key, e.name]));

/** Ficha, árbol (padres, abuelos y bisabuelos) y línea de vida de una persona. */
export function citizenLines(world: World, db: Db, c: Citizen): string[] {
  const epoch = world.config.epoch;
  const col = (name: string, id: EntityId) =>
    (world.components.i32[name] ?? world.components.u8[name])?.[idNumber(id)] ?? 0;
  const places = birthplaces();
  const bornText = (id: EntityId) => {
    const p = world.citizens.get(id)!;
    const d = col('demo.deathMinute', id);
    const from = p.birthplace ? (places.get(p.birthplace) ?? world.places.get(p.birthplace as EntityId)?.name ?? p.birthplace) : '?';
    const life = `n. ${dayOf(col('demo.birthMinute', id), epoch)} en ${from}`;
    if (d !== 0) return `${life} · m. ${dayOf(d, epoch)}`;
    return p.ancestor ? `${life} · vive fuera del mundo` : `${life} · vive en ${world.config.name}`;
  };
  const who = (id: EntityId | undefined) => (id ? `${nameOf(world, id)} (${id}) — ${bornText(id)}` : 'desconocido');
  const out = [`${nameOf(world, c.id)} (${c.id}) — ${bornText(c.id)}`];
  if (c.householdId) {
    const h = world.households.get(c.householdId)!;
    const dwelling = world.places.get(h.dwellingId);
    const district = dwelling?.districtId ? world.places.get(dwelling.districtId)?.name : undefined;
    out.push(`  Hogar ${h.id} (${h.template}), ${dwelling?.name ?? h.dwellingId}${district ? `, ${district}` : ''}`);
  }
  const occ = c.occupation;
  if (occ) {
    const text =
      occ.kind === 'formal'
        ? `empleo formal en ${nameOf(world, occ.orgId)}`
        : occ.kind === 'none'
          ? `sin ocupación (${occ.reason})`
          : `${occ.kind === 'informal' ? 'trabajo informal' : 'independiente'}: ${occ.trade}`;
    out.push(`  Ocupación: ${text}`);
  }
  out.push('', 'Familia');
  const tree = (label: string, id: EntityId | undefined, depth: number) => {
    out.push(`${'  '.repeat(depth)}${label}: ${who(id)}`);
    if (!id || depth >= 3) return;
    const p = world.citizens.get(id)!;
    if (p.motherId === undefined && p.fatherId === undefined) return;
    tree(depth === 1 ? 'abuela' : 'bisabuela', p.motherId, depth + 1);
    tree(depth === 1 ? 'abuelo' : 'bisabuelo', p.fatherId, depth + 1);
  };
  tree('madre', c.motherId, 1);
  tree('padre', c.fatherId, 1);
  const children = [...world.citizens.values()]
    .filter((k) => k.motherId === c.id || k.fatherId === c.id)
    .sort((a, b) => col('demo.birthMinute', a.id) - col('demo.birthMinute', b.id));
  for (const k of children) out.push(`  hijo/a: ${who(k.id)}`);
  out.push(...temperamentLines(world, c)); // temperamento como descriptor (009 v1.0 R-003)
  out.push(...fichaLines(world, c)); // fichas de salud (031) y esparcimiento (032)
  out.push('', 'Línea de vida');
  for (const e of queryEvents(db, { participant: c.id, limit: 100_000 })) out.push(`  ${line(world, db, e, true)}`);
  return out;
}
