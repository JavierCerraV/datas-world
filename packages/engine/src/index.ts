// API pública del motor. Mundo, reloj y eventos (specs 001, 002, 014) llegan en el bloque C.
export { createRng, restoreRng } from './rng.ts';
export type { Rng, RngState } from './rng.ts';
