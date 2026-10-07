// Corrida de un brazo de un experimento (spec 028 R-001 a R-007): la rama desde una instantánea con la vida diaria, las
// intervenciones como entradas externas, el azar común por semilla y las métricas por persona. No toca disco: la base,
// el informe y los archivos son de la CLI. Los eventos de cada día se cuentan y se descartan (R-007).
import { EXPERIMENT_FEED_KINDS, EventCounter, MINUTES_PER_DAY, Rolling, adults, createRng, eventTypesOf, experimentInputs, idNumber, measure, selectSample, stateHash } from '@datas-world/engine';
import type { Arm, EntityId, Experiment, Intervention, MetricId, World } from '@datas-world/engine';
import type { Catalogs } from '../catalogs/load.ts';
import { lifeRunner } from '../life.ts';

export interface Observation {
  seed: number;
  arm: string;
  citizenId: EntityId;
  day: number;
  metric: MetricId;
  value: number;
}

export interface InterventionLog {
  seed: number;
  arm: string;
  afterDays: number;
  kind: string;
  citizenId?: EntityId;
  ok: boolean;
  /** Si no se aplicó: el motivo del manejador. */
  reason?: string;
}

export interface ArmResult {
  branchHash: string;
  endHash: string;
  observations: Observation[];
  interventions: InterventionLog[];
  peakRssBytes: number;
}

/** Las personas que se miden: las dadas (vivas) o una muestra estratificada de adultos con el flujo `experiment:subjects`. */
export function experimentSubjects(world: World, subjects: Experiment['subjects']): EntityId[] {
  const alive = (id: EntityId) => world.citizens.get(id)?.status === 'active' && world.components.u8.active?.[idNumber(id)] === 1;
  if ('citizens' in subjects) return subjects.citizens.filter(alive);
  return selectSample(adults(world), subjects.sample, createRng(world.config.seed).fork('experiment:subjects')).map((p) => p.id);
}

/**
 * Corre un brazo con una semilla. `world` es la instantánea cargada (se modifica: pásale una copia propia). Todos los
 * brazos de un experimento llegan a `branchAt` con el mismo hash (INV-004) y siguen con el azar de `seed` (R-005).
 */
export function runArm(world: World, def: Experiment, arm: Arm, seed: number, subjects: readonly EntityId[], catalogs: Catalogs, onDay?: (d: number) => void): ArmResult {
  const tickMin = world.config.tickMinutes;
  const branchAt = def.base.branchAt === 0 ? world.now : def.base.branchAt;
  if (branchAt < world.now) throw new Error(`la rama (${branchAt}) es anterior a la instantánea (${world.now})`);
  // R-001: hasta la rama, sin intervenir y con el azar de la base (el mismo para todos los brazos).
  lifeRunner(world, catalogs).advanceTicks((branchAt - world.now) / tickMin);
  const branchHash = stateHash(world);

  // R-005: desde la rama, el azar de la semilla; las intervenciones llegan a los sistemas (R-003).
  const runner = lifeRunner(world, catalogs, {}, { rngSeed: seed, inputs: experimentInputs(), feedKinds: EXPERIMENT_FEED_KINDS });
  const log: InterventionLog[] = [];
  const submit = (iv: { afterDays: number; kind: string; citizenId?: EntityId; payload: unknown }) => {
    const base = { seed, arm: arm.name, afterDays: iv.afterDays, kind: iv.kind, ...(iv.citizenId ? { citizenId: iv.citizenId } : {}) };
    try {
      runner.submit(iv.kind, iv.payload);
      log.push({ ...base, ok: true });
    } catch (e) {
      log.push({ ...base, ok: false, reason: (e as Error).message.replace(/^Entrada externa rechazada \([^)]*\): /, '') });
    }
  };
  for (const c of arm.capabilities?.disable ?? []) submit({ afterDays: 0, kind: 'disable_capability', payload: { capability: c } });
  for (const c of arm.capabilities?.enable ?? []) submit({ afterDays: 0, kind: 'enable_capability', payload: { capability: c } });

  const counter = new EventCounter(eventTypesOf(def.metrics));
  const rolling = { mood: new Rolling(), stress: new Rolling() };
  const stateMetrics = def.metrics.filter((m) => m !== 'psychometrics');
  const observations: Observation[] = [];
  let peak = 0;
  const push = () => {
    for (const id of subjects) {
      const row = idNumber(id);
      rolling.mood.push(id, world.components.f32['state.mood']?.[row] ?? 0.5);
      rolling.stress.push(id, world.components.f32['state.stress']?.[row] ?? 0);
    }
  };
  const observe = (day: number) => {
    for (const id of subjects) {
      if (world.components.u8.active?.[idNumber(id)] !== 1) continue;
      for (const metric of stateMetrics) {
        const value = measure(world, id, metric, rolling, counter);
        if (value !== null && Number.isFinite(value)) observations.push({ seed, arm: arm.name, citizenId: id, day, metric, value });
      }
    }
  };
  const targets = (iv: Intervention): EntityId[] => (iv.target === 'subjects' ? [...subjects] : iv.target ? [iv.target as EntityId] : []);
  const ticksPerDay = MINUTES_PER_DAY / tickMin;
  push();
  for (let day = 0; day <= def.durationDays; day++) {
    for (const iv of arm.interventions.filter((i) => i.afterDays === day)) {
      if (iv.kind === 'enable_capability' || iv.kind === 'disable_capability') submit({ afterDays: day, kind: iv.kind, payload: { capability: iv.params?.capability } });
      else
        for (const citizenId of targets(iv))
          submit({ afterDays: day, kind: iv.kind, citizenId, payload: iv.kind === 'grant_money' ? { citizenId, amount: iv.params?.amount } : { citizenId } });
    }
    if (day === 0) observe(0);
    if (day === def.durationDays) break;
    runner.advanceTicks(ticksPerDay);
    counter.add(runner.drainEvents());
    push();
    peak = Math.max(peak, process.memoryUsage().rss);
    onDay?.(day + 1);
    if ((day + 1) % def.sampleEveryDays === 0 || day + 1 === def.durationDays) observe(day + 1);
  }
  return { branchHash, endHash: stateHash(world), observations, interventions: log, peakRssBytes: peak };
}
