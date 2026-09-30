// Días pasados (spec 022 R-009): la línea temporal del visor. Las posiciones y la ficha de una persona tal como
// estaban un día, leídas de la instantánea de ese día (027 R-004). Solo lectura: no toca el mundo del presente.
import { MINUTES_PER_DAY } from '@datas-world/engine';
import type { EntityId, World } from '@datas-world/engine';
import { WorldRepository, queryEvents } from '@datas-world/persistence';
import type { FastifyInstance } from 'fastify';
import type { WorldReader } from './reader.ts';
import { citizenDetail, dateOf, positions } from './views.ts';

/** [M] Instantáneas decodificadas que se guardan en memoria (cada una es el mundo entero). */
export const DAY_CACHE = 2;

export function registerDayRoutes(app: FastifyInstance, reader: WorldReader): void {
  const cache = new Map<number, World>();
  /** El mundo del día `day` (su instantánea), guardando las `DAY_CACHE` últimas pedidas. */
  const worldOf = (day: number): World | undefined => {
    const hit = cache.get(day);
    if (hit) {
      cache.delete(day);
      cache.set(day, hit);
      return hit;
    }
    const at = day * MINUTES_PER_DAY;
    const repo = new WorldRepository(reader.db);
    if (!repo.snapshotTimes().includes(at)) return undefined;
    const w = repo.loadSnapshot(at);
    if (!w) return undefined;
    cache.set(day, w);
    while (cache.size > DAY_CACHE) cache.delete(cache.keys().next().value!);
    return w;
  };
  const dayOf = (raw: unknown) => (typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : Number.NaN);

  app.get('/api/days', async () => {
    const w = reader.world;
    const days = new WorldRepository(reader.db).snapshotTimes().filter((at) => at % MINUTES_PER_DAY === 0).map((at) => ({ day: at / MINUTES_PER_DAY, date: dateOf(w, at).slice(0, 10) }));
    return { today: Math.floor(w.now / MINUTES_PER_DAY), days };
  });

  app.get('/api/days/:day/citizens', async (req, reply) => {
    const w = worldOf(dayOf((req.params as { day?: string }).day));
    return w ? positions(w) : reply.code(404).send({ error: 'no hay instantánea de ese día' });
  });

  app.get('/api/days/:day/citizens/:id', async (req, reply) => {
    const { day, id } = req.params as { day?: string; id?: string };
    if (!id || !/^CIT-\d+$/.test(id)) return reply.code(400).send({ error: 'id inválido' });
    const w = worldOf(dayOf(day));
    if (!w) return reply.code(404).send({ error: 'no hay instantánea de ese día' });
    const events = queryEvents(reader.db, { participant: id as EntityId, to: w.now, latest: true, limit: 20 });
    const d = citizenDetail(w, id as EntityId, events);
    return d ?? reply.code(404).send({ error: 'no existe' });
  });
}
