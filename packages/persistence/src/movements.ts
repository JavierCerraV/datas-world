// Movimientos para el visor (spec 027 R-013): cada viaje que empieza, anotado tick a tick por el worker y guardado
// con el siguiente flush. Dato de observación: se deriva del estado, no entra en el stateHash y el motor no lo lee.
import { MINUTES_PER_DAY, MODES, formatId } from '@datas-world/engine';
import type { World } from '@datas-world/engine';
import type { Db } from './db.ts';
import { MOVES_KEEP_DAYS } from './params.ts';

export interface Movement {
  citizenId: string;
  departAt: number;
  arriveAt: number;
  from: string;
  to: string;
  mode: string;
}

/**
 * Detecta los viajes nuevos mirando las columnas `trip.*` del mundo: un viaje es nuevo si su minuto de salida no
 * es el último visto para esa persona. Hay que llamarla tras cada tick; un viaje dura al menos hasta el tick
 * siguiente (la llegada se comprueba después), así que ninguno se pierde.
 */
export class TripTracker {
  #seen = new Map<number, number>();

  scan(world: World): Movement[] {
    const i = world.components.i32;
    const u = world.components.u8;
    const to = i['trip.to'];
    const dep = i['trip.departAt'];
    if (!to || !dep) return [];
    const out: Movement[] = [];
    for (const c of world.citizens.values()) {
      if (c.status !== 'active' || c.ancestor) continue;
      const row = Number(c.id.slice(4));
      if (!(to[row]! > 0)) continue;
      const at = dep[row]!;
      if (this.#seen.get(row) === at) continue;
      this.#seen.set(row, at);
      out.push({
        citizenId: c.id,
        departAt: at,
        arriveAt: i['trip.arriveAt']![row]!,
        from: formatId('PLC', i['trip.from']![row]!),
        to: formatId('PLC', to[row]!),
        mode: MODES[(u['trip.mode']?.[row] ?? 1) - 1] ?? 'walk',
      });
    }
    return out;
  }
}

/** Guarda los viajes y borra los que llegaron hace más de MOVES_KEEP_DAYS días (dentro de la transacción del flush). */
export function saveMoves(db: Db, moves: readonly Movement[], now: number): void {
  if (!hasMovements(db)) return;
  const put = db.prepare('INSERT OR REPLACE INTO movements (citizen_id, depart_at, arrive_at, from_place, to_place, mode) VALUES (?, ?, ?, ?, ?, ?)');
  for (const m of moves) put.run(Number(m.citizenId.slice(4)), m.departAt, m.arriveAt, Number(m.from.slice(4)), Number(m.to.slice(4)), m.mode);
  db.prepare('DELETE FROM movements WHERE arrive_at < ?').run(now - MOVES_KEEP_DAYS * MINUTES_PER_DAY);
}

const hasMovements = (db: Db) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'movements'").get();

/** 022 R-012: los viajes que llegan después de `since` (los que salen después y los que siguen en curso), por salida. */
export function movesSince(db: Db, since: number): Movement[] {
  if (!hasMovements(db)) return [];
  const rows = db.prepare('SELECT citizen_id, depart_at, arrive_at, from_place, to_place, mode FROM movements WHERE arrive_at > ? ORDER BY depart_at, citizen_id').all(since) as
    { citizen_id: number; depart_at: number; arrive_at: number; from_place: number; to_place: number; mode: string }[];
  return rows.map((r) => ({ citizenId: formatId('CIT', r.citizen_id), departAt: r.depart_at, arriveAt: r.arrive_at, from: formatId('PLC', r.from_place), to: formatId('PLC', r.to_place), mode: r.mode }));
}
