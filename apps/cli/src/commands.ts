// Comandos de la CLI (bloque E1): world:new, world:advance, world:info, control y bench.
// No contienen reglas de simulación: solo combinan engine y persistence.
import { mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import {
  ENGINE_VERSION,
  MINUTES_PER_DAY,
  Runner,
  createRng,
  createWorld,
  formatDate,
  stateHash,
  toCalendar,
} from '@datas-world/engine';
import type { WorldConfig } from '@datas-world/engine';
import {
  CONTROL_COMMANDS,
  WorldRepository,
  WorldSession,
  acquireWriterLock,
  closeDb,
  enqueueCommand,
  openReadonly,
  openWorldDb,
  releaseWriterLock,
  writerLock,
} from '@datas-world/persistence';
import type { ControlCommandName, Db } from '@datas-world/persistence';
import { bench } from './bench.ts';

export interface Io {
  out(line: string): void;
  err(line: string): void;
  /** Marca de tiempo real para `control_commands.created_at` (fuera del motor). */
  now(): string;
}

export const DEFAULT_DB = 'data/world.db';

export const USAGE = `Uso: pnpm cli <comando> [opciones]
  world:new --seed N [--population N] [--name TEXTO] [--epoch AAAA-MM-DDT00:00] [--tick MIN] [--db RUTA]
  world:advance --days N [--db RUTA]
  world:info [--json] [--db RUTA]
  control pause|resume|step|stop|speed <0|1|10|100|1000> [--db RUTA]
  bench [--days N] [--json]`;

const toInt = (name: string, v: string | undefined, min = 0): number => {
  const n = Number(v);
  if (v === undefined || !Number.isSafeInteger(n) || n < min)
    throw new UsageError(`--${name} debe ser un entero ≥ ${min}`);
  return n;
};

class UsageError extends Error {}

function withDb<T>(db: Db, fn: (db: Db) => T): T {
  try {
    return fn(db);
  } finally {
    closeDb(db);
  }
}

function worldNew(args: string[], io: Io): void {
  const { values: v } = parseArgs({
    args,
    options: {
      seed: { type: 'string' },
      population: { type: 'string', default: '200' },
      name: { type: 'string', default: 'Villa Cordillera' },
      epoch: { type: 'string', default: '2027-01-04T00:00' },
      tick: { type: 'string', default: '5' },
      db: { type: 'string', default: DEFAULT_DB },
    },
  });
  const config: WorldConfig = {
    name: v.name,
    seed: toInt('seed', v.seed),
    epoch: v.epoch,
    tickMinutes: toInt('tick', v.tick, 1),
    currency: { code: 'COP', minorUnit: 1 },
    population: { target: toInt('population', v.population) },
    engineVersion: ENGINE_VERSION,
    params: {},
    initialCapabilities: ['clock'],
    holidays: [],
  };
  const { world, events } = createWorld(config); // valida la configuración antes de tocar el disco
  mkdirSync(dirname(v.db), { recursive: true });
  withDb(openWorldDb(v.db), (db) => {
    const repo = new WorldRepository(db);
    if (repo.hasWorld()) throw new UsageError(`${v.db} ya contiene un mundo; usa otra --db`);
    repo.flush({ world, events });
    repo.saveSnapshot(world);
  });
  io.out(`Mundo ${world.id} «${config.name}» creado en ${v.db} (semilla ${config.seed}, hash ${stateHash(world)})`);
}

function worldAdvance(args: string[], io: Io): void {
  const { values: v } = parseArgs({
    args,
    options: { days: { type: 'string' }, db: { type: 'string', default: DEFAULT_DB } },
  });
  const days = toInt('days', v.days, 1);
  withDb(openWorldDb(v.db), (db) => {
    acquireWriterLock(db); // falla si el worker está en marcha (un solo escritor, R-001)
    try {
      const repo = new WorldRepository(db);
      const world = repo.loadWorld();
      const session = new WorldSession(repo, new Runner(world, createRng(world.config.seed)));
      session.advanceTicks((days * MINUTES_PER_DAY) / world.config.tickMinutes, (f) =>
        io.err(`avance: ${Math.round(f * 100)} %`),
      );
      io.out(
        `${world.id} avanzó ${days} días: minuto ${world.now} (${dateOf(world.now, world.config.epoch)}), hash ${stateHash(world)}`,
      );
    } finally {
      releaseWriterLock(db);
    }
  });
}

const dateOf = (minute: number, epoch: string): string => {
  const c = toCalendar(minute, epoch);
  return `${formatDate(c)} ${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`;
};

function worldInfo(args: string[], io: Io): void {
  const { values: v } = parseArgs({
    args,
    options: { json: { type: 'boolean', default: false }, db: { type: 'string', default: DEFAULT_DB } },
  });
  const info = withDb(openReadonly(v.db), (db) => {
    const repo = new WorldRepository(db);
    const world = repo.loadWorld(); // verifica el hash guardado
    return {
      id: world.id,
      name: world.config.name,
      seed: world.config.seed,
      engineVersion: world.config.engineVersion,
      now: world.now,
      date: dateOf(world.now, world.config.epoch),
      status: world.status,
      capabilities: world.capabilities,
      citizens: world.citizens.size,
      events: repo.countEvents(),
      daysStarted: repo.countEvents('DAY_STARTED'),
      lastSeq: repo.lastSeq,
      snapshots: repo.countSnapshots(),
      writerPid: writerLock(db),
      hash: stateHash(world),
      dbBytes: statSync(v.db).size,
    };
  });
  if (v.json) return io.out(JSON.stringify(info));
  io.out(`${info.id} «${info.name}» · semilla ${info.seed} · motor ${info.engineVersion}`);
  io.out(`  ${info.date} (minuto ${info.now}) · ${info.status} · capacidades: ${info.capabilities.join(', ')}`);
  io.out(
    `  ciudadanos ${info.citizens} · eventos ${info.events} (DAY_STARTED ${info.daysStarted}) · instantáneas ${info.snapshots}`,
  );
  io.out(
    `  hash ${info.hash} · base ${(info.dbBytes / 1024).toFixed(0)} KiB · escritor ${info.writerPid ?? 'ninguno'}`,
  );
}

function control(args: string[], io: Io): void {
  const { values: v, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { db: { type: 'string', default: DEFAULT_DB } },
  });
  const [cmd, arg] = positionals;
  if (!(CONTROL_COMMANDS as readonly string[]).includes(cmd ?? '')) {
    throw new UsageError(`Orden desconocida: ${cmd ?? '(ninguna)'}. Válidas: ${CONTROL_COMMANDS.join(', ')}`);
  }
  if (cmd === 'speed' && arg === undefined) throw new UsageError('speed necesita un valor: 0, 1, 10, 100 o 1000');
  const id = withDb(openWorldDb(v.db), (db) => enqueueCommand(db, cmd as ControlCommandName, arg ?? null, io.now()));
  io.out(`Orden ${id} (${cmd}${arg ? ` ${arg}` : ''}) encolada; el worker la aplicará en su próxima vuelta`);
}

const COMMANDS: Record<string, (args: string[], io: Io) => void> = {
  'world:new': worldNew,
  'world:advance': worldAdvance,
  'world:info': worldInfo,
  control,
  bench: (args, io) => bench(args, io),
};

/** Ejecuta un comando y devuelve el código de salida. */
export function run(argv: readonly string[], io: Io): number {
  const [name, ...args] = argv;
  const cmd = COMMANDS[name ?? ''];
  if (!cmd) {
    io.err(USAGE);
    return name === undefined || name === '--help' ? 0 : 2;
  }
  try {
    cmd(args, io);
    return 0;
  } catch (err) {
    io.err(`${name}: ${(err as Error).message}`);
    return err instanceof UsageError || (err as { code?: string }).code?.startsWith('ERR_PARSE_ARGS') ? 2 : 1;
  }
}
