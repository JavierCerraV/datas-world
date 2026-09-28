// Eventos privados, PNR, evitación experiencial y flexibilidad (spec 039, capa 5 del motor funcional).
export { AVOIDANCE_RESPONSES, AVOIDANCE_W0, PRIVATE_DEFAULTS, SELF_RESPONSE } from './params.ts';
export type { AvoidanceResponse, PrivateParams } from './params.ts';
export { activate, applyStep, consolidate, derivationStep, fade, focusOf, loadOf, rawLoadOf, responseStrength, scale, seedResponse } from './pnr.ts';
export type { StepResult } from './pnr.ts';
export { avoidanceOf, createPrivateSystem, mindTick, stepMind } from './system.ts';
export type { MindCtx, MindTick } from './system.ts';
export type { EpisodeEnd, MindState, PnrEpisode, PrivateEvent } from './types.ts';
