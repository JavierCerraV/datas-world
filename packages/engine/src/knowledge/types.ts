// Tipos y parámetros del conocimiento (spec 025 v0.2 §3, §8).

/** Un tema del que se habla (catálogo `rumor_topics`, R-001). */
export interface TopicDef {
  key: string;
  name: string;
  /** Tipo de evento que lo hace verdad; vacío si solo llega por la charla (044). */
  event: string;
  /** De quién trata el evento: su `citizenId` o los dos del par `a`/`b`. */
  subjects: 'citizenId' | 'pair' | '';
  /** Condición sobre el payload del evento (p. ej. `{ creditor: 'gota_a_gota' }`). */
  when?: Record<string, string>;
  stimulus: string;
  magnitude: number;
  prior: number;
  /** Versiones del mismo asunto: dos temas del mismo grupo con distinto estado se contradicen. */
  group: string;
  state: string;
  /** 0 lo que pasó; 1 una versión deformada (R-004). */
  level: number;
  escalatesTo?: string;
}

export interface KnowledgeCatalog {
  topics: TopicDef[];
}

export interface KnowledgeParams {
  /** R-003 (PA-150): probabilidad de contar en un encuentro en que se abre, × fuerza de contar. */
  pTell: number;
  /** Credibilidad mínima para contar algo y para no olvidarlo tras una corrección. */
  tellMin: number;
  forgetMin: number;
  /** R-004 (PA-151): probabilidad de deformar al contar. */
  distort: number;
  maxBeliefs: number;
  /** PA-152: fuerza de partida de contar (`social.contar`). */
  tellW0: number;
  /** Personas a las que se recuerda habérselo contado (por creencia). */
  toldMemory: number;
}

export const KNOWLEDGE_DEFAULTS: KnowledgeParams = Object.freeze({
  pTell: 0.3,
  tellMin: 0.3,
  forgetMin: 0.15,
  distort: 0.1,
  maxBeliefs: 12,
  tellW0: 0.4,
  toldMemory: 5,
});

/** Respuesta de contar a alguien lo que se sabe de un tercero (036 R-002). */
export const TELL = 'social.contar';
/** Fuente de lo que se presenció. */
export const SEEN = 'visto';

export const topicOf = (cat: KnowledgeCatalog, key: string): TopicDef | undefined => cat.topics.find((t) => t.key === key);
