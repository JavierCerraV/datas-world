import { Runner, createRng, createWorld } from '@mundo-social/engine';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDb, openWorldDb } from './db.ts';
import { FLUSH_TICKS } from './params.ts';
import { WorldRepository } from './repository.ts';
import { WorldSession } from './session.ts';
import { tempDir, testConfig } from './testing.ts';

let tmp = tempDir();
afterEach(() => {
  tmp.cleanup();
  tmp = tempDir();
});

describe('WorldSession (R-002, R-004)', () => {
  it('avanza con flush cada FLUSH_TICKS, una instantánea por día y progreso cada 5 %', () => {
    const db = openWorldDb(tmp.file('w.db'));
    const repo = new WorldRepository(db);
    const { world, events } = createWorld(testConfig());
    repo.flush({ world, events });
    const session = new WorldSession(repo, new Runner(world, createRng(world.config.seed)));
    let flushes = 0;
    const flush = repo.flush.bind(repo);
    repo.flush = (b) => (flushes++, flush(b));
    const progress: number[] = [];
    session.advanceTicks(3 * 288, (f) => progress.push(f));
    expect(world.now).toBe(3 * 1440);
    expect(flushes).toBe((3 * 288) / FLUSH_TICKS + 1); // + el flush final (sin cambios pendientes)
    expect(repo.countSnapshots()).toBe(3);
    expect(progress).toHaveLength(20);
    expect(progress.at(-1)).toBe(1);
    expect(repo.countEvents('DAY_STARTED')).toBe(3);
    closeDb(db);
  });

  it('las entradas se guardan una sola vez y continúan su numeración en otra sesión', () => {
    const db = openWorldDb(tmp.file('w.db'));
    const repo = new WorldRepository(db);
    const { world, events } = createWorld(testConfig());
    repo.flush({ world, events });
    const a = new WorldSession(repo, new Runner(world, createRng(world.config.seed)));
    a.runner.pause();
    a.flush();
    a.flush();
    const b = new WorldSession(repo, new Runner(repo.loadWorld(), createRng(world.config.seed)));
    b.runner.resume();
    b.flush();
    expect(repo.readInputs().map((i) => [i.at, i.seq, i.kind])).toEqual([
      [0, 0, 'pause'],
      [0, 1, 'resume'],
    ]);
    closeDb(db);
  });
});
