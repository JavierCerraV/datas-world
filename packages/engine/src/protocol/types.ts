// Guía estructurada de un protocolo psicológico (spec 047 R-005): lo que un terapeuta debe trabajar en cada sesión y
// a qué mecanismo del motor apunta cada cosa (R-004). Es una guía, no un texto para leer igual a todos.

export type ProtocolId = 'act-pnr-3';
export type SessionNumber = 1 | 2 | 3;

/**
 * Mecanismo del motor al que apunta un componente (047 R-004). `yo`: enmarque con «Yo» y defusión (039 R-006);
 * `extincion`: contacto con el evento privado sin evitarlo (039 R-004); `valores`: dominios y reglas de seguimiento
 * (038). `alianza`, `evaluacion` y `practica` no llevan dosis propia.
 */
export type Mechanism = 'alianza' | 'evaluacion' | 'yo' | 'extincion' | 'valores' | 'practica';

export interface ProtocolComponent {
  /** Único en el protocolo, con el número de su sesión: `s1.jerarquia`. */
  id: string;
  title: string;
  mechanism: Mechanism;
  required: boolean;
  /** Intercambios (turno del terapeuta respondido por la persona) para darlo por cubierto (R-005b). */
  minTurns: number;
  /** Qué debe lograrse. */
  goal: string;
  /** Cómo se trabaja, en una sesión por escrito. */
  how: string;
  /** Pistas para adaptarse a lo que la persona responde. */
  cues: readonly string[];
}

export interface ProtocolSession {
  n: SessionNumber;
  title: string;
  aim: string;
  components: readonly ProtocolComponent[];
}

export interface Protocol {
  id: ProtocolId;
  name: string;
  source: string;
  /** Vocabulario común del protocolo, que el terapeuta adapta a las palabras de la persona. */
  vocabulary: readonly string[];
  sessions: readonly ProtocolSession[];
}
