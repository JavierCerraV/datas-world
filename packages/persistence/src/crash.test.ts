import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { Runner, createRng, createWorld, stateHash } from '@mundo-social/engine';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDb, openWorldDb } from './db.ts';
import { FLUSH_TICKS } from './params.ts';
import { WorldRepository } from './repository.ts';
import { tempDir, testConfig } from './testing.ts';

const CHILD = join(import.meta.dirname, 'crash-child.fixture.ts');
const DAYS = 30;

let tmp = tempDir();
afterEach(() => {
  tmp.cleanup();
  tmp = tempDir();
});

/** Lanza el hijo y lo mata en seco en cuanto confirma un flush en o después de `killAt`. */
function runAndKill(path: string, killAt: number): Promise<{ now: number; seq: number; killed: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CHILD, path, String(DAYS)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let last = { now: -1, seq: 0 };
    let buffer = '';
    let stderr = '';
    let killed = false;
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.stdout.on('data', (d: Buffer) => {
      buffer += d.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop()!;
      for (const line of lines) {
        const m = /^flush (\d+) (\d+)$/.exec(line);
        if (!m || killed) continue;
        last = { now: Number(m[1]), seq: Number(m[2]) };
        if (last.now >= killAt) {
          killed = true;
          child.kill('SIGKILL'); // en Windows equivale a TerminateProcess: sin manejadores ni flush final
        }
      }
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (!killed && code !== 0) reject(new Error(`El hijo terminó con código ${code}: ${stderr}`));
      else resolve({ ...last, killed });
    });
  });
}

describe('027 CA-003: interrupción abrupta durante la simulación', () => {
  it('determinismo: no se pierde ningún evento confirmado y el mundo continúa desde el último flush', async () => {
    const cfg = testConfig();
    const ref = createWorld(cfg);
    const refRunner = new Runner(ref.world, createRng(cfg.seed));
    refRunner.advanceDays(DAYS);
    const refEvents = [...ref.events, ...refRunner.drainEvents()];

    const path = tmp.file('w.db');
    const confirmed = await runAndKill(path, 10 * 1440);
    expect(confirmed.killed).toBe(true);

    const db = openWorldDb(path);
    const repo = new WorldRepository(db);
    const world = repo.loadWorld(); // verifica el hash guardado: estado y eventos del mismo flush
    expect(world.now).toBeGreaterThanOrEqual(confirmed.now);
    expect(world.now).toBeLessThan(DAYS * 1440);
    expect(world.now % (FLUSH_TICKS * cfg.tickMinutes)).toBe(0);
    expect(repo.lastSeq).toBeGreaterThanOrEqual(confirmed.seq);

    const saved = repo.readEvents();
    expect(saved).toEqual(refEvents.slice(0, saved.length)); // sin huecos ni eventos de más
    expect(saved.every((e) => e.at <= world.now)).toBe(true);
    expect(saved.length).toBe(world.counters.EVT);

    const runner = new Runner(world, createRng(world.config.seed));
    runner.advanceTicks((DAYS * 1440 - world.now) / cfg.tickMinutes);
    repo.flush({ world, events: runner.drainEvents() });
    expect(stateHash(world)).toBe(stateHash(ref.world));
    expect(repo.readEvents()).toEqual(refEvents);
    closeDb(db);
  }, 60_000);
});
