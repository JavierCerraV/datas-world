// Tipos y parámetros de la capa 2 (spec 036 §3).

/** Clase de estímulo de la ontología compartida del mundo (036 §3). `key` es jerárquica: `lugar.ocio.bar`, `verbal.dinero`. */
export interface StimulusClass {
  key: string;
  kind: 'person_role' | 'place_kind' | 'activity' | 'event_type' | 'body_state' | 'emotion' | 'verbal_term' | 'response' | 'context';
  /** Rasgos en [0,1] para la generalización (R-004); todas las clases del mundo tienen la misma dimensión. */
  features: readonly number[];
  /** Reforzador primario (036 R-007; McHugh): +1 apetitivo, −1 aversivo. */
  primary?: 1 | -1;
}

/** Ontología compartida: clases por clave, en orden de clave. Se inyecta al crear los sistemas (sin E/S en el motor). */
export interface Ontology {
  readonly classes: ReadonlyMap<string, StimulusClass>;
  readonly dims: number;
}

/** Inhibición aprendida en un contexto durante la extinción (R-003): no borra la función. */
export interface Inhibition {
  c: string; // contexto
  v: number; // magnitud en [0,1]
  at: number; // último ensayo de extinción (para la recuperación espontánea)
}

/**
 * Función de un estímulo para una persona (035 §4, 036 §3), en forma compacta (se guarda en `Citizen.functions`).
 * `v` es el valor asociativo con signo: > 0 apetitivo, < 0 aversivo; en [−1, 1].
 */
export interface FunctionEntry {
  s: string; // clave del estímulo
  v: number;
  c: string; // contexto de adquisición ('' = sin control contextual)
  inh: Inhibition[];
  hab: number; // habituación de la respuesta elicitada, en [0,1)
  n: number; // ensayos
  rs: string[]; // reforzadores distintos con que se emparejó (R-008), hasta 8
  o: 'direct' | 'derived' | 'transformed' | 'generalized' | 'discriminated';
  src: string[]; // eventos de origen (hasta 3), para la explicación (019)
  at: number; // último ensayo
}

/** Fuerza de una respuesta en un contexto (R-002), en [−1, 1]. */
export interface ResponseEntry {
  r: string;
  c: string;
  w: number;
  n: number;
  at: number;
  /** Eventos de las últimas consecuencias (019; 040 R-006), los 3 más recientes. */
  src?: string[];
}

/** Lo que una persona ha aprendido por experiencia directa. `pruned` cuenta lo podado (INV-003). */
export interface FunctionStore {
  f: FunctionEntry[];
  r: ResponseEntry[];
  pruned: number;
}

export const emptyStore = (): FunctionStore => ({ f: [], r: [], pruned: 0 });

/** Parámetros de la 036 (§8). Todos [M] salvo que se diga otra cosa. */
export interface LearningParams {
  /** Saliencia del estímulo condicionado (α de Rescorla-Wagner). */
  alpha: number;
  /** Tasa por valencia de la consecuencia (β): apetitiva y aversiva (036 §8: 0,15 y 0,2). */
  betaApp: number;
  betaAv: number;
  /** Tasa de la inhibición contextual en la extinción. */
  betaExt: number;
  /** Anchura del gradiente de generalización en distancia normalizada (036 §8: 0,35). */
  sigma: number;
  /** Habituación por presentación sin consecuencia y su recuperación (días). */
  habRate: number;
  habTauDays: number;
  /** Decaimiento de la inhibición de la extinción (días): da la recuperación espontánea. */
  inhTauDays: number;
  /** Tasa de aprendizaje operante. */
  operantRate: number;
  /** Umbral desde el que una función propia se extingue por inhibición contextual (y no como inhibición condicionada). */
  ownThreshold: number;
  /** Topes (036 §8). */
  maxFunctions: number;
  maxResponses: number;
}

export const LEARNING_DEFAULTS: LearningParams = Object.freeze({
  alpha: 0.5,
  betaApp: 0.15,
  betaAv: 0.2,
  betaExt: 0.12,
  sigma: 0.35,
  habRate: 0.1,
  habTauDays: 7,
  inhTauDays: 10,
  operantRate: 0.12,
  ownThreshold: 0.05,
  maxFunctions: 256,
  maxResponses: 256,
});

/** Multiplicadores del temperamento (009 R-004): `0,5 + tmp`, 1 si no hay columna. */
export interface Sensitivity {
  appetitive: number;
  aversive: number;
  arousal: number;
  habituation: number;
  social: number;
}

export const NEUTRAL: Sensitivity = Object.freeze({ appetitive: 1, aversive: 1, arousal: 1, habituation: 1, social: 1 });
