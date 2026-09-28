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

/** Prefijo de las respuestas conversacionales en el almacén de funciones (036 R-002). */
export const STANCE_PREFIX = 'conv.';
export const stanceResponse = (stance: string): string => `${STANCE_PREFIX}${stance}`;

/** Estímulo del visitante en el almacén de funciones de la persona (R-018). */
export const visitorStimulus = (visitorId: string): string => `ext.${visitorId}`;
