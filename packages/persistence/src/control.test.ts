import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  acquireWriterLock,
  enqueueCommand,
  finishCommand,
  pendingCommands,
  releaseWriterLock,
  writerLock,
} from './control.ts';
import { closeDb, openWorldDb } from './db.ts';
import { tempDir } from './testing.ts';

let tmp = tempDir();
afterEach(() => {
  tmp.cleanup();
  tmp = tempDir();
});

describe('órdenes de control', () => {
  it('se atienden en orden de id y dejan de estar pendientes al terminar', () => {
    const db = openWorldDb(tmp.file('w.db'));
    const a = enqueueCommand(db, 'pause', null, '2026-09-24T00:00:00Z');
    const b = enqueueCommand(db, 'speed', '100', '2026-09-24T00:00:01Z');
    expect(pendingCommands(db).map((c) => [c.id, c.cmd, c.arg])).toEqual([
      [a, 'pause', null],
      [b, 'speed', '100'],
    ]);
    finishCommand(db, a, true);
    finishCommand(db, b, false);
    expect(pendingCommands(db)).toEqual([]);
    expect(db.prepare('SELECT done FROM control_commands ORDER BY id').all()).toEqual([{ done: 1 }, { done: -1 }]);
    closeDb(db);
  });
});

describe('R-001: cerrojo del escritor', () => {
  it('rechaza un segundo escritor vivo y se libera al terminar', () => {
    const db = openWorldDb(tmp.file('w.db'));
    acquireWriterLock(db);
    expect(writerLock(db)).toBe(process.pid);
    expect(() => acquireWriterLock(db, process.pid + 1)).toThrow(`PID ${process.pid}`);
    releaseWriterLock(db);
    expect(writerLock(db)).toBeNull();
    closeDb(db);
  });

  it('recupera el cerrojo de un proceso que ya no existe', () => {
    const dead = spawnSync(process.execPath, ['-e', 'console.log(process.pid)']).stdout.toString().trim();
    const db = openWorldDb(tmp.file('w.db'));
    acquireWriterLock(db, Number(dead));
    acquireWriterLock(db);
    expect(writerLock(db)).toBe(process.pid);
    closeDb(db);
  });
});
