// Módulo `decision` (spec 017): opciones, utilidad, selección, validación de acciones y sistema.
export { DECISION_COLUMNS, activityOf, defineDecisionColumns } from './columns.ts';
export type { LeisureActivity, LeisureTable } from './columns.ts';
export { buildOptions, explainCauses, freeUntil } from './options.ts';
export type { ActionParams, DecisionCtx, Factor, Option } from './options.ts';
export { choose, createDecisionSystem, softmax, temperatureOf } from './system.ts';
export { ACTION_KINDS, createActionValidator } from './validate.ts';
