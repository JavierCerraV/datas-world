// Tipos de la charla con ciudadanos (spec 043 §3). El motor no lee archivos: los catálogos `chat_tones` y
// `chat_stances` llegan inyectados (los carga `@datas-world/generators`).
import type { SourceContribution } from '../decision/options.ts';
import type { FunctionStore } from '../functions/types.ts';

/** Tono de un turno del visitante (`chat_tones`, R-005). */
export interface ToneDef {
  key: string;
  /** Estímulo verbal de la 036 que presenta el tono. */
  stimulus: string;
  /** Intensidad por defecto, en [0,1] [M]. */
  magnitude: number;
  /** Valor social de partida, en [−1,1]: la base que la historia modula [M] (PA-135). */
  prior: number;
}

/** Postura conversacional del ciudadano (`chat_stances`, R-008). */
export interface StanceDef {
  key: string;
  /** Cuánto reduce la carga aversiva si se elige, en [0,1] (R-007). */
  escape: number;
  /** Fuerza inicial mientras la persona no la haya usado, en [0,1] (PA-134). */
  w0: number;
}

/** Afirmación sobre un tercero (`chat_claims`, 044 R-001, R-003). */
export interface ClaimDef {
  key: string;
  /** Estímulo verbal de la 036 que presenta la afirmación. */
  stimulus: string;
  magnitude: number;
  /** Valor social de partida, en [−1,1] [M]. */
  prior: number;
  /** Relaciones de `chat_relations` a las que se puede referir. */
  about: readonly string[];
}

/** Cómo se encuentra a la persona real desde la vista del ciudadano (044 R-001). */
export type RelationResolve = 'partner' | 'mother' | 'father' | 'child' | 'sibling' | 'boss' | 'coworker';

/** Relación con el tercero (`chat_relations`). */
export interface RelationDef {
  key: string;
  resolve: RelationResolve;
  /** Cercanía por defecto en [0,1] (R-003), hasta la 012. */
  closeness: number;
}

export interface ChatCatalog {
  tones: readonly ToneDef[];
  /** En el orden del catálogo (orden de clave): es el orden de las candidatas. */
  stances: readonly StanceDef[];
  /** Vacíos o ausentes: la charla funciona sin consecuencias (044). */
  claims?: readonly ClaimDef[];
  relations?: readonly RelationDef[];
  /** El celular (`object_kinds`, 044 P2): su tipo y la probabilidad de poder llamar por estrato (`callAccess`). */
  phone?: { kind: string; callAccess: Readonly<Record<string, number>> };
}

/** Afirmación del visitante tal como llega del clasificador (044 R-001). */
export interface HeardClaim {
  predicate: string;
  /** Clave de `chat_relations`. */
  about: string;
}

/** Evaluación de una afirmación (044 R-001 a R-004): de quién habla, cuánto la cree y cuánto le pega. */
export interface ClaimAssessment {
  predicate: string;
  relation: string;
  /** La persona real; falta si la afirmación se descarta. */
  about?: string;
  /** Motivo del descarte: no conoce a esa persona, o la afirmación no existe en el catálogo. */
  discarded?: string;
  credibility: number;
  /** Función del estímulo para esta persona, en [−1,1] (`prior` + historia). */
  value: number;
  /** Cuánto le importa si fuera cierto, en [0,1]: `|función| × cercanía × (1 + valueAmp × valor opuesto)` (R-006). */
  concern: number;
  /** `credibilidad × preocupación` (R-003). */
  impact: number;
  /** De dónde sale la función: aprendida directa o derivada por la red (037), con el estímulo de origen. */
  valueSource: 'direct' | 'derived';
  derivedFrom?: string;
  /** Raíz del valor al que se opone (038), si la hay. */
  opposedValue?: string;
}

/** Fuentes de la postura: las de la 040 más el escape de la carga y la operación motivadora (R-007, R-008). */
export type ChatSource = SourceContribution['source'] | 'negativo' | 'motivadora';

export interface ChatContribution {
  source: ChatSource;
  contribution: number;
  ref?: string;
  origins?: readonly string[];
}

/** Un turno ya jugado (para el resumen y la consolidación). */
export interface TurnRecord {
  seq: number;
  tone: string;
  toneValue: number;
  visitorValue: number;
  aversiveLoad: number;
  stance?: string;
  /** Afirmaciones del visitante en este turno (044). */
  claims?: ClaimAssessment[];
}

/**
 * Estado de una charla (043 §3, `ConversationState`). Vive en la sesión; en `in_world` se consolida al cerrar
 * (R-019, R-021). `store` es una copia de trabajo del almacén de funciones de la persona.
 */
export interface ConversationState {
  visitorId: string;
  /** Estímulo del visitante en el almacén: `ext.<EXT-…>` (R-018). */
  visitorStim: string;
  store: FunctionStore;
  aversiveLoad: number;
  maxLoad: number;
  turns: TurnRecord[];
  /** Estímulo del último turno del visitante: aprende qué le sigue (R-009). */
  lastTone?: { stimulus: string; value: number };
  lastStance?: string;
}

/** Estado vivo que se relee en cada turno (R-019.4): necesidades y estrés actuales. */
export interface LiveState {
  energy: number;
  stress: number;
}

export interface StanceOption {
  stance: string;
  value: number;
  sources: ChatContribution[];
}

export interface StanceChoice {
  stance: string;
  /** Los aportes de la postura elegida, de mayor a menor magnitud (la explicación del visor). */
  sources: ChatContribution[];
  probabilities: { stance: string; p: number }[];
  forced: boolean;
}

/** Resumen de una charla para su recuerdo (R-020). */
export interface ChatSummary {
  turns: number;
  dominantTones: string[];
  dominantStances: string[];
  /** Media del valor del visitante a lo largo de la charla, en [−1,1]. */
  valence: number;
  /** En [0,1]: carga máxima y duración. */
  intensity: number;
}
