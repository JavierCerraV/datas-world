// `pnpm bench` (bloque E3): ticks/s y memoria de un mundo vacío durante N días (spec 002 CA-005),
// solo con el motor y con el motor más SQLite (flush cada FLUSH_TICKS, instantánea diaria).
// Bloque I: también el tiempo y el tamaño de `world:new` con el mundo de M1 completo (030 CA-007).
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ENGINE_VERSION, MINUTES_PER_DAY, Runner, createRng, createWorld } from '@datas-world/engine';
import type { WorldConfig } from '@datas-world/engine';
import { generateWorld } from '@datas-world/generators';
import { WorldRepository, WorldSession, closeDb, openWorldDb } from '@datas-world/persistence';
import type { Io } from './common.ts';
import { saveNewWorld } from './world-new.ts';

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
    options: {
      days: { type: 'string', default: '365' },
      json: { type: 'boolean', default: false },
      // Falla (código 1) si no se cumple la 002 CA-005. La CI lo ejecuta en un paso propio, sin otras
      // pruebas en paralelo: medir tiempos dentro de la suite en paralelo daba falsos fallos.
      check: { type: 'boolean', default: false },
    },
  });
  const days = Number(v.days);
  if (!Number.isSafeInteger(days) || days < 1) throw new Error('--days debe ser un entero ≥ 1');
  if (v.check && days !== 365) throw new Error('--check mide la 002 CA-005: úsalo con --days 365');
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
  const creation = measureWorldNew();
  const maxRssMB = +(process.resourceUsage().maxRSS / 1024).toFixed(1);
  const passes = (r: Result) => r.ms < 2000 && r.daysStarted === days;
  const creationOk = creation.ms < WORLD_NEW_MAX_MS && creation.dbMB < WORLD_NEW_MAX_MB;
  if (v.json) io.out(JSON.stringify({ results, creation, maxRssMB }));
  else {
    reportText(results, days, maxRssMB, passes, io);
    io.out(
      `world:new       ${creation.citizens} personas, ${creation.ancestors} antepasados, ${creation.events} eventos en ` +
        `${creation.ms} ms · base ${creation.dbMB} MB · 030 CA-007 ${creationOk ? '✔' : '✘'}`,
    );
  }
  const failed = results.filter((r) => !passes(r));
  if (v.check && failed.length > 0) {
    throw new Error(`002 CA-005 no se cumple en: ${failed.map((r) => `${r.mode} (${r.ms} ms)`).join(', ')}`);
  }
  if (v.check && !creationOk) {
    throw new Error(`030 CA-007 no se cumple: world:new en ${creation.ms} ms y base de ${creation.dbMB} MB`);
  }
}

/** 030 CA-007: `world:new` con 200 personas en < 5 s, y la base entera (historia incluida) en < 2 MB. */
const WORLD_NEW_MAX_MS = 5000;
const WORLD_NEW_MAX_MB = 2;

function measureWorldNew() {
  const dir = mkdtempSync(join(tmpdir(), 'mundo-bench-'));
  try {
    const path = join(dir, 'world.db');
    const t0 = performance.now();
    const g = generateWorld({ seed: 482917 });
    saveNewWorld(path, g.world, g.events);
    const ms = Math.round(performance.now() - t0);
    return {
      ms,
      citizens: g.pop.citizenIds.length,
      ancestors: g.hist.ancestorIds.length,
      events: g.events.length,
      dbMB: +(statSync(path).size / MB).toFixed(2),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function reportText(results: Result[], days: number, maxRssMB: number, passes: (r: Result) => boolean, io: Io): void {
  for (const r of results) {
    const ok = passes(r);
    io.out(
      `${r.mode.padEnd(15)} ${r.days} días · ${r.ticks} ticks en ${r.ms} ms · ${r.ticksPerSecond} ticks/s · ` +
        `DAY_STARTED ${r.daysStarted} · RSS ${r.rssMB} MB · heap ${r.heapMB} MB` +
        (r.dbMB !== undefined ? ` · base ${r.dbMB} MB` : '') +
        (days === 365 ? ` · 002 CA-005 ${ok ? '✔' : '✘'}` : ''),
    );
  }
  io.out(`RSS máximo del proceso: ${maxRssMB} MB`);
}
