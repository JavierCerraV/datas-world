// Módulo `decision` (spec 040): candidatas, aportes por fuente de control, selección, validación y sistema.
export { DECISION_COLUMNS, activityOf, defineDecisionColumns } from './columns.ts';
export type { LeisureActivity, LeisureTable } from './columns.ts';
export { OBLIGATION_DELAY_DAYS, buildOptions, explainCauses, freeUntil } from './options.ts';
export type { ActionParams, ControlSource, DecisionCtx, Option, SourceContribution } from './options.ts';
export { STRENGTH_REF, STRENGTH_SCALE, pickIndex, softmax, strengthContribution, temperatureOf } from './select.ts';
export { choose, createDecisionSystem } from './system.ts';
export { ACTION_KINDS, createActionValidator } from './validate.ts';
