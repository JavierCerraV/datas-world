// Entidad raíz del mundo (spec 001).
import { MINUTES_PER_DAY, parseDate, parseEpoch } from './calendar.ts';
import type { WorldMinute } from './calendar.ts';
import { canonicalOrder, validateCapabilities } from './capabilities.ts';
import type { Capability } from './capabilities.ts';
import { capacityFor, createComponents, ensureCapacity } from './components.ts';
import type { CitizenComponents } from './components.ts';
import { makeEvent } from './events.ts';
import type { WorldEvent } from './events.ts';
import { allocateId, emptyCounters, idKind, idNumber } from './ids.ts';
import type { Counters, EntityId, WorldId } from './ids.ts';
import { checkProfile } from './profile.ts';
import type { CountryProfile } from './profile.ts';
import { createScheduler } from './scheduler.ts';
import type { Scheduler } from './scheduler.ts';

export interface WorldConfig {
  name: string;
  seed: number; // uint32
  epoch: string; // "AAAA-MM-DDT00:00", solo para mostrar y para el calendario
  tickMinutes: number; // divisor de 1440 entre 1 y 60
  currency: { code: string; minorUnit: number };
  population: { target: number };
  engineVersion: string;
  params: Record<string, number>;
  initialCapabilities: Capability[];
  holidays: string[]; // "AAAA-MM-DD"
  /** Perfil de país copiado al crear el mundo (spec 029). Opcional: los mundos de M0 no lo tienen. */
  profile?: CountryProfile;
  /** Versión y hash de cada catálogo usado (ADR-006 §4), por nombre. */
  catalogs?: Record<string, CatalogRef>;
}

export interface CatalogRef {
  version: string;
  hash: string;
}

export type WorldStatus = 'created' | 'running' | 'paused' | 'closed';

/** Base común de las entidades. Las specs de M1 (007, 008, 006, 004, 005) amplían cada tipo. */
export interface BaseEntity {
  id: EntityId;
  status: 'active' | 'inactive';
}
export type Citizen = BaseEntity;
export type Household = BaseEntity;
export type Organization = BaseEntity;
export type Place = BaseEntity;
export type WorldObject = BaseEntity;

export interface World {
  id: WorldId;
  config: Readonly<WorldConfig>;
  now: WorldMinute;
  status: WorldStatus;
  counters: Counters;
  capabilities: Capability[];
  citizens: Map<EntityId, Citizen>;
  households: Map<EntityId, Household>;
  organizations: Map<EntityId, Organization>;
  places: Map<EntityId, Place>;
  objects: Map<EntityId, WorldObject>;
  components: CitizenComponents;
  scheduler: Scheduler;
}

const deepFreeze = <T>(v: T): T => {
  if (typeof v === 'object' && v !== null) {
    Object.freeze(v);
    for (const x of Object.values(v)) deepFreeze(x);
  }
  return v;
};

export function validateConfig(c: WorldConfig): void {
  if (!Number.isSafeInteger(c.seed) || c.seed < 0 || c.seed > 0xffffffff)
    throw new RangeError(`Semilla no es uint32: ${c.seed}`);
  const t = c.tickMinutes;
  if (!Number.isInteger(t) || t < 1 || t > 60 || MINUTES_PER_DAY % t !== 0) {
    throw new RangeError(`tickMinutes debe ser un divisor de 1440 entre 1 y 60: ${t}`);
  }
  const e = parseEpoch(c.epoch);
  if (e.hour !== 0 || e.minute !== 0) throw new RangeError(`El epoch debe empezar a las 00:00: ${c.epoch}`);
  if (!Number.isInteger(c.population.target) || c.population.target < 0)
    throw new RangeError('population.target inválido');
  if (!Number.isInteger(c.currency.minorUnit) || c.currency.minorUnit < 1)
    throw new RangeError('currency.minorUnit inválido');
  const bad = validateCapabilities(c.initialCapabilities);
  if (bad) throw new RangeError(`initialCapabilities: ${bad}`);
  if (!c.initialCapabilities.includes('clock')) throw new RangeError('initialCapabilities debe incluir clock');
  c.holidays.forEach(parseDate);
  for (const [k, v] of Object.entries(c.params))
    if (!Number.isFinite(v)) throw new RangeError(`params.${k} no es finito`);
  if (c.profile) {
    const bad = checkProfile(c.profile);
    if (bad) throw new RangeError(`profile ${c.profile.id}: ${bad}`);
    if (c.profile.currency.code !== c.currency.code)
      throw new RangeError('La moneda del perfil y la del mundo no coinciden');
  }
  for (const [name, ref] of Object.entries(c.catalogs ?? {})) {
    if (!ref.version || !/^[0-9a-f]{16}$/.test(ref.hash))
      throw new RangeError(`catalogs.${name}: versión o hash inválidos`);
  }
}

/** Estructura vacía de un mundo (sin evento). La usan createWorld y la deserialización. */
export function emptyWorld(config: WorldConfig, id: WorldId): World {
  validateConfig(config);
  const frozen = deepFreeze(structuredClone(config));
  return {
    id,
    config: frozen,
    now: 0,
    status: 'created',
    counters: emptyCounters(),
    capabilities: canonicalOrder(frozen.initialCapabilities),
    citizens: new Map(),
    households: new Map(),
    organizations: new Map(),
    places: new Map(),
    objects: new Map(),
    components: createComponents(capacityFor(frozen.population.target + 1)),
    scheduler: createScheduler(),
  };
}

export function createWorld(config: WorldConfig, id: WorldId = 'WLD-0001'): { world: World; events: WorldEvent[] } {
  const world = emptyWorld(config, id);
  const created = makeEvent(world.counters, 0, {
    type: 'WORLD_CREATED',
    payload: { name: world.config.name, seed: world.config.seed },
    causes: [{ state: 'world_config', weight: 1 }],
    origin: 'external',
  });
  return { world, events: [created] };
}

/** Alta mínima de un ciudadano con su fila de componentes. La generación real llega con la spec 007 (M1). */
export function addCitizen(world: World): EntityId {
  const id = allocateId(world.counters, 'CIT');
  const row = idNumber(id);
  ensureCapacity(world.components, row + 1);
  world.components.u8.active![row] = 1;
  world.citizens.set(id, { id, status: 'active' });
  return id;
}

const collectionFor = (world: World, id: EntityId): Map<EntityId, BaseEntity> => {
  const kind = idKind(id);
  const map = {
    CIT: world.citizens,
    HOU: world.households,
    ORG: world.organizations,
    PLC: world.places,
    OBJ: world.objects,
  }[kind as 'CIT'];
  if (!map) throw new Error(`El tipo ${kind} no es una colección del mundo`);
  return map;
};

/** R-003: una entidad nunca se borra; pasa a `inactive`. El evento lo emite quien la inactiva (spec de su dominio). */
export function deactivateEntity(world: World, id: EntityId): void {
  const entity = collectionFor(world, id).get(id);
  if (!entity) throw new Error(`No existe ${id}`);
  entity.status = 'inactive';
  if (idKind(id) === 'CIT') world.components.u8.active![idNumber(id)] = 0;
}
