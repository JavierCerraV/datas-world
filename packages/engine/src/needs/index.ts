// Módulo `needs` (spec 010): sistemas, columnas, parámetros y emociones por evento.
import { illnessSystem, sleepSystem } from './illness.ts';
import { needsSystem } from './system.ts';

export { EMOTIONS, NEEDS, NEEDS_COLUMNS, defineNeedsColumns, initNeeds, stability } from './columns.ts';
export { EVENT_EMOTIONS, emotionPatches } from './emotions.ts';
export { illnessSystem, sleepSystem } from './illness.ts';
export { acuteKeys, needsParams } from './params.ts';
export type { NeedsParams } from './params.ts';
export { needsSystem } from './system.ts';

/** Los sistemas del módulo, para registrarlos (021). */
export const NEEDS_SYSTEMS = Object.freeze([needsSystem, illnessSystem, sleepSystem]);
