// Apertura de la base, pragmas y migraciones (spec 027 R-001, R-003, R-006).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

export type Db = Database.Database;

export const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');

/** R-003. `wal_autocheckpoint` (1000 páginas, valor de SQLite) hace el checkpoint periódico; al cerrar se trunca. */
function applyPragmas(db: Db): void {
  db.pragma('busy_timeout = 2000');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -16000');
  db.pragma('foreign_keys = ON');
}

interface Migration {
  version: number;
  file: string;
}

/** Archivos `NNN-nombre.sql`, en orden de versión. Las versiones deben ser 1, 2, 3… sin huecos. */
export function listMigrations(dir = MIGRATIONS_DIR): Migration[] {
  const list = readdirSync(dir)
    .filter((f) => /^\d{3}-.+\.sql$/.test(f))
    .sort()
    .map((file) => ({ version: Number(file.slice(0, 3)), file }));
  list.forEach((m, i) => {
    if (m.version !== i + 1) throw new Error(`Migraciones: se esperaba la versión ${i + 1} y hay ${m.file}`);
  });
  return list;
}

export function schemaVersion(db: Db): number {
  const hasMeta = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'").get();
  if (!hasMeta) return 0;
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string } | undefined;
  return row ? Number(row.value) : 0;
}

/**
 * R-006: ejecuta las migraciones pendientes, cada una en su transacción. Si la base ya tenía datos,
 * antes copia la base entera a `<ruta>.v<versión>.backup` con `VACUUM INTO` (copia consistente, síncrona).
 * Devuelve la ruta de la copia, si se hizo.
 */
export function migrate(
  db: Db,
  path: string,
  dir = MIGRATIONS_DIR,
): { from: number; to: number; backup: string | null } {
  const all = listMigrations(dir);
  const from = schemaVersion(db);
  if (from > all.length)
    throw new Error(`La base tiene el esquema ${from} y este código solo conoce hasta ${all.length}`);
  const pending = all.slice(from);
  let backup: string | null = null;
  if (pending.length > 0 && from > 0 && path !== ':memory:') {
    backup = `${path}.v${from}.backup`;
    if (existsSync(backup)) throw new Error(`Ya existe la copia ${backup}; muévela antes de migrar`);
    db.prepare('VACUUM INTO ?').run(backup);
  }
  for (const m of pending) {
    const sql = readFileSync(join(dir, m.file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)").run(String(m.version));
    })();
  }
  return { from, to: all.length, backup };
}

/** Abre la base del worker (único escritor, R-001): pragmas y migraciones pendientes. */
export function openWorldDb(path: string, opts: { migrationsDir?: string } = {}): Db {
  const db = new Database(path);
  try {
    applyPragmas(db);
    migrate(db, path, opts.migrationsDir);
  } catch (err) {
    db.close(); // en Windows, una conexión abierta bloquea el archivo
    throw err;
  }
  return db;
}

/** Abre la base en solo lectura (API, R-001). No migra: si el esquema no está al día, falla. */
export function openReadonly(path: string): Db {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  db.pragma('busy_timeout = 2000');
  const v = schemaVersion(db);
  const expected = listMigrations().length;
  if (v !== expected) {
    db.close();
    throw new Error(`Esquema ${v} en la base; se esperaba ${expected}. Arranca antes el worker para migrar`);
  }
  return db;
}

/** Cierre limpio: vuelca el WAL al archivo principal y lo trunca. */
export function closeDb(db: Db): void {
  if (!db.readonly) db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
}
