// Comandos de la CLI: crear, avanzar, consultar y controlar un mundo, y bench.
// No contienen reglas de simulación: solo combinan engine, generators y persistence.
import { statSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { MINUTES_PER_DAY, stateHash } from '@datas-world/engine';
import { lifeRunner, pendingEntries } from '@datas-world/generators';
import {
  CONTROL_COMMANDS,
  WorldRepository,
  WorldSession,
  acquireWriterLock,
  enqueueCommand,
  openReadonly,
  openWorldDb,
  releaseWriterLock,
  writerLock,
} from '@datas-world/persistence';
import type { ControlCommandName } from '@datas-world/persistence';
import { bench } from './bench.ts';
import { chatBattery } from './battery.ts';
import { chatStatsCommand } from './chat-stats.ts';
import { psychometrics } from './psychometrics.ts';
import { experimentRun } from './experiment.ts';
import { studySession } from './study-session.ts';
import { benchLife } from './bench-life.ts';
import { benchRelations } from './bench-relations.ts';
import { validateParity } from './validate.ts';
import { DEFAULT_DB, UsageError, dateOf, toInt, withDb } from './common.ts';
import type { Io } from './common.ts';
import { citizenExplain, eventWhy } from './explain.ts';
import { citizenLife } from './life.ts';
import { citizenReport, worldHistory } from './history.ts';
import { worldMap } from './map.ts';
import { worldReport } from './report.ts';
import { worldNew } from './world-new.ts';

export { DEFAULT_DB } from './common.ts';
export type { Io } from './common.ts';

export const USAGE = `Uso: pnpm cli <comando> [opciones]
  world:new --seed N [--profile CO-2026.09|prototipo] [--population N] [--name TEXTO] [--epoch AAAA-MM-DDT00:00]
            [--tick MIN] [--empty] [--db RUTA]
  world:advance --days N [--db RUTA]
  world:info [--json] [--db RUTA]
  world:report [--history] [--json] [--db RUTA]
  world:map [--db RUTA]
  world:history [--from AAAA] [--to AAAA] [--type TIPO,…] [--citizen CIT] [--place PLC|ORG] [--limit N]
                [--no-causes] [--db RUTA]
  citizen:report CIT-000123 [--db RUTA]
  citizen:explain EVT-00000012345 [--db RUTA]   la cadena que explica una conducta elegida (035)
  event:why EVT-00000012345 [--depth 4] [--db RUTA]   el árbol de causas de un evento, hasta su origen (019)
  citizen:life CIT-000123 [--db RUTA]   informe de vida: etapas vividas y recordadas, lo que cambió su vida y su perfil (020)
  control pause|resume|step|stop|speed <0|1|10|100|1000> [--db RUTA]
  bench [--days N] [--json] [--check]
  validate:parity [--profile prototipo|CO-2026.09] [--seeds N-M] [--days N] [--population N] [--out RUTA]
  bench:life [--population 500] [--days 365] [--profile CO-2026.09] [--out RUTA]
  bench:relations [--out RUTA]
  chat:battery [--citizens N|CIT-…,…] [--scripts all|clave,…] [--provider mock|config] [--out RUTA] [--db RUTA]
  chat:stats [--json] [--db RUTA]
  experiment:run <definición.json> [--out RUTA] [--db RUTA]
  psychometrics [--provider mock|config] [--n 50] [--month-days 30] [--year-days 365] [--concurrency 4] [--delay-ms 0] [--per-call person|instrument] [--llm-config RUTA] [--resume] [--db RUTA] [--work RUTA] [--out RUTA]
  study:session [--citizen CIT-000123] [--session 1] [--previous sesion.json] [--provider mock|config] [--llm-config RUTA] [--max-turns 40] [--work RUTA] [--gap-days 7] [--out RUTA] [--db RUTA]   una sesión del protocolo, para leer el diálogo (047)`;

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
      // La vida diaria de M2 (bloque H); un mundo sin sus capacidades (M1) solo avanza el reloj.
      const session = new WorldSession(repo, lifeRunner(world));
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

function worldInfo(args: string[], io: Io): void {
  const { values: v } = parseArgs({
    args,
    options: { json: { type: 'boolean', default: false }, db: { type: 'string', default: DEFAULT_DB } },
  });
  const info = withDb(openReadonly(v.db), (db) => {
    const repo = new WorldRepository(db);
    const world = repo.loadWorld(); // verifica el hash guardado
    const all = [...world.citizens.values()];
    return {
      id: world.id,
      name: world.config.name,
      seed: world.config.seed,
      profile: world.config.profile?.id ?? null,
      // 029 CA-003: las cifras del perfil que están por confirmar.
      pending: world.config.profile ? pendingEntries(world.config.profile).map((e) => e.key) : [],
      engineVersion: world.config.engineVersion,
      now: world.now,
      date: dateOf(world.now, world.config.epoch),
      status: world.status,
      capabilities: world.capabilities,
      citizens: all.filter((c) => !c.ancestor).length,
      ancestors: all.filter((c) => c.ancestor).length,
      households: world.households.size,
      places: world.places.size,
      organizations: world.organizations.size,
      objects: world.objects.size,
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
  io.out(`${info.id} «${info.name}» · semilla ${info.seed} · perfil ${info.profile ?? '—'} · motor ${info.engineVersion}`);
  io.out(`  ${info.date} (minuto ${info.now}) · ${info.status} · capacidades: ${info.capabilities.join(', ')}`);
  io.out(
    `  ciudadanos ${info.citizens} · antepasados ${info.ancestors} · hogares ${info.households} · lugares ${info.places} · organizaciones ${info.organizations} · objetos ${info.objects}`,
  );
  io.out(`  eventos ${info.events} (DAY_STARTED ${info.daysStarted}) · instantáneas ${info.snapshots}`);
  if (info.profile) io.out(`  cifras por confirmar (${info.pending.length}): ${info.pending.join(', ') || 'ninguna'}`);
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
  'world:report': worldReport,
  'world:map': worldMap,
  'world:history': worldHistory,
  'citizen:report': citizenReport,
  'citizen:explain': citizenExplain,
  'event:why': eventWhy,
  'citizen:life': citizenLife,
  control,
  bench: (args, io) => bench(args, io),
  'validate:parity': (args, io) => validateParity(args, io),
  'bench:life': (args, io) => benchLife(args, io),
  'bench:relations': (args, io) => benchRelations(args, io),
  'chat:stats': chatStatsCommand,
  'experiment:run': experimentRun,
};

/** Comandos asíncronos (usan la pasarela LLM, 026). */
const ASYNC_COMMANDS: Record<string, (args: string[], io: Io) => Promise<void>> = {
  'chat:battery': (args, io) => chatBattery(args, io),
  psychometrics: (args, io) => psychometrics(args, io),
  'study:session': (args, io) => studySession(args, io),
};

/** Como `run`, pero también atiende los comandos asíncronos (el punto de entrada usa este). */
export async function runAsync(argv: readonly string[], io: Io): Promise<number> {
  const [name, ...args] = argv;
  const cmd = ASYNC_COMMANDS[name ?? ''];
  if (!cmd) return run(argv, io);
  try {
    await cmd(args, io);
    return 0;
  } catch (err) {
    io.err(`${name}: ${(err as Error).message}`);
    return err instanceof UsageError || (err as { code?: string }).code?.startsWith('ERR_PARSE_ARGS') ? 2 : 1;
  }
}

/** Ejecuta un comando síncrono y devuelve el código de salida. */
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
