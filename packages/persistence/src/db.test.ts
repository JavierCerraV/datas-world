import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR, closeDb, listMigrations, openReadonly, openWorldDb, schemaVersion } from './db.ts';
import { tempDir } from './testing.ts';

let tmp = tempDir();
afterEach(() => {
  tmp.cleanup();
  tmp = tempDir();
});

describe('migraciones (R-006) y pragmas (R-003)', () => {
  it('una base nueva queda en la última versión con todas las tablas de la §3', () => {
    const db = openWorldDb(tmp.file('w.db'));
    expect(schemaVersion(db)).toBe(listMigrations().length);
    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]
    ).map((t) => t.name);
    expect(tables).toEqual([
      'components',
      'control_commands',
      'entities',
      'event_participants',
      'events',
      'external_inputs',
      'memory_archive',
      'meta',
      'snapshots',
    ]);
    closeDb(db);
  });

  it('aplica los pragmas de la R-003', () => {
    const db = openWorldDb(tmp.file('w.db'));
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('synchronous', { simple: true })).toBe(1); // NORMAL
    expect(db.pragma('cache_size', { simple: true })).toBe(-16000);
    expect(db.pragma('busy_timeout', { simple: true })).toBe(2000);
    closeDb(db);
  });

  it('reabrir no vuelve a migrar ni hace copia', () => {
    closeDb(openWorldDb(tmp.file('w.db')));
    const db = openWorldDb(tmp.file('w.db'));
    expect(schemaVersion(db)).toBe(1);
    expect(existsSync(tmp.file('w.db.v1.backup'))).toBe(false);
    closeDb(db);
  });

  it('antes de migrar una base con datos hace una copia .backup con su contenido', () => {
    const db1 = openWorldDb(tmp.file('w.db'));
    db1.prepare("INSERT INTO meta (key, value) VALUES ('world_id', 'WLD-0001')").run();
    closeDb(db1);

    const dir = join(tmp.dir, 'migs');
    mkdirSync(dir);
    copyFileSync(join(MIGRATIONS_DIR, '001-inicial.sql'), join(dir, '001-inicial.sql'));
    writeFileSync(join(dir, '002-prueba.sql'), 'CREATE TABLE extra (x INTEGER);');

    const db2 = openWorldDb(tmp.file('w.db'), { migrationsDir: dir });
    expect(schemaVersion(db2)).toBe(2);
    closeDb(db2);

    const backup = new Database(tmp.file('w.db.v1.backup'), { readonly: true });
    expect(backup.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get()).toEqual({ value: '1' });
    expect(backup.prepare("SELECT value FROM meta WHERE key = 'world_id'").get()).toEqual({ value: 'WLD-0001' });
    backup.close();
  });

  it('rechaza una base con un esquema más nuevo que el código', () => {
    const db = openWorldDb(tmp.file('w.db'));
    db.prepare("UPDATE meta SET value = '99' WHERE key = 'schema_version'").run();
    closeDb(db);
    expect(() => openWorldDb(tmp.file('w.db'))).toThrow(/esquema 99/);
  });

  it('las migraciones deben ir numeradas sin huecos', () => {
    const dir = join(tmp.dir, 'migs');
    mkdirSync(dir);
    writeFileSync(join(dir, '001-a.sql'), '');
    writeFileSync(join(dir, '003-c.sql'), '');
    expect(() => listMigrations(dir)).toThrow(/versión 2/);
  });
});

describe('INV-001: registro de eventos append-only', () => {
  it('UPDATE y DELETE sobre events fallan', () => {
    const db = openWorldDb(tmp.file('w.db'));
    db.prepare(
      "INSERT INTO events (seq, id, type, at, importance, payload, causes, origin) VALUES (1, 'EVT-00000001', 'X', 0, 1, '{}', '[]', 'engine')",
    ).run();
    expect(() => db.prepare('UPDATE events SET at = 5').run()).toThrow(/INV-001/);
    expect(() => db.prepare('DELETE FROM events').run()).toThrow(/INV-001/);
    closeDb(db);
  });
});

describe('solo lectura (R-001)', () => {
  it('la conexión de la API no puede escribir', () => {
    closeDb(openWorldDb(tmp.file('w.db')));
    const ro = openReadonly(tmp.file('w.db'));
    expect(() => ro.prepare("INSERT INTO meta (key, value) VALUES ('x', 'y')").run()).toThrow(/readonly/i);
    closeDb(ro);
  });

  it('no abre una base que no existe', () => {
    expect(() => openReadonly(tmp.file('nada.db'))).toThrow();
  });
});
