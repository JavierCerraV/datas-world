// Tipos y parámetros de la memoria autobiográfica (spec 013 v0.3 §3, §8).
import type { EntityId } from '../ids.ts';

/** Episodio: registro de contingencias de un hecho vivido, contado u ocurrido en sesión (R-001, R-002). */
export interface Memory {
  /** `MEM-<n>` por persona, en orden de creación. */
  id: string;
  /** Evento que lo originó: el registro guarda la verdad (014). En el desarrollo, el `DEVELOPMENT_YEAR`. */
  event?: EntityId;
  at: number;
  source: 'lived' | 'told' | 'session';
  /** Tipo de evento o clave del episodio de desarrollo (para el texto). */
  kind: string;
  /** Lo presente: personas (`cit.…`), lugar, actividad, términos verbales (≤ 4). */
  stims: string[];
  /** Consecuencia (estímulo) que recibió: la usa la consolidación en la red (R-009). */
  us?: string;
  /** Magnitud con signo de la consecuencia (λ del tipo): con ella se reconstruye (R-007). */
  lambda: number;
  /** [-1,1]: cómo lo recuerda hoy (se reconstruye al recordar). */
  valence: number;
  /** [-1,1]: cómo lo vivió al codificarlo. */
  valence0: number;
  /** [0,1]: decae; el repaso la sube. */
  intensity: number;
  rehearsals: number;
  /** Capítulo al que pertenece. */
  chapter?: string;
  /** Ya contó para la consolidación en la red (R-009). */
  sch?: 1;
}

/** Capítulo autobiográfico (R-010). */
export interface Chapter {
  /** `CHP-<n>` por persona. */
  id: string;
  from: number;
  to?: number;
  theme: string;
  /** [-1,1]: media de la valencia actual de sus episodios. */
  tone: number;
  openedBy?: EntityId;
  /** Hasta 3 episodios que lo definen: no se olvidan mientras el capítulo exista. */
  anchors: string[];
}

/** La memoria de una persona (`Citizen.memory`). */
export interface MemoryStore {
  episodes: Memory[];
  chapters: Chapter[];
  /** Episodios olvidados (salen de la persona; el hecho sigue en el registro, R-005). */
  forgotten: number;
  /** Siguiente número de `MEM-` y `CHP-`. */
  next: number;
}

export interface MemoryParams {
  /** R-001: saliencia mínima para codificar. */
  encodeMin: number;
  /** R-004 [M]: olvido en ley de potencia, `(1 + días/τ)^(−β')`, con β' = β / ((1 + |valencia|)(1 + repasos)). */
  tauDays: number;
  beta: number;
  forget: number;
  /** R-001 [M]: un hecho del mismo tipo y con lo mismo en los últimos días es menos saliente (habituación). */
  noveltyDays: number;
  noveltyFactor: number;
  maxEpisodes: number;
  maxChapters: number;
  /** R-006: sesgo del ánimo y escala de la recencia en la recuperación. */
  moodBias: number;
  recencyDays: number;
  /** R-007: subida por repaso y paso de la reconstrucción. */
  rehearsalGain: number;
  reconstruct: number;
  /** R-009: episodios para consolidar y ganancia por episodio. */
  schemaMin: number;
  schemaGain: number;
  /** R-010: intensidad para abrir capítulo. */
  chapterOpen: number;
}

export const MEMORY_DEFAULTS: MemoryParams = Object.freeze({
  encodeMin: 0.15,
  tauDays: 7,
  beta: 0.5,
  forget: 0.05,
  noveltyDays: 7,
  noveltyFactor: 0.3,
  maxEpisodes: 60,
  maxChapters: 12,
  moodBias: 1,
  recencyDays: 180,
  rehearsalGain: 0.2,
  reconstruct: 0.1,
  schemaMin: 3,
  schemaGain: 0.15,
  chapterOpen: 0.6,
});

/** R-008 (P5): cuántos recuerdos recibe la charla como contexto; los mismos cuentan como repaso al consolidarla. */
export const CHAT_RECALL = 12;

export const emptyMemory =(): MemoryStore => ({ episodes: [], chapters: [], forgotten: 0, next: 1 });
