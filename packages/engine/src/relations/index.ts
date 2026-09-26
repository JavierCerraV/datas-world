// Módulo `relations` (spec 037): capa 3 del motor funcional.
export { INVERSE, compose, derive, functionalValue, transformFactor } from './derive.ts';
export type { FunctionalValue } from './derive.ts';
export { networkMetrics, teach } from './network.ts';
export type { Teaching } from './network.ts';
export { EVENT_TEACHING, relationalNetworkOf, relationsSystem } from './system.ts';
export type { TeachingRule } from './system.ts';
export { ATTENUATION, CFUNC_DEFAULT, COMP_FACTOR, MAX_DEPTH, MAX_RELATIONS, emptyNetwork } from './types.ts';
export type { Derived, NetworkMetrics, Relation, RelationType, RelationalNetwork } from './types.ts';
