// `pnpm bench` (bloque E3): ticks/s y memoria de un mundo vacío durante N días (spec 002 CA-005),
// solo con el motor y con el motor más SQLite (flush cada FLUSH_TICKS, instantánea diaria).
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ENGINE_VERSION, MINUTES_PER_DAY, Runner, createRng, createWorld } from '@mundo-social/engine';
import type { WorldConfig } from '@mundo-social/engine';
import { WorldRepository, WorldSession, closeDb, openWorldDb } from '@mundo-social/persistence';
import type { Io } from './commands.ts';

const config: WorldConfig = {
  name: 'Bench',
  seed: 482917,
  epoch: '2027-01-04T00:00',
  tickMinutes: 5,
  currency: { code: 'COP', minorUnit: 1 },
  population: { target: 0 },
  engineVersion: ENGINE_VERSION,
  params: {},
  initialCapabilities: ['clock'],
  holidays: [],
};

const MB = 1024 * 1024;

interface Result {
  mode: string;
  days: number;
  ticks: number;
  ms: number;
  ticksPerSecond: number;
  daysStarted: number;
  rssMB: number;
  heapMB: number;
  dbMB?: number;
}

function measure(
  mode: string,
  days: number,
  fn: (runner: Runner) => { daysStarted: number; dbBytes?: number },
): Result {
  const { world } = createWorld(config);
  const runner = new Runner(world, createRng(config.seed));
  const t0 = performance.now();
  const r = fn(runner);
  const ms = performance.now() - t0;
  const ticks = (days * MINUTES_PER_DAY) / config.tickMinutes;
  const mem = process.memoryUsage();
  return {
    mode,
    days,
    ticks,
    ms: Math.round(ms),
    ticksPerSecond: Math.round((ticks / ms) * 1000),
    daysStarted: r.daysStarted,
    rssMB: +(mem.rss / MB).toFixed(1),
    heapMB: +(mem.heapUsed / MB).toFixed(1),
    ...(r.dbBytes !== undefined ? { dbMB: +(r.dbBytes / MB).toFixed(2) } : {}),
  };
}

export function bench(args: string[], io: Io): void {
  const { values: v } = parseArgs({
    args,
    options: { days: { type: 'string', default: '365' }, json: { type: 'boolean', default: false } },
  });
  const days = Number(v.days);
  if (!Number.isSafeInteger(days) || days < 1) throw new Error('--days debe ser un entero ≥ 1');
  const ticks = (days * MINUTES_PER_DAY) / config.tickMinutes;

  const engine = measure('motor', days, (runner) => {
    runner.advanceDays(days);
    return { daysStarted: runner.drainEvents().filter((e) => e.type === 'DAY_STARTED').length };
  });

  const dir = mkdtempSync(join(tmpdir(), 'mundo-bench-'));
  let sqlite: Result;
  try {
    const path = join(dir, 'bench.db');
    sqlite = measure('motor + SQLite', days, (runner) => {
      const db = openWorldDb(path);
      const repo = new WorldRepository(db);
      repo.flush({ world: runner.world });
      new WorldSession(repo, runner).advanceTicks(ticks);
      const daysStarted = repo.countEvents('DAY_STARTED');
      closeDb(db);
      return { daysStarted, dbBytes: statSync(path).size };
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const results = [engine, sqlite];
  const maxRssMB = +(process.resourceUsage().maxRSS / 1024).toFixed(1);
  if (v.json) return io.out(JSON.stringify({ results, maxRssMB }));
  for (const r of results) {
    const ok = r.ms < 2000 && r.daysStarted === days;
    io.out(
      `${r.mode.padEnd(15)} ${r.days} días · ${r.ticks} ticks en ${r.ms} ms · ${r.ticksPerSecond} ticks/s · ` +
        `DAY_STARTED ${r.daysStarted} · RSS ${r.rssMB} MB · heap ${r.heapMB} MB` +
        (r.dbMB !== undefined ? ` · base ${r.dbMB} MB` : '') +
        (days === 365 ? ` · 002 CA-005 ${ok ? '✔' : '✘'}` : ''),
    );
  }
  io.out(`RSS máximo del proceso: ${maxRssMB} MB`);
}
