// API pública de la persistencia (spec 027).
export { MIGRATIONS_DIR, closeDb, listMigrations, migrate, openReadonly, openWorldDb, schemaVersion } from './db.ts';
export type { Db } from './db.ts';

export { columnFromLE, columnToLE, decodeSnapshot, encodeSnapshot } from './codec.ts';

export { FLUSH_TICKS, SNAPSHOT_EVERY_DAYS } from './params.ts';

export { WorldRepository } from './repository.ts';
export type { FlushBatch } from './repository.ts';
