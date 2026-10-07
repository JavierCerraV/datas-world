// Definición de un experimento (spec 028 §3) y su validación. Pura: la CLI lee el archivo y llama a `parseExperiment`.
import { CAPABILITIES, isCapability } from '../capabilities.ts';
import type { Capability } from '../capabilities.ts';
import type { EntityId } from '../ids.ts';

export const INTERVENTION_KINDS = ['force_job_loss', 'grant_money', 'enable_capability', 'disable_capability'] as const;
export type InterventionKind = (typeof INTERVENTION_KINDS)[number];

export interface Intervention {
  /** Días después de la rama. */
  afterDays: number;
  kind: InterventionKind;
  /** Una persona, o `subjects` (todas las medidas). Las capacidades no tienen persona. */
  target?: EntityId | 'subjects';
  /** `amount` (grant_money) o `capability` (enable/disable). */
  params?: Record<string, number | string>;
}

export interface Arm {
  name: string;
  interventions: Intervention[];
  capabilities?: { enable?: Capability[]; disable?: Capability[] };
}

/** Quién se mide: personas dadas, o una muestra estratificada de `sample` adultos (045 R-005). */
export type Subjects = { citizens: EntityId[] } | { sample: number };

export const BASE_METRICS = ['mood', 'stress', 'money', 'debt', 'employed', 'bonds', 'pnr_episodes'] as const;
/** `events:<TYPE>` cuenta un tipo de evento; `psychometrics` es la batería de la 045. */
export type MetricId = (typeof BASE_METRICS)[number] | `events:${string}` | 'psychometrics';

export interface Experiment {
  id: string;
  base: { db: string; branchAt: number };
  durationDays: number;
  seeds: number[];
  arms: Arm[];
  metrics: MetricId[];
  sampleEveryDays: number;
  subjects: Subjects;
}

/** 028 §8. */
export const EXPERIMENT_LIMITS = Object.freeze({ maxArms: 10, maxSeeds: 30, maxDays: 730, defaultDays: 90, defaultSeeds: 5, defaultSampleEvery: 7 });

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const fail = (m: string): never => {
  throw new Error(`experimento inválido: ${m}`);
};
const int = (v: unknown, name: string, min: number, max: number): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fail(`${name} debe ser un entero entre ${min} y ${max}`);

function parseIntervention(v: unknown, arm: string, durationDays: number): Intervention {
  if (!isObj(v)) return fail(`una intervención de «${arm}» no es un objeto`);
  const kind = v.kind as InterventionKind;
  if (!INTERVENTION_KINDS.includes(kind)) return fail(`intervención desconocida «${String(v.kind)}» en «${arm}»`);
  const afterDays = int(v.afterDays ?? 0, 'afterDays', 0, durationDays);
  const params = isObj(v.params) ? (v.params as Record<string, number | string>) : undefined;
  if (kind === 'grant_money') int(params?.amount, 'params.amount de grant_money', 1, 2_000_000_000);
  if (kind === 'enable_capability' || kind === 'disable_capability') {
    if (!isCapability(params?.capability)) fail(`capacidad desconocida en «${arm}» (${String(params?.capability)}; válidas: ${CAPABILITIES.join(', ')})`);
  } else if (typeof v.target !== 'string') fail(`${kind} de «${arm}» necesita un target (una persona o «subjects»)`);
  return { afterDays, kind, ...(typeof v.target === 'string' ? { target: v.target as EntityId | 'subjects' } : {}), ...(params ? { params } : {}) };
}

/** Valida la definición leída de un archivo y completa los valores por defecto (028 §8). Lanza con el motivo. */
export function parseExperiment(raw: unknown): Experiment {
  if (!isObj(raw)) return fail('no es un objeto');
  const L = EXPERIMENT_LIMITS;
  if (typeof raw.id !== 'string' || !/^[A-Za-z0-9._-]+$/.test(raw.id)) fail('id vacío o con caracteres no permitidos');
  if (!isObj(raw.base) || typeof raw.base.db !== 'string') fail('base.db es obligatorio');
  const base = raw.base as { db: string; branchAt?: unknown };
  const durationDays = int(raw.durationDays ?? L.defaultDays, 'durationDays', 1, L.maxDays);
  const seeds = Array.isArray(raw.seeds) ? raw.seeds.map((s, i) => int(s, `seeds[${i}]`, 0, 0xffffffff)) : Array.from({ length: L.defaultSeeds }, (_, i) => i + 1);
  if (seeds.length < 1 || seeds.length > L.maxSeeds || new Set(seeds).size !== seeds.length) fail(`seeds: entre 1 y ${L.maxSeeds}, sin repetir`);
  if (!Array.isArray(raw.arms) || raw.arms.length < 2 || raw.arms.length > L.maxArms) fail(`arms: entre 2 y ${L.maxArms} (el primero es el control)`);
  const arms = (raw.arms as unknown[]).map((a): Arm => {
    if (!isObj(a) || typeof a.name !== 'string' || a.name === '') return fail('cada brazo necesita un name');
    const interventions = Array.isArray(a.interventions) ? a.interventions.map((i) => parseIntervention(i, a.name as string, durationDays)) : [];
    const caps = isObj(a.capabilities) ? (a.capabilities as { enable?: unknown[]; disable?: unknown[] }) : undefined;
    for (const c of [...(caps?.enable ?? []), ...(caps?.disable ?? [])]) if (!isCapability(c)) fail(`capacidad desconocida «${String(c)}» en «${a.name as string}»`);
    return { name: a.name as string, interventions, ...(caps ? { capabilities: { ...(caps.enable ? { enable: caps.enable as Capability[] } : {}), ...(caps.disable ? { disable: caps.disable as Capability[] } : {}) } } : {}) };
  });
  if (new Set(arms.map((a) => a.name)).size !== arms.length) fail('los brazos deben llamarse distinto');
  const metrics = (Array.isArray(raw.metrics) && raw.metrics.length ? raw.metrics : ['mood', 'stress', 'money', 'employed']) as unknown[];
  for (const m of metrics)
    if (typeof m !== 'string' || !((BASE_METRICS as readonly string[]).includes(m) || m === 'psychometrics' || /^events:[A-Z_]+$/.test(m))) fail(`métrica desconocida «${String(m)}»`);
  const subjects: Subjects = isObj(raw.subjects) && Array.isArray(raw.subjects.citizens)
    ? { citizens: (raw.subjects.citizens as unknown[]).map((c) => (typeof c === 'string' && /^CIT-\d+$/.test(c) ? (c as EntityId) : fail(`persona inválida «${String(c)}»`))) }
    : { sample: int(isObj(raw.subjects) ? raw.subjects.sample : 50, 'subjects.sample', 8, 199) };
  return {
    id: raw.id as string,
    base: { db: base.db, branchAt: int(base.branchAt ?? 0, 'base.branchAt', 0, Number.MAX_SAFE_INTEGER) },
    durationDays, seeds, arms, metrics: metrics as MetricId[],
    sampleEveryDays: int(raw.sampleEveryDays ?? L.defaultSampleEvery, 'sampleEveryDays', 1, 90), subjects,
  };
}
