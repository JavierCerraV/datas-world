// Causalidad hasta el origen (spec 019 v0.2): origen de los estados y árbol de causas.
export { ORIGIN_RULES, STRESS_KEYS, createOriginsSystem, originCause, sleepCauses } from './origins.ts';
export type { OriginKey, StateOrigins } from './origins.ts';
export { WHY_DEFAULTS, walk, why, whyLines } from './why.ts';
export type { WhyNode, WhyOptions } from './why.ts';
