// Repositorio del mundo: estado actual, registro de eventos, entradas e instantáneas (spec 027).
import {
  columns,
  deserializeWorld,
  idKind,
  idNumber,
  isCapability,
  serializeWorld,
  stateHash,
} from '@datas-world/engine';
import type {
  BaseEntity,
  CauseRef,
  ColumnType,
  EntityId,
  EventOrigin,
  EventType,
  ExternalInput,
  World,
  WorldEvent,
  WorldSnapshot,
} from '@datas-world/engine';
import { columnFromLE, columnToLE, decodeSnapshot, encodeSnapshot } from './codec.ts';
import type { Db } from './db.ts';

export interface FlushBatch {
  world: World;
  /** Eventos nuevos, en orden de id (como los entrega `Runner.drainEvents`). */
  events?: readonly WorldEvent[];
  /** Entradas externas aplicadas desde el último flush. */
  inputs?: readonly ExternalInput[];
}

const ENTITY_LISTS = ['citizens', 'households', 'organizations', 'places', 'objects'] as const;
type EntityList = (typeof ENTITY_LISTS)[number];
const LIST_OF_KIND: Record<string, EntityList> = {
  CIT: 'citizens',
  HOU: 'households',
  ORG: 'organizations',
  PLC: 'places',
  OBJ: 'objects',
};

interface EventRow {
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

/**
 * Único escritor de la base (R-001). Recuerda lo último que escribió de cada entidad y columna para
 * reescribir solo lo que cambió (R-008): el motor no marca cambios, así que se compara con lo escrito.
 */
export class WorldRepository {
  readonly db: Db;
  #lastSeq: number;
  #entities = new Map<EntityId, string>();
  #columns = new Map<string, Buffer>();
  /**
   * Sentencias preparadas una vez. Prepararlas en cada flush deja miles de sentencias nativas esperando
   * al recolector: en 365 días (8 760 flush) el RSS pasaba de 480 MB.
   */
  readonly #st;
  readonly #flushTx;

  constructor(db: Db) {
    this.db = db;
    const row = db.prepare('SELECT MAX(seq) AS s FROM events').get() as { s: number | null };
    this.#lastSeq = row.s ?? 0;
    this.#st = {
      getMeta: db.prepare('SELECT value FROM meta WHERE key = ?'),
      setMeta: db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)'),
      event: db.prepare(
        `INSERT INTO events (seq, id, type, at, importance, payload, causes, origin, place_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ),
      participant: db.prepare('INSERT INTO event_participants (event_seq, entity_id, role) VALUES (?, ?, ?)'),
      input: db.prepare('INSERT INTO external_inputs (at, seq, kind, payload) VALUES (?, ?, ?, ?)'),
      entity: db.prepare('INSERT OR REPLACE INTO entities (id, kind, status, data, updated_at) VALUES (?, ?, ?, ?, ?)'),
      column: db.prepare(
        'INSERT OR REPLACE INTO components (name, type, length, initial, data, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ),
    };
    this.#flushTx = db.transaction((batch: FlushBatch) => {
      const seq = this.#appendEvents(batch.events ?? []);
      this.#appendInputs(batch.inputs ?? []);
      return { lastSeq: seq, written: this.#saveState(batch.world) };
    });
  }

  get lastSeq(): number {
    return this.#lastSeq;
  }

  hasWorld(): boolean {
    return this.#meta('world_id') !== undefined;
  }

  /** R-002: estado modificado + eventos + participantes + entradas, en una sola transacción. */
  flush(batch: FlushBatch): void {
    // Los cachés solo avanzan si la transacción se confirma.
    const { lastSeq, written } = this.#flushTx(batch);
    this.#lastSeq = lastSeq;
    for (const [id, json] of written.entities) this.#entities.set(id, json);
    for (const [name, bytes] of written.columns) this.#columns.set(name, bytes);
  }

  #meta(key: string): string | undefined {
    return (this.#st.getMeta.get(key) as { value: string } | undefined)?.value;
  }

  #setMeta(key: string, value: string): void {
    this.#st.setMeta.run(key, value);
  }

  /** Devuelve el nuevo último `seq`. */
  #appendEvents(events: readonly WorldEvent[]): number {
    const { event: ins, participant: part } = this.#st;
    let last = this.#lastSeq;
    for (const e of events) {
      const seq = idNumber(e.id);
      if (idKind(e.id) !== 'EVT') throw new Error(`${e.id} no es un id de evento`);
      if (seq <= last) throw new Error(`INV-001: ${e.id} no es posterior al último evento guardado (${last})`);
      ins.run(
        seq,
        e.id,
        e.type,
        e.at,
        e.importance,
        JSON.stringify(e.payload),
        JSON.stringify(e.causes),
        e.origin,
        e.placeId ?? null,
      );
      for (const p of e.participants) part.run(seq, p.id, p.role);
      last = seq;
    }
    return last;
  }

  #appendInputs(inputs: readonly ExternalInput[]): void {
    for (const i of inputs) this.#st.input.run(i.at, i.seq, i.kind, JSON.stringify(i.payload));
  }

  #saveState(world: World): { entities: [EntityId, string][]; columns: [string, Buffer][] } {
    const written = { entities: [] as [EntityId, string][], columns: [] as [string, Buffer][] };
    const storedId = this.#meta('world_id');
    if (storedId !== undefined && storedId !== world.id)
      throw new Error(`La base es del mundo ${storedId}, no de ${world.id}`);
    if (storedId === undefined) {
      this.#setMeta('world_id', world.id);
      this.#setMeta('config', JSON.stringify(world.config));
      this.#setMeta('engine_version', world.config.engineVersion);
    }
    this.#setMeta('now', String(world.now));
    this.#setMeta('status', world.status);
    this.#setMeta('counters', JSON.stringify(world.counters));
    this.#setMeta('capabilities', JSON.stringify(world.capabilities)); // ya en orden canónico (R-009)
    this.#setMeta('scheduler', JSON.stringify(serializeWorld(world).scheduler));
    this.#setMeta('state_hash', stateHash(world));

    const upEntity = this.#st.entity;
    for (const list of ENTITY_LISTS) {
      for (const [id, entity] of [...world[list]].sort(([a], [b]) => (a < b ? -1 : 1))) {
        const json = JSON.stringify(entity);
        if (this.#entities.get(id) === json) continue;
        upEntity.run(id, idKind(id), entity.status, json, world.now);
        written.entities.push([id, json]);
      }
    }

    const used = world.counters.CIT + 1;
    const upCol = this.#st.column;
    for (const { type, name, data } of columns(world.components)) {
      const bytes = columnToLE(data.subarray(0, used));
      const prev = this.#columns.get(name);
      if (prev && prev.equals(bytes)) continue;
      upCol.run(name, type, used, world.components.initial[name] ?? 0, bytes, world.now);
      written.columns.push([name, Buffer.from(bytes)]); // copia: `bytes` puede ser una vista de la columna viva
    }
    return written;
  }

  /** Reconstruye el mundo desde el estado actual y comprueba que su hash es el guardado. */
  loadWorld(): World {
    const id = this.#meta('world_id');
    if (id === undefined) throw new Error('La base no contiene ningún mundo');
    const capabilities = JSON.parse(this.#meta('capabilities')!) as unknown[];
    const unknown = capabilities.filter((c) => typeof c !== 'string' || !isCapability(c));
    if (unknown.length > 0) {
      throw new Error(`R-009: el mundo usa capacidades que este motor no conoce: ${unknown.join(', ')}`);
    }
    const snap: WorldSnapshot = {
      id: id as WorldSnapshot['id'],
      config: JSON.parse(this.#meta('config')!),
      now: Number(this.#meta('now')),
      status: this.#meta('status') as WorldSnapshot['status'],
      counters: JSON.parse(this.#meta('counters')!),
      capabilities: capabilities as WorldSnapshot['capabilities'],
      citizens: [],
      households: [],
      organizations: [],
      places: [],
      objects: [],
      components: [],
      scheduler: JSON.parse(this.#meta('scheduler')!),
    };
    const rows = this.db.prepare('SELECT id, kind, data FROM entities ORDER BY id').all() as {
      id: EntityId;
      kind: string;
      data: string;
    }[];
    for (const r of rows) {
      const list = LIST_OF_KIND[r.kind];
      if (!list) throw new Error(`Entidad ${r.id} de tipo desconocido ${r.kind}`);
      snap[list].push(JSON.parse(r.data) as BaseEntity);
      this.#entities.set(r.id, r.data);
    }
    const cols = this.db.prepare('SELECT name, type, length, initial, data FROM components ORDER BY name').all() as {
      name: string;
      type: ColumnType;
      length: number;
      initial: number;
      data: Buffer;
    }[];
    for (const c of cols) {
      snap.components.push({
        type: c.type,
        name: c.name,
        initial: c.initial,
        rows: Array.from(columnFromLE(c.type, c.data, c.length)),
      });
      this.#columns.set(c.name, Buffer.from(c.data));
    }
    const world = deserializeWorld(snap);
    const expected = this.#meta('state_hash');
    const actual = stateHash(world);
    if (actual !== expected)
      throw new Error(`El estado cargado no coincide con el guardado (hash ${actual} ≠ ${expected})`);
    return world;
  }

  /** R-004: instantánea completa comprimida en el minuto actual. Devuelve su hash. */
  saveSnapshot(world: World): string {
    const hash = stateHash(world);
    this.db
      .prepare('INSERT OR REPLACE INTO snapshots (at, hash, data) VALUES (?, ?, ?)')
      .run(world.now, hash, encodeSnapshot(world));
    return hash;
  }

  /** Última instantánea en o antes de `at` (por defecto, la más reciente), con su hash verificado. */
  loadSnapshot(at = Number.MAX_SAFE_INTEGER): World | null {
    const row = this.db
      .prepare('SELECT at, hash, data FROM snapshots WHERE at <= ? ORDER BY at DESC LIMIT 1')
      .get(at) as { at: number; hash: string; data: Buffer } | undefined;
    if (!row) return null;
    const world = decodeSnapshot(row.data);
    if (stateHash(world) !== row.hash) throw new Error(`La instantánea del minuto ${row.at} está dañada`);
    return world;
  }

  /** Eventos con `seq > afterSeq`, en orden. Los participantes salen ordenados por id. */
  readEvents(afterSeq = 0, limit = 10_000): WorldEvent[] {
    const rows = this.db
      .prepare('SELECT * FROM events WHERE seq > ? ORDER BY seq LIMIT ?')
      .all(afterSeq, limit) as EventRow[];
    const parts = this.db.prepare(
      'SELECT entity_id, role FROM event_participants WHERE event_seq = ? ORDER BY entity_id',
    );
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

  /** Número de eventos guardados, en total o de un tipo. */
  countEvents(type?: EventType): number {
    const row = (
      type === undefined
        ? this.db.prepare('SELECT COUNT(*) AS n FROM events').get()
        : this.db.prepare('SELECT COUNT(*) AS n FROM events WHERE type = ?').get(type)
    ) as { n: number };
    return row.n;
  }

  countSnapshots(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM snapshots').get() as { n: number }).n;
  }

  /** Última entrada externa registrada, para continuar su numeración (`Runner.continueInputsAfter`). */
  lastInput(): { at: number; seq: number } | null {
    const row = this.db.prepare('SELECT at, seq FROM external_inputs ORDER BY at DESC, seq DESC LIMIT 1').get() as
      { at: number; seq: number } | undefined;
    return row ?? null;
  }

  readInputs(): ExternalInput[] {
    const rows = this.db.prepare('SELECT at, seq, kind, payload FROM external_inputs ORDER BY at, seq').all() as {
      at: number;
      seq: number;
      kind: string;
      payload: string;
    }[];
    return rows.map((r) => ({ at: r.at, seq: r.seq, kind: r.kind, payload: JSON.parse(r.payload) as unknown }));
  }
}
