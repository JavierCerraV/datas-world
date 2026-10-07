// `pnpm cli experiment:run <definición.json>` (spec 028): corre los brazos de un experimento sobre una instantánea de una
// base, sin escribir en ella (INV-003; abre en solo lectura), y escribe `<out>.json`, `<out>.csv` y `<out>.xlsx`.
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { deserializeWorld, parseExperiment, serializeWorld, stateHash } from '@datas-world/engine';
import type { Experiment } from '@datas-world/engine';
import { experimentSubjects, loadCatalogs, runArm } from '@datas-world/generators';
import type { InterventionLog, Observation } from '@datas-world/generators';
import { WorldRepository, openReadonly } from '@datas-world/persistence';
import { UsageError, dateOf, withDb } from './common.ts';
import type { Io } from './common.ts';
import { contrasts, csvOf, workbookOf } from './experiment-report.ts';
import type { ArmRun, ExperimentResult } from './experiment-report.ts';

const MB = 1024 * 1024;

export function experimentRun(args: string[], io: Io): void {
  const { values: v, positionals } = parseArgs({
    args, allowPositionals: true,
    options: { out: { type: 'string' }, db: { type: 'string' } },
  });
  const file = positionals[0];
  if (!file) throw new UsageError('Uso: experiment:run <definición.json> [--out RUTA] [--db RUTA]');
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { base?: { db?: string } };
  const def: Experiment = parseExperiment(raw);
  const dbPath = v.db ?? resolve(dirname(file), def.base.db);
  if (def.metrics.includes('psychometrics')) throw new UsageError('la métrica psychometrics aún no se mide en experimentos (spec 028 §10); quítela de metrics');
  const out = v.out ?? `data/experimentos/${def.id}`;
  const before = statSync(dbPath);

  // R-001: la instantánea de la base (en solo lectura). Con `branchAt` 0, el estado actual de la base.
  const { snapshot, world0 } = withDb(openReadonly(dbPath), (db) => {
    const repo = new WorldRepository(db);
    const w = def.base.branchAt === 0 ? repo.loadWorld() : repo.loadSnapshot(def.base.branchAt);
    if (!w) throw new UsageError(`la base no tiene una instantánea en o antes del minuto ${def.base.branchAt}`);
    return { snapshot: serializeWorld(w), world0: w };
  });
  const branchAt = def.base.branchAt === 0 ? world0.now : def.base.branchAt;
  const resolved: Experiment = { ...def, base: { ...def.base, branchAt } };
  const catalogs = loadCatalogs();
  const subjects = experimentSubjects(world0, def.subjects);
  if (subjects.length === 0) throw new UsageError('no hay personas vivas que medir');
  const total = def.seeds.length * def.arms.length;
  io.err(`Experimento ${def.id}: ${def.arms.length} brazos × ${def.seeds.length} semillas × ${def.durationDays} días, ${subjects.length} personas, rama en ${dateOf(branchAt, world0.config.epoch)}`);

  const observations: Observation[] = [];
  const interventions: InterventionLog[] = [];
  const runs: ArmRun[] = [];
  let n = 0;
  for (const seed of def.seeds) {
    for (const arm of def.arms) {
      const r = runArm(deserializeWorld(snapshot), resolved, arm, seed, subjects, catalogs);
      observations.push(...r.observations);
      interventions.push(...r.interventions);
      // El pico de memoria varía entre ejecuciones: va a la consola, no a los archivos (R-009: mismo informe, byte a byte).
      runs.push({ arm: arm.name, seed, branchHash: r.branchHash, endHash: r.endHash });
      io.err(`  ${++n}/${total} ${arm.name} (semilla ${seed}): ${r.interventions.filter((i) => i.ok).length} intervenciones aplicadas, ${r.interventions.filter((i) => !i.ok).length} rechazadas, pico ${Math.round(r.peakRssBytes / MB)} MB`);
    }
  }
  const result: ExperimentResult = {
    def: resolved,
    meta: { engine: world0.config.engineVersion, baseHash: stateHash(world0), branchAt, branchDate: dateOf(branchAt, world0.config.epoch), world: world0.id, subjects },
    runs, observations, interventions,
  };
  const rows = contrasts(result);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(`${out}.json`, `${JSON.stringify({ ...result, contrasts: rows })}\n`);
  writeFileSync(`${out}.csv`, csvOf(observations));
  writeFileSync(`${out}.xlsx`, workbookOf(result, rows));
  const after = statSync(dbPath);
  if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw new Error('la base cambió durante el experimento (INV-003)');
  io.out(`Experimento ${def.id}: ${rows.length} contrastes → ${out}.xlsx, ${out}.csv y ${out}.json`);
}
