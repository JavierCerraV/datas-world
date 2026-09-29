// Memoria autobiográfica (spec 013 v0.3): episodios, olvido, recuperación y reconstrucción, consolidación en la red
// y capítulos.
export { CHAT_RECALL, MEMORY_DEFAULTS, emptyMemory } from './types.ts';
export type { Chapter, Memory, MemoryParams, MemoryStore } from './types.ts';
export { MEMORY_KINDS, peopleOf } from './kinds.ts';
export type { MemoryKind } from './kinds.ts';
export { addMemory, decayDay as memoryDecayDay, distortion, encodeEvent, episodeValue, recall, rehearse, remembererOf, retention, trim as trimMemory } from './episodes.ts';
export type { FnOf, RecallContext } from './episodes.ts';
export { consolidate as consolidateMemory, openChapter, updateChapters } from './consolidate.ts';
export type { SchemaChange } from './consolidate.ts';
export { createMemorySystem } from './system.ts';
