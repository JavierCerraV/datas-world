// Observación como el prototipo (spec 022 v0.4): los viajes para reproducir los trayectos (R-012), los indicadores
// de la barra superior con el avance sin observar (R-013) y lo que completa la ficha (R-014). Solo lee.
import { MINUTES_PER_DAY, beliefTruth, idNumber, topicOf } from '@datas-world/engine';
import type { EntityId, KnowledgeCatalog, World, WorldEvent } from '@datas-world/engine';
import { movesSince } from '@datas-world/persistence';
import type { Movement } from '@datas-world/persistence';
import type { FastifyInstance } from 'fastify';
import type { WorldReader } from './reader.ts';
import { dateOf, living, nameOf } from './views.ts';

const YEAR = 365 * MINUTES_PER_DAY;
const WORKING = new Set(['formal', 'informal', 'independent']);

export interface Stats {
  population: number;
  households: number;
  districts: number;
  employedPct: number;
  moodMean: number;
  eventsToday: number;
  advance: { from: number; to: number } | null;
}

/**
 * R-013: indicadores del prototipo. Con empleo: de las personas de 18 a 64 años que no estudian ni están
 * pensionadas, las que tienen trabajo formal, informal o por cuenta propia.
 */
export function statsOf(w: World, eventsToday: number, advance: Stats['advance']): Stats {
  const people = living(w);
  const birth = w.components.i32['demo.birthMinute'];
  const mood = w.components.f32['state.mood'];
  const working = people.filter((c) => {
    const age = birth ? (w.now - birth[idNumber(c.id)]!) / YEAR : 30;
    const occ = c.occupation;
    return age >= 18 && age < 65 && !(occ?.kind === 'none' && (occ.reason === 'student' || occ.reason === 'pensioned'));
  });
  const employed = working.filter((c) => WORKING.has(c.occupation?.kind ?? ''));
  const households = [...w.households.values()].filter((h) => h.memberIds.some((m) => w.citizens.get(m)?.status === 'active' && !w.citizens.get(m)?.ancestor));
  return {
    population: people.length,
    households: households.length,
    districts: [...w.places.values()].filter((p) => p.kind === 'territorio.barrio').length,
    employedPct: working.length ? Math.round((employed.length / working.length) * 1000) / 1000 : 0,
    moodMean: people.length && mood ? Math.round((people.reduce((s, c) => s + mood[idNumber(c.id)]!, 0) / people.length) * 1000) / 1000 : 0,
    eventsToday,
    advance,
  };
}

/** R-014: lo que otras personas creen de `id`, por tema: si es verdad y quién lo cree (solo para quien observa). */
export function aboutMe(w: World, id: EntityId, eventsOfId: readonly WorldEvent[], cat: KnowledgeCatalog) {
  const byTopic = new Map<string, { topic: string; true: boolean; holders: { id: string; name: string; credibility: number }[] }>();
  for (const c of living(w)) {
    if (c.id === id) continue;
    for (const b of c.beliefs ?? []) {
      if (b.about !== id) continue;
      const entry = byTopic.get(b.predicate) ?? {
        topic: topicOf(cat, b.predicate)?.name ?? b.predicate.replace(/_/g, ' '),
        true: beliefTruth(b, eventsOfId, cat),
        holders: [],
      };
      entry.holders.push({ id: c.id, name: nameOf(w, c.id) ?? c.id, credibility: b.credibility });
      byTopic.set(b.predicate, entry);
    }
  }
  return [...byTopic.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([predicate, e]) => ({ predicate, ...e }));
}

/** R-014: vivienda, barrio y hasta cuándo dura lo que hace. */
export function whereAndUntil(w: World, id: EntityId) {
  const c = w.citizens.get(id);
  const h = c?.householdId ? w.households.get(c.householdId) : undefined;
  const home = h ? w.places.get(h.dwellingId) : undefined;
  const building = home?.parentId ? w.places.get(home.parentId) : undefined;
  const districtId = home?.districtId ?? building?.districtId;
  const until = w.components.i32['act.until']?.[idNumber(id)] ?? 0;
  return {
    home: home ? { id: home.id, name: building ? `${home.name}, ${building.name}` : home.name } : null,
    district: districtId ? w.places.get(districtId)?.name ?? null : null,
    until: until > w.now ? dateOf(w, until) : null,
  };
}

export function registerObserveRoutes(app: FastifyInstance, reader: WorldReader): void {
  // R-012: viajes que llegan después de `since` (los que salen después y los que siguen en curso).
  app.get('/api/moves', async (req, reply) => {
    const since = Number((req.query as { since?: string }).since ?? reader.world.now - 90);
    if (!Number.isSafeInteger(since)) return reply.code(400).send({ error: 'since inválido' });
    return movesSince(reader.db, since);
  });

  app.get('/api/stats', async () => {
    const w = reader.world;
    const dayStart = Math.floor(w.now / MINUTES_PER_DAY) * MINUTES_PER_DAY;
    const today = (reader.db.prepare('SELECT COUNT(*) AS n FROM events WHERE at >= ?').get(dayStart) as { n: number }).n;
    const adv = reader.db.prepare("SELECT value FROM meta WHERE key = 'advance'").get() as { value: string } | undefined;
    return statsOf(w, today, adv ? (JSON.parse(adv.value) as Stats['advance']) : null);
  });
}

/** R-012: los viajes para el `tick` del SSE: los que llegan después del minuto del tick anterior. */
export const movesForTick = (reader: WorldReader, prevNow: number): Movement[] => movesSince(reader.db, prevNow);
