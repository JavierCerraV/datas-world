// Instantánea serializable del mundo y stateHash (spec 001 R-004, R-010; CA-003).
import { COLUMN_TYPES, columns, defineColumn, ensureCapacity } from './components.ts';
import type { ColumnType } from './components.ts';
import { geoFromData, geoToData } from './geo.ts';
import type { GeoMapData } from './geo.ts';
import { canonicalize, hashString } from './hash.ts';
import type { Counters, EntityId, WorldId } from './ids.ts';
import { schedulerFrom, sortedItems } from './scheduler.ts';
import type { ScheduledItem } from './scheduler.ts';
import { emptyWorld } from './world.ts';
import type { BaseEntity, Organization, Place, World, WorldConfig, WorldStatus } from './world.ts';
import type { Capability } from './capabilities.ts';

/** Forma plana y JSON-compatible del mundo. No incluye la capacidad reservada ni cachés (R-010). */
export interface WorldSnapshot {
  id: WorldId;
  config: WorldConfig;
  now: number;
  status: WorldStatus;
  counters: Counters;
  capabilities: Capability[];
  citizens: BaseEntity[];
  households: BaseEntity[];
  organizations: Organization[];
  places: Place[];
  objects: BaseEntity[];
  components: { type: ColumnType; name: string; initial: number; rows: number[] }[];
  scheduler: ScheduledItem[];
  /** Solo si el mundo tiene mapa (spec 003); los mundos de M0 no lo llevan y su hash no cambia. */
  geo?: GeoMapData;
}

// Copia profunda: las entidades de M1 tienen objetos anidados (rect, door…).
const byId = <T extends BaseEntity>(m: Map<EntityId, T>): T[] =>
  [...m.values()].sort((a, b) => (a.id < b.id ? -1 : 1)).map((e) => structuredClone(e));

export function serializeWorld(world: World): WorldSnapshot {
  const used = world.counters.CIT + 1; // filas 0..CIT
  return {
    id: world.id,
    config: structuredClone(world.config) as WorldConfig,
    now: world.now,
    status: world.status,
    counters: { ...world.counters },
    capabilities: [...world.capabilities],
    citizens: byId(world.citizens),
    households: byId(world.households),
    organizations: byId(world.organizations),
    places: byId(world.places),
    objects: byId(world.objects),
    components: columns(world.components).map(({ type, name, data }) => ({
      type,
      name,
      initial: world.components.initial[name] ?? 0,
      rows: Array.from(data.subarray(0, used)),
    })),
    scheduler: sortedItems(world.scheduler).map((i) => structuredClone(i)),
    ...(world.geo ? { geo: geoToData(world.geo) } : {}),
  };
}

export function deserializeWorld(s: WorldSnapshot): World {
  const world = emptyWorld(s.config, s.id);
  world.now = s.now;
  world.status = s.status;
  world.counters = { ...s.counters };
  world.capabilities = [...s.capabilities];
  const load = <T extends BaseEntity>(m: Map<EntityId, T>, list: T[]) =>
    list.forEach((e) => m.set(e.id, structuredClone(e)));
  load(world.citizens, s.citizens);
  load(world.households, s.households);
  load(world.organizations, s.organizations);
  load(world.places, s.places);
  load(world.objects, s.objects);
  ensureCapacity(world.components, s.counters.CIT + 1);
  for (const col of s.components) {
    if (!COLUMN_TYPES.includes(col.type)) throw new Error(`Tipo de columna desconocido: ${col.type}`);
    if (!(col.name in world.components[col.type])) defineColumn(world.components, col.type, col.name, col.initial);
    world.components[col.type][col.name]!.set(col.rows);
  }
  world.scheduler = schedulerFrom(s.scheduler);
  if (s.geo) world.geo = geoFromData(s.geo);
  return world;
}

/** Hash estable del estado completo (misma semilla + mismas entradas → mismo hash). */
export const stateHash = (world: World): string => hashString(canonicalize(serializeWorld(world)));
