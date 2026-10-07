// Experimentos y ramas (spec 028): definición, intervenciones, métricas y comparación.
export { BASE_METRICS, EXPERIMENT_LIMITS, INTERVENTION_KINDS, parseExperiment } from './types.ts';
export type { Arm, Experiment, Intervention, InterventionKind, MetricId, Subjects } from './types.ts';
export { EXPERIMENT_FEED_KINDS, experimentInputs } from './interventions.ts';
export { EventCounter, ROLLING_DAYS, Rolling, STRONG_BOND_TRUST, eventTypesOf, measure } from './metrics.ts';
export { BOOTSTRAP_N, pairedContrast } from './compare.ts';
export type { Contrast, Pair } from './compare.ts';
