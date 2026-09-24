// API pública del motor.
export { createRng, restoreRng } from './rng.ts';
export type { Rng, RngState } from './rng.ts';

export { ENTITY_KINDS, ID_WIDTH, allocateId, emptyCounters, formatId, idKind, idNumber } from './ids.ts';
export type { Counters, EntityId, EntityKind, WorldId } from './ids.ts';

export { MINUTES_PER_DAY, civilFromDays, daysFromCivil, formatDate, parseDate, parseEpoch, toCalendar } from './calendar.ts';
export type { CalendarView, CivilDate, CivilDateTime, WorldMinute } from './calendar.ts';

export { createScheduler, popDue, schedule, sortedItems } from './scheduler.ts';
export type { ScheduledItem, Scheduler } from './scheduler.ts';

export { EVENT_TYPES, eventText, makeEvent } from './events.ts';
export type { CauseRef, EventOrigin, EventType, NewEvent, WorldEvent } from './events.ts';

export { CAPABILITIES, CAPABILITY_DEPS, canEnable, isCapability, validateCapabilities, withCapability } from './capabilities.ts';
export type { Capability } from './capabilities.ts';

export { capacityFor, columns, defineColumn, ensureCapacity } from './components.ts';
export type { CitizenComponents, ColumnType } from './components.ts';

export { addCitizen, createWorld, deactivateEntity, validateConfig } from './world.ts';
export type { BaseEntity, Citizen, World, WorldConfig, WorldStatus } from './world.ts';

export { canonicalize, hashString } from './hash.ts';
export { deserializeWorld, serializeWorld, stateHash } from './serialize.ts';
export type { WorldSnapshot } from './serialize.ts';

export { applyExternalInput, tick } from './tick.ts';
export type { ExternalInput, InputResult, ScheduledHandler } from './tick.ts';

export { Runner } from './runner.ts';
export type { Speed } from './runner.ts';
