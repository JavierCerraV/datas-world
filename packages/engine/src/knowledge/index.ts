// Conocimiento, creencias y rumores (spec 025 v0.2).
export { KNOWLEDGE_DEFAULTS, SEEN, TELL, topicOf } from './types.ts';
export type { KnowledgeCatalog, KnowledgeParams, TopicDef } from './types.ts';
export { beliefTruth, closeness, hear, learn as learnBelief, topicsOf } from './beliefs.ts';
export type { Hearing, Listener } from './beliefs.ts';
export { tellInEncounter } from './tell.ts';
export type { TellDeps, TellSide } from './tell.ts';
export { createKnowledgeSystem } from './system.ts';
export type { KnowledgeDeps } from './system.ts';
