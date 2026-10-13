// `pnpm cli study:candidates` (spec 047 R-002): a quién tiene sentido invitar a un estudio. Lista a las personas con
// episodios de rumia y cuánto margen tienen para cambiar en lo que el protocolo mueve. Solo lee el mundo.
import { parseArgs } from 'node:util';
import { AVOIDANCE_RESPONSES, MINUTES_PER_DAY, hasValue } from '@datas-world/engine';
import type { EntityId, FunctionStore } from '@datas-world/engine';
import { WorldRepository, openReadonly, queryEvents } from '@datas-world/persistence';
import { DEFAULT_DB, nameOf, withDb } from './common.ts';
import type { Io } from './common.ts';

/** Fuerzas de partida del motor (039 §8), para quien aún no tiene historia de esa respuesta. */
const SELF_W0 = 0.1, AVOIDANCE_W0 = 0.2;
/** Con el «Yo» por encima de esto, el protocolo ya casi no puede subirlo [M]. */
export const SELF_CEILING = 0.8;

export interface Candidate {
  id: string;
  name: string;
  self: number;
  avoidance: number;
  hasValues: boolean;
  episodes: number;
  /** Días desde su último episodio. */
  lastDays: number;
  endings: Record<string, number>;
  /** Tiene margen para cambiar: el «Yo» no está en el techo. */
  room: boolean;
}

export function candidatesOf(db: string): Candidate[] {
  return withDb(openReadonly(db), (d) => {
    const world = new WorldRepository(d).loadWorld();
    const by = new Map<string, { at: number; ended: string }[]>();
    for (const e of queryEvents(d, { types: ['PNR_EPISODE'], limit: 1_000_000 })) {
      const p = e.payload as { citizenId: string; ended: string };
      (by.get(p.citizenId) ?? by.set(p.citizenId, []).get(p.citizenId)!).push({ at: e.at, ended: p.ended });
    }
    const out: Candidate[] = [];
    for (const [id, eps] of [...by].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const c = world.citizens.get(id as EntityId);
      if (c?.status !== 'active') continue;
      const store = c.functions as FunctionStore | undefined;
      const w = (r: string, w0: number) => store?.r.find((x) => x.r === r && x.c === '')?.w ?? w0;
      const self = w('yo.enmarque', SELF_W0);
      const endings: Record<string, number> = {};
      for (const e of eps) endings[e.ended] = (endings[e.ended] ?? 0) + 1;
      out.push({
        id, name: nameOf(world, id), self, avoidance: AVOIDANCE_RESPONSES.reduce((a, r) => a + w(r, AVOIDANCE_W0), 0) / AVOIDANCE_RESPONSES.length,
        hasValues: store ? hasValue(store) : false, episodes: eps.length, lastDays: Math.round((world.now - Math.max(...eps.map((e) => e.at))) / MINUTES_PER_DAY), endings,
        room: self < SELF_CEILING,
      });
    }
    // Primero quien tiene margen; dentro, quien rumió más recientemente.
    return out.sort((a, b) => Number(b.room) - Number(a.room) || a.lastDays - b.lastDays || (a.id < b.id ? -1 : 1));
  });
}

export function studyCandidates(args: string[], io: Io): void {
  const { values: v } = parseArgs({ args, options: { db: { type: 'string', default: DEFAULT_DB }, json: { type: 'boolean', default: false } } });
  const list = candidatesOf(v.db!);
  if (v.json) return io.out(JSON.stringify(list, null, 2));
  io.out(`Personas con episodios de rumia: ${list.length}. Con margen para cambiar («Yo» por debajo de ${SELF_CEILING}): ${list.filter((c) => c.room).length}.`);
  io.out('id          nombre                        «Yo»  evitar  valores  episodios  último (días)  cómo terminaron');
  for (const c of list)
    io.out(`${c.id}  ${c.name.padEnd(28).slice(0, 28)}  ${c.self.toFixed(2)}  ${c.avoidance.toFixed(2)}    ${c.hasValues ? 'sí' : 'no'}       ${String(c.episodes).padStart(3)}        ${String(c.lastDays).padStart(4)}         ${Object.entries(c.endings).map(([k, n]) => `${k} ${n}`).join(', ')}${c.room ? '' : '   (sin margen)'}`);
}
