// Módulo `functions` (spec 036): capa 2 del motor funcional.
export { elicitationGain } from './elicit.ts';
export {
  DEFAULT_K,
  DEFAULT_VARIABILITY,
  K_MAX,
  K_MIN,
  discountKOf,
  discounted,
  initLearnedStates,
  leisureResponse,
  leisureStrength0,
  variabilityOf,
} from './history.ts';
export { distance, elicited, gradient, isGeneralized, netValue, operant, ownValue, pair, prune, reinforcingValue } from './learn.ts';
export type { Trial } from './learn.ts';
export { EVENT_LEARNING, WORLD_STIMULI } from './rules.ts';
export type { LearningRule } from './rules.ts';
export { createOntology, sensitivityOf } from './sensitivity.ts';
export { createLearningSystem, learningParams, storeOf } from './system.ts';
export { LEARNING_DEFAULTS, NEUTRAL, emptyStore } from './types.ts';
export type { FunctionEntry, FunctionStore, Inhibition, LearningParams, Ontology, ResponseEntry, Sensitivity, StimulusClass } from './types.ts';
