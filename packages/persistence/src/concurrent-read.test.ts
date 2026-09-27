// 027 CA-004 con la carga completa: un lector que carga el mundo mientras otro proceso hace flush debe ver un
// único estado confirmado (el hash coincide), nunca una mezcla de dos flush. Sin transacción de lectura, cada
// SELECT de `loadWorld` veía un momento distinto y la API se caía (043, charla colgada).
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDb, openReadonly } from './db.ts';
import { WorldRepository } from './repository.ts';
import { tempDir } from './testing.ts';

const CHILD = join(import.meta.dirname, 'crash-child.fixture.ts');

let tmp = tempDir();
afterEach(() => {
  tmp.cleanup();
  tmp = tempDir();
});

describe('027 CA-004: carga consistente con un escritor activo', () => {
  it('loadWorld nunca mezcla dos flush mientras otro proceso escribe', async () => {
    const path = tmp.file('w.db');
    const child = spawn(process.execPath, [CHILD, path, '20', 'checkpoint'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let flushes = 0;
    let finished = false;
    child.stdout.on('data', (d: Buffer) => (flushes += (d.toString().match(/^flush/gm) ?? []).length));
    const exited = new Promise<void>((r) => child.on('exit', () => { finished = true; r(); }));
    while (flushes < 2 && !finished) await new Promise((r) => setTimeout(r, 10));
    const db = openReadonly(path);
    let loads = 0;
    const errors: string[] = [];
    try {
      while (!finished) {
        try {
          new WorldRepository(db).loadWorld();
          loads++;
        } catch (e) {
          errors.push((e as Error).message);
        }
        await new Promise((r) => setImmediate(r));
      }
    } finally {
      await exited;
      closeDb(db);
    }
    expect(errors).toEqual([]);
    expect(loads).toBeGreaterThan(5);
  }, 60_000);
});
