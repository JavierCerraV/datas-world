// API pública del motor.
export { createRng, restoreRng } from './rng.ts';
export type { Rng, RngState } from './rng.ts';

export { ENTITY_KINDS, ID_WIDTH, allocateId, emptyCounters, formatId, idKind, idNumber } from './ids.ts';
export type { Counters, EntityId, EntityKind, WorldId } from './ids.ts';

export {
  MINUTES_PER_DAY,
  ageInYears,
  civilFromDays,
  daysFromCivil,
  formatDate,
  parseDate,
  parseEpoch,
  toCalendar,
} from './calendar.ts';
export type { CalendarView, CivilDate, CivilDateTime, WorldMinute } from './calendar.ts';

export { createScheduler, popDue, schedule, sortedItems } from './scheduler.ts';
export type { ScheduledItem, Scheduler } from './scheduler.ts';

export { EVENT_TYPES, eventText, makeEvent } from './events.ts';
export type { CauseRef, EventOrigin, EventType, NewEvent, WorldEvent } from './events.ts';

export {
  CAPABILITIES,
  CAPABILITY_DEPS,
  canEnable,
  isCapability,
  validateCapabilities,
  withCapability,
} from './capabilities.ts';
export type { Capability } from './capabilities.ts';

export { capacityFor, columns, defineColumn, ensureCapacity } from './components.ts';
export type { CitizenComponents, ColumnType } from './components.ts';

export {
  LATE_CLOSE_LIMIT,
  addCitizen,
  addHousehold,
  addOrganization,
  addPerson,
  addPlace,
  completeHousehold,
  createWorld,
  deactivateEntity,
  validateConfig,
} from './world.ts';
export type {
  BaseEntity,
  CatalogRef,
  Citizen,
  HealthCondition,
  Household,
  Kinship,
  LeisureInterest,
  KinshipKind,
  NewOrganization,
  NewPerson,
  Occupation,
  NewObject,
  NewPlace,
  NewPosition,
  OpeningHours,
  Organization,
  Place,
  Position,
  Shift,
  World,
  WorldConfig,
  WorldObject,
  WorldStatus,
} from './world.ts';

export {
  TILE,
  createGeoMap,
  doorDistanceMatrix,
  geoFromData,
  geoToData,
  roadDistances,
  setTile,
  tileAt,
} from './geo.ts';
export type { GeoMap, GeoMapData, TileKind, TilePoint } from './geo.ts';

export { canonicalize, hashString } from './hash.ts';
export { deserializeWorld, serializeWorld, stateHash } from './serialize.ts';
export type { WorldSnapshot } from './serialize.ts';

export { applyExternalInput, tick } from './tick.ts';
export type { ExternalInput, InputResult, ScheduledHandler } from './tick.ts';

export { PHASES } from './simulation/system.ts';
export type {
  ActionOutcome,
  ActionRequest,
  ActionValidator,
  Cadence,
  DeepReadonly,
  Patch,
  Phase,
  SimLevel,
  System,
  SystemOutput,
  TickCtx,
  WorldView,
} from './simulation/system.ts';
export { EMPTY_REGISTRY, activeSystems, createRegistry } from './simulation/registry.ts';
export type { SystemRegistry } from './simulation/registry.ts';
export { levelOf, runSystems } from './simulation/loop.ts';
export type { LoopOptions } from './simulation/loop.ts';
export { applyPatches } from './simulation/patches.ts';
export { viewOf } from './simulation/view.ts';

export { ENGINE_VERSION } from './version.ts';

export { hire, setOccupation } from './employment.ts';
export { addAncestor, setFoundedAt, setParents } from './history.ts';
export type { NewAncestor } from './history.ts';
export { addObject, objectsOf, recordObjectEvent } from './objects.ts';

export { checkProfile, profileEntry, profileNumber, profileValue } from './profile.ts';
export type { CountryProfile, ProfileEntry, ProfileScope, ProfileStatus, ProfileValue } from './profile.ts';

export { Runner } from './runner.ts';
export type { Speed } from './runner.ts';
