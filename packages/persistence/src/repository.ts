// Repositorio del mundo: estado actual, registro de eventos, entradas e instantáneas (spec 027).
import {
  columns,
  deserializeWorld,
  geoToData,
  idKind,
  idNumber,
  isCapability,
  sortedItems,
  stateHash,
} from '@datas-world/engine';
import type {
  BaseEntity,
  ColumnType,
  EntityId,
  EventType,
  ExternalInput,
  GeoMapData,
  World,
  WorldEvent,
  WorldSnapshot,
} from '@datas-world/engine';
import { columnFromLE, columnToLE, decodeSnapshot, encodeSnapshot } from './codec.ts';
import type { Db } from './db.ts';
import { rowsToEvents } from './queries.ts';
import { saveTrajectory } from './trajectory.ts';
import type { EventRow } from './queries.ts';

export interface FlushBatch {
  world: World;
  /** Eventos nuevos, en orden de id (como los entrega `Runner.drainEvents`). */
  events?: readonly WorldEvent[];
  /** Entradas externas aplicadas desde el último flush. */
  inputs?: readonly ExternalInput[];
  /**
   * Punto de control (R-012): guarda también el `stateHash` del estado. Sin él, el flush solo marca el
   * estado como "posterior al último punto de control". Lo usan el final de un avance, la pausa y el cierre.
   */
  checkpoint?: boolean;
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
      return { lastSeq: seq, written: this.#saveState(batch.world, batch.checkpoint ?? false) };
    });
  }

  get lastSeq(): number {
    return this.#lastSeq;
  }

  /**
   * `true` si el último `loadWorld` cargó un estado posterior al último punto de control (p. ej. tras un
   * cierre en seco), que por tanto no se pudo verificar con el hash (R-012).
   */
  get recovered(): boolean {
    return this.#recovered;
  }

  #recovered = false;

  /** R-012: el estado guardado es exactamente `world`; su hash queda como referencia para verificar la carga. */
  #markVerified(world: World, hash: string): void {
    this.#setMeta('state_hash', hash);
    this.#setMeta('state_hash_at', String(world.now));
    this.#setMeta('state_dirty', '0');
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

  #saveState(world: World, checkpoint: boolean): { entities: [EntityId, string][]; columns: [string, Buffer][] } {
    const written = { entities: [] as [EntityId, string][], columns: [] as [string, Buffer][] };
    const storedId = this.#meta('world_id');
    if (storedId !== undefined && storedId !== world.id)
      throw new Error(`La base es del mundo ${storedId}, no de ${world.id}`);
    if (storedId === undefined) {
      this.#setMeta('world_id', world.id);
      this.#setMeta('config', JSON.stringify(world.config));
      this.#setMeta('engine_version', world.config.engineVersion);
    }
    // El mapa no cambia después de generarse (spec 003 INV-002): se escribe una sola vez.
    if (world.geo && this.#meta('geo') === undefined) this.#setMeta('geo', JSON.stringify(geoToData(world.geo)));
    // Cuentas del sistema (015): solo en los mundos con economía; cambian cada día.
    if (world.accounts) this.#setMeta('accounts', JSON.stringify(world.accounts));
    this.#setMeta('now', String(world.now));
    this.#setMeta('status', world.status);
    this.#setMeta('counters', JSON.stringify(world.counters));
    this.#setMeta('capabilities', JSON.stringify(world.capabilities)); // ya en orden canónico (R-009)
    this.#setMeta('scheduler', JSON.stringify(sortedItems(world.scheduler))); // sin serializar el mundo entero
    // R-012: el hash (≈ 15 ms con la población de M1) solo en los puntos de control.
    if (checkpoint) this.#markVerified(world, stateHash(world));
    else if (this.#meta('state_dirty') !== '1') this.#setMeta('state_dirty', '1');

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

  /**
   * Reconstruye el mundo desde el estado actual y comprueba que su hash es el guardado. Todo se lee en una
   * transacción: con un escritor activo (el worker), cada SELECT suelto vería un flush distinto (WAL) y la carga
   * mezclaría dos estados (CA-004).
   */
  loadWorld(): World {
    return this.db.transaction(() => this.#loadWorld())();
  }

  #loadWorld(): World {
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
    const geo = this.#meta('geo');
    if (geo !== undefined) snap.geo = JSON.parse(geo) as GeoMapData;
    const accounts = this.#meta('accounts');
    if (accounts !== undefined) snap.accounts = JSON.parse(accounts) as { restOfCountry: number };
    const rows = this.db.prepare('SELECT id, kind, data FROM entities ORDER BY id').all() as {
      id: EntityId;
      kind: string;
      data: string;
    }[];
    for (const r of rows) {
      const list = LIST_OF_KIND[r.kind];
      if (!list) throw new Error(`Entidad ${r.id} de tipo desconocido ${r.kind}`);
      (snap[list] as BaseEntity[]).push(JSON.parse(r.data) as BaseEntity);
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
    // R-012: tras un punto de control el estado se verifica con su hash. Si hubo flush después (un cierre en
    // seco), no hay hash de ese estado: se carga igual y se marca como recuperado. Una base anterior a R-012
    // no tiene `state_hash_at` y guardaba el hash en cada flush: se verifica siempre.
    this.#recovered = this.#meta('state_dirty') === '1';
    if (!this.#recovered) {
      const expected = this.#meta('state_hash');
      const at = this.#meta('state_hash_at');
      const actual = stateHash(world);
      if (actual !== expected || (at !== undefined && Number(at) !== world.now))
        throw new Error(`El estado cargado no coincide con el guardado (hash ${actual} ≠ ${expected})`);
    }
    return world;
  }

  /**
   * R-004: instantánea completa comprimida en el minuto actual. Devuelve su hash. Es también un punto de
   * control (R-012): se llama justo después de un flush, cuando el estado guardado es exactamente `world`.
   */
  saveSnapshot(world: World): string {
    const hash = stateHash(world);
    this.db.transaction(() => {
      this.db
        .prepare('INSERT OR REPLACE INTO snapshots (at, hash, data) VALUES (?, ?, ?)')
        .run(world.now, hash, encodeSnapshot(world));
      // 020 R-001: la trayectoria del día, con la instantánea (fuera del estado del mundo).
      saveTrajectory(this.db, world);
    })();
    this.#markVerified(world, hash);
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
    return rowsToEvents(this.db, rows);
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

  /** Minutos con instantánea, en orden (022 R-009: la línea temporal). */
  snapshotTimes(): number[] {
    return (this.db.prepare('SELECT at FROM snapshots ORDER BY at').all() as { at: number }[]).map((r) => r.at);
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
