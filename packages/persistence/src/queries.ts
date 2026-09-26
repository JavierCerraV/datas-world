// Consultas de solo lectura sobre el registro de eventos (spec 027; consulta de la historia, 030 R-008).
import type { CauseRef, EntityId, EventOrigin, EventType, WorldEvent } from '@datas-world/engine';
import type { Db } from './db.ts';

export interface EventRow {
  seq: number;
  id: string;
  type: string;
  at: number;
  importance: number;
  payload: string;
  causes: string;
  origin: string;
  place_id: string | null;
}

/** Convierte filas de `events` en eventos, con sus participantes ordenados por id. */
export function rowsToEvents(db: Db, rows: readonly EventRow[]): WorldEvent[] {
  const parts = db.prepare('SELECT entity_id, role FROM event_participants WHERE event_seq = ? ORDER BY entity_id');
  return rows.map((r) => ({
    id: r.id as EntityId,
    type: r.type as EventType,
    at: r.at,
    participants: (parts.all(r.seq) as { entity_id: EntityId; role: string }[]).map((p) => ({
      id: p.entity_id,
      role: p.role,
    })),
    ...(r.place_id !== null ? { placeId: r.place_id as EntityId } : {}),
    importance: r.importance,
    payload: JSON.parse(r.payload) as unknown,
    causes: JSON.parse(r.causes) as CauseRef[],
    origin: r.origin as EventOrigin,
  }));
}

export interface EventQuery {
  /** Minuto mínimo (incluido). */
  from?: number;
  /** Minuto máximo (excluido). */
  to?: number;
  types?: readonly string[];
  /** Eventos en los que participa esta entidad. */
  participant?: EntityId;
  /** Eventos de un lugar u organización: `place_id` o `placeId`/`orgId` del payload. */
  place?: EntityId;
  /** Solo los eventos registrados después de este id (orden de inserción; SSE, 022 R-003). */
  afterId?: EntityId;
  /** Los `limit` más recientes (en orden cronológico) en lugar de los primeros. */
  latest?: boolean;
  limit?: number;
}

/** Eventos que cumplen el filtro, en orden cronológico (`at`, luego `seq`). */
export function queryEvents(db: Db, q: EventQuery = {}): WorldEvent[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (q.from !== undefined) {
    where.push('at >= ?');
    args.push(q.from);
  }
  if (q.to !== undefined) {
    where.push('at < ?');
    args.push(q.to);
  }
  if (q.types && q.types.length > 0) {
    where.push(`type IN (${q.types.map(() => '?').join(', ')})`);
    args.push(...q.types);
  }
  if (q.participant !== undefined) {
    where.push('seq IN (SELECT event_seq FROM event_participants WHERE entity_id = ?)');
    args.push(q.participant);
  }
  if (q.place !== undefined) {
    where.push("(place_id = ? OR json_extract(payload, '$.placeId') = ? OR json_extract(payload, '$.orgId') = ?)");
    args.push(q.place, q.place, q.place);
  }
  if (q.afterId !== undefined) {
    where.push('seq > COALESCE((SELECT seq FROM events WHERE id = ?), 0)');
    args.push(q.afterId);
  }
  const order = q.latest ? 'ORDER BY seq DESC' : 'ORDER BY at, seq';
  const sql = `SELECT * FROM events${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ${order} LIMIT ?`;
  const rows = db.prepare(sql).all(...args, q.limit ?? 10_000) as EventRow[];
  return rowsToEvents(db, q.latest ? rows.reverse() : rows);
}

/** Eventos por id, en el orden pedido; los que no existen se omiten. */
export function eventsById(db: Db, ids: readonly EntityId[]): WorldEvent[] {
  const st = db.prepare('SELECT * FROM events WHERE id = ?');
  const rows = ids.map((id) => st.get(id) as EventRow | undefined).filter((r): r is EventRow => r !== undefined);
  return rowsToEvents(db, rows);
}
