// API pública de la persistencia (spec 027).
export { MIGRATIONS_DIR, closeDb, listMigrations, migrate, openReadonly, openWorldDb, schemaVersion } from './db.ts';
export type { Db } from './db.ts';

export { columnFromLE, columnToLE, decodeSnapshot, encodeSnapshot } from './codec.ts';

export { ADVANCE_MINUTES, ADVANCE_SLICE_MS, FLUSH_MS, FLUSH_TICKS, MOVES_KEEP_DAYS, SNAPSHOT_EVERY_DAYS } from './params.ts';
export { TripTracker, movesSince, saveMoves } from './movements.ts';
export type { Movement } from './movements.ts';

export {
  CONTROL_COMMANDS,
  acquireWriterLock,
  enqueueCommand,
  finishCommand,
  pendingCommands,
  releaseWriterLock,
  writerLock,
} from './control.ts';
export type { ControlCommand, ControlCommandName } from './control.ts';

export { WorldRepository } from './repository.ts';
export { WorldSession } from './session.ts';
export type { FlushBatch } from './repository.ts';
export { eventsById, queryEvents, rowsToEvents } from './queries.ts';
export { saveTrajectory, trajectoryOf, trajectoryRows } from './trajectory.ts';
export type { DayPoint } from './trajectory.ts';
export type { EventQuery, EventRow } from './queries.ts';

export {
  SqliteRecordStore,
  appendChatLog,
  chatLog,
  chatSessionsOf,
  chatTurns,
  getChatSession,
  insertChatSession,
  insertChatTurn,
  nextChatSessionId,
  openChatSessions,
  openInWorldSession,
  updateChatSession,
} from './chat.ts';
export type { ChatSessionRow, ChatTurnRow, StoredLlmRecord } from './chat.ts';
