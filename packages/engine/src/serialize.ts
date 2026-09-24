// Instantánea serializable del mundo y stateHash (spec 001 R-004, R-010; CA-003).
import { COLUMN_TYPES, columns, defineColumn, ensureCapacity } from './components.ts';
import type { ColumnType } from './components.ts';
import { canonicalize, hashString } from './hash.ts';
import type { Counters, EntityId, WorldId } from './ids.ts';
import { schedulerFrom, sortedItems } from './scheduler.ts';
import type { ScheduledItem } from './scheduler.ts';
import { emptyWorld } from './world.ts';
import type { BaseEntity, World, WorldConfig, WorldStatus } from './world.ts';
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
  organizations: BaseEntity[];
  places: BaseEntity[];
  objects: BaseEntity[];
  components: { type: ColumnType; name: string; initial: number; rows: number[] }[];
  scheduler: ScheduledItem[];
}

const byId = (m: Map<EntityId, BaseEntity>) => [...m.values()].sort((a, b) => (a.id < b.id ? -1 : 1)).map((e) => ({ ...e }));

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
  };
}

export function deserializeWorld(s: WorldSnapshot): World {
  const world = emptyWorld(s.config, s.id);
  world.now = s.now;
  world.status = s.status;
  world.counters = { ...s.counters };
  world.capabilities = [...s.capabilities];
  const load = (m: Map<EntityId, BaseEntity>, list: BaseEntity[]) => list.forEach((e) => m.set(e.id, { ...e }));
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
  return world;
}

/** Hash estable del estado completo (misma semilla + mismas entradas → mismo hash). */
export const stateHash = (world: World): string => hashString(canonicalize(serializeWorld(world)));
