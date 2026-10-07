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
  /** Prudencia ante un desconocido (R-024 a R-026); si falta, `STRANGER_DEFAULTS`. */
  stranger?: StrangerParams;
}

/** Prudencia ante un desconocido (spec 043 v0.7, §8). Todos [M] (PA-154). */
export interface StrangerParams {
  /** R-024: familiaridad que suma cada turno previo con el visitante (ensayos de su función), cada turno cálido de esta sesión y el valor positivo del visitante. */
  fPrevTurn: number;
  fTurn: number;
  fValue: number;
  /** R-025: peso de la cautela en la postura. */
  exposureCost: number;
  /** R-026: familiaridad con que se abre el nivel personal (1) y el íntimo (2), y valor mínimo del visitante para el 2. */
  discloseL1: number;
  discloseL2: number;
  discloseValue: number;
  /** R-025: menores de esta edad no hablan con extraños (regla *pliance*) y su peso. */
  minorAge: number;
  minorRule: number;
}

export const STRANGER_DEFAULTS: StrangerParams = Object.freeze({
  fPrevTurn: 0.04,
  fTurn: 0.07,
  fValue: 0.3,
  exposureCost: 2,
  discloseL1: 0.25,
  discloseL2: 0.6,
  discloseValue: 0.1,
  minorAge: 14,
  minorRule: 1.5,
});

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
  /** R-006 (PA-139): preocupación mínima de lo creído para formar una intención (`INTENT_THRESHOLD`) y su caducidad (`INTENT_TTL_MIN`). */
  intentThreshold: number;
  intentTtlMin: number;
  /** R-006 [M]: peso de la urgencia en llamar y confrontar, y de la duda (credibilidad media) en preguntar. */
  urgencyWeight: number;
  doubtWeight: number;
  /** R-007, R-008 (PA-140): cambio máximo de tensión por encuentro y decaimiento diario. */
  maxTensionDelta: number;
  tensionDecayDay: number;
  /** R-008 [M]: fuerza de partida de negar para quien nunca dijo eso, y cuánto baja la creencia una negación creíble. */
  denyStrength: number;
  denialDoubt: number;
  /** R-008.4 [M]: credibilidad de lo que el tercero oye del visitante («un extraño anda diciendo cosas»). */
  rumorCredibility: number;
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
  // Sobre la preocupación, no el impacto (L5.5, 2026-09-27): con el impacto, la duda frenaba dos veces y nadie
  // actuaba ni con 0,2. 0,3 deja fuera lo poco grave sobre alguien lejano (un compañero, 0,4 de cercanía).
  intentThreshold: 0.3,
  intentTtlMin: 2_880,
  urgencyWeight: 2,
  doubtWeight: 1,
  maxTensionDelta: 0.3,
  tensionDecayDay: 0.05,
  denyStrength: 0.6,
  denialDoubt: 0.5,
  rumorCredibility: 0.8,
});

/** Prefijo de las respuestas conversacionales en el almacén de funciones (036 R-002). */
export const STANCE_PREFIX = 'conv.';
export const stanceResponse = (stance: string): string => `${STANCE_PREFIX}${stance}`;

/** Estímulo del visitante en el almacén de funciones de la persona (R-018). */
export const visitorStimulus = (visitorId: string): string => `ext.${visitorId}`;
