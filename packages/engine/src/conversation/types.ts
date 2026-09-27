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

export interface ChatCatalog {
  tones: readonly ToneDef[];
  /** En el orden del catálogo (orden de clave): es el orden de las candidatas. */
  stances: readonly StanceDef[];
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
