// Parámetros de la charla (spec 043 §8). Todos [M] salvo que se diga otra cosa.

export interface ChatParams {
  /** R-007: decaimiento de la carga aversiva por turno (PA-136). */
  loadDecay: number;
  /** R-008: peso del reforzador (acercarse a lo apetitivo, escapar de lo aversivo de este turno). */
  reinforcerWeight: number;
  /** R-007: peso del reforzamiento negativo por la carga acumulada. */
  escapeWeight: number;
  /** R-008: cuánto multiplican el escape la energía baja y el estrés alto (operación motivadora). */
  motivationWeight: number;
  /** R-019: minutos que habla en medio de una obligación (`BUSY_WINDOW_MIN`). */
  busyWindowMin: number;
  /** R-021: cambio máximo por charla de una función o una fuerza (`MAX_LEARNING_DELTA`, PA-137; aprobado por el usuario). */
  maxLearningDelta: number;
  /** R-022: cambio máximo de ánimo y estrés por charla (`MAX_MOOD_DELTA`, PA-137; aprobado por el usuario). */
  maxMoodDelta: number;
  /** R-022: `k` del efecto emocional, `k × valencia × intensidad`. */
  moodK: number;
  /** Consecuencias de lo dicho sobre terceros (044); si falta, `CLAIM_DEFAULTS`. */
  claims?: ClaimParams;
}

export const CHAT_DEFAULTS: ChatParams = Object.freeze({
  loadDecay: 0.2,
  reinforcerWeight: 1,
  escapeWeight: 1,
  motivationWeight: 0.5,
  busyWindowMin: 10,
  maxLearningDelta: 0.1,
  maxMoodDelta: 0.15,
  moodK: 0.3,
});

/** Parámetros de las consecuencias de la charla (spec 044 §8). Todos [M]. */
export interface ClaimParams {
  /** R-002 (PA-138): credibilidad de partida y pesos de la fuente (el visitante), la confianza y la contradicción. */
  credBase: number;
  credSource: number;
  credTrust: number;
  credContra: number;
  /** §5: credibilidad mínima para que la afirmación quede como creencia (`BELIEF_MIN`). */
  beliefMin: number;
  /** R-003: cuánto amplifica el impacto que la afirmación se oponga a un valor (038 R-007). */
  valueAmp: number;
  /** R-005 (PA-139): `STRESS_K` y tope propio `MAX_CLAIM_STRESS_DELTA` (mayor que `maxMoodDelta`). */
  stressK: number;
  maxClaimStressDelta: number;
  /** R-007 [M]: confianza de partida de un vínculo aún no tocado, familiar u otro (hasta la 012; PA-140). */
  trust0Family: number;
  trust0Other: number;
}

export const CLAIM_DEFAULTS: ClaimParams = Object.freeze({
  credBase: 0.4,
  credSource: 0.3,
  credTrust: 0.4,
  credContra: 0.6,
  beliefMin: 0.3,
  valueAmp: 0.5,
  stressK: 0.5,
  maxClaimStressDelta: 0.35,
  trust0Family: 0.6,
  trust0Other: 0.5,
});

/** Prefijo de las respuestas conversacionales en el almacén de funciones (036 R-002). */
export const STANCE_PREFIX = 'conv.';
export const stanceResponse = (stance: string): string => `${STANCE_PREFIX}${stance}`;

/** Estímulo del visitante en el almacén de funciones de la persona (R-018). */
export const visitorStimulus = (visitorId: string): string => `ext.${visitorId}`;
