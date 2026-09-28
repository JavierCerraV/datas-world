// Tipos de los eventos privados (spec 039 §3). Un pensamiento es un estímulo de la ontología con su función en este
// momento; el PNR es un episodio, no un rasgo (039 INV-002).

/** Un evento privado activo (tope `maxActive` por persona). */
export interface PrivateEvent {
  /** Estímulo de la ontología (un término verbal, una actividad, una persona…). */
  s: string;
  /** Su función ahora, en [−1,1]: la aprendida, la derivada o la transformada. */
  fn: number;
  /** De dónde salió: el estímulo del que se derivó, o el disparador. */
  from: string;
  at: number;
  /** Evento que lo disparó (el hecho del mundo o la creencia de la charla), para las causas. */
  cause?: string;
}

/** Episodio de PNR en curso (039 R-002, R-003). */
export interface PnrEpisode {
  trigger: string;
  cause?: string;
  startedAt: number;
  steps: number;
  /** Pasos en la hora en curso y minuto en que empezó esa hora (tope por hora, R-003). */
  hourSteps: number;
  hourAt: number;
  /** Mayor carga alcanzada. */
  peak: number;
  /** Aristas de la red usadas (índices), para las causas del episodio. */
  edges: number[];
  /** Actividad en el tick anterior: pasar a dormir o a distraerse ahora es emitir la evitación (R-004). */
  lastAct?: number;
}

/** Estado mental de una persona (`Citizen.mind`): solo lo que está activo ahora. */
export interface MindState {
  active: PrivateEvent[];
  episode?: PnrEpisode;
}

/** Cómo terminó un episodio (039 R-003, R-006). */
export type EpisodeEnd = 'bajo' | 'evitacion' | 'yo' | 'tope';
