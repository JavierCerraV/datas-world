// Parámetros de los eventos privados (spec 039 §8 y §9, decisiones del usuario del 2026-09-28). Todos [M].

export interface PrivateParams {
  /** R-002, R-003 (PA-115): carga para entrar en un episodio de PNR y para salir. */
  pnrEnter: number;
  pnrExit: number;
  /** R-003: tope de pasos de derivación por hora (seguridad computacional). */
  maxStepsPerHour: number;
  /** PA-130: eventos privados activos a la vez. */
  maxActive: number;
  /** §5: pasos mínimos para registrar el episodio (`PNR_EPISODE`). */
  minSteps: number;
  /** Fuera de un episodio, los eventos privados pierden la mitad de su función cada tanto (minutos). */
  fadeHalfLifeMin: number;
  /** Por debajo de esta magnitud, un evento privado deja de estar activo. */
  minFn: number;
  /** R-002: una repetición sin pensamiento nuevo habitúa algo la función (fracción por paso). */
  repeatHabituation: number;
  /** R-004: alivio por tick de una respuesta de evitación (fracción de la carga que suprime). */
  avoidanceRelief: number;
  /** R-006, R-007 (decisión 4): fuerza de partida del enmarque con «Yo», igual para todos hasta MF7 (041). */
  selfW0: number;
  /** R-006: cuánto control discriminativo pierden los eventos privados al enmarcarlos (fracción que conservan). */
  selfKeep: number;
  /** R-007: consecuencia del enmarque según haya o no contacto con reforzadores de valor (036 R-002). */
  selfValueOutcome: number;
  selfNoValueOutcome: number;
}

export const PRIVATE_DEFAULTS: PrivateParams = Object.freeze({
  pnrEnter: 0.5,
  pnrExit: 0.25,
  maxStepsPerHour: 12,
  maxActive: 16,
  minSteps: 3,
  fadeHalfLifeMin: 180,
  minFn: 0.02,
  repeatHabituation: 0.1,
  avoidanceRelief: 0.5,
  selfW0: 0.1,
  selfKeep: 0.5,
  // La fuerza operante se acerca al resultado (036 R-002): 1 refuerza del todo, 0 extingue.
  selfValueOutcome: 1,
  selfNoValueOutcome: 0,
});

/** Respuestas del almacén de funciones (036 R-002) de este módulo. */
export const SELF_RESPONSE = 'yo.enmarque';
/** Respuestas de evitación experiencial (PA-117): dormir, distraerse, consumir, evitar a alguien y suprimir. */
export const AVOIDANCE_RESPONSES = Object.freeze(['evit.consumir', 'evit.distraccion', 'evit.dormir', 'evit.evitar_persona', 'evit.suprimir'] as const);
export type AvoidanceResponse = (typeof AVOIDANCE_RESPONSES)[number];
/** Fuerza de partida de una respuesta de evitación mientras no tenga historia [M]. */
export const AVOIDANCE_W0 = 0.2;
