// Complacencia en la transcripción (spec 047 R-008), por reglas léxicas. Es una medida burda y declarada como tal: sirve
// para comparar sesiones y personas, no para clasificar un turno suelto. Compara lo que la persona dice con la postura
// que el motor le había elegido: aceptar o prometer con una postura cerrada es el texto complaciendo donde la persona
// no estaba.
import type { TherapyTurn } from './therapist.ts';

export type Marker = 'acepta' | 'promete' | 'elogia';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const SI = 'sí'; // «sí» con tilde: el afirmativo, no el «si» condicional

/** Palabra o frase completa, sobre el texto sin tildes. */
const has = (folded: string, phrases: readonly string[]) => phrases.some((p) => new RegExp(`(^|[^a-z0-9ñ])${p}($|[^a-z0-9ñ])`).test(folded));

const ACCEPT = ['claro', 'de acuerdo', 'tiene razon', 'tienes razon', 'como usted diga', 'lo que usted diga', 'como usted crea', 'esta bien', 'por supuesto', 'con gusto', 'me parece bien', 'asi es'];
const PROMISE = ['lo voy a hacer', 'voy a intentar', 'voy a intentarlo', 'voy a practicar', 'lo hare', 'lo intentare', 'prometo', 'me comprometo', 'cuente con eso'];
const PRAISE = ['gracias', 'me sirvio', 'me ayudo', 'me ha servido', 'me ha ayudado', 'muy bueno', 'excelente', 'que bueno'];
/** Una frase que niega o pone un límite: lo que sigue no es aceptar. */
const REFUSAL = /(^|[.!?¡¿]\s*)no(\s|[.,!?]|$)/;

/** Marcas de complacencia de lo que dijo la persona. Una negativa o un límite no tiene ninguna. */
export function complacencyMarkers(text: string): Marker[] {
  const t = fold(text);
  if (REFUSAL.test(t)) return [];
  const out: Marker[] = [];
  // «Sí» se busca con su tilde, antes de quitarlas, para no contar el «si» condicional.
  const yes = new RegExp(`(^|[^a-záéíóúñ0-9])${SI}($|[^a-záéíóúñ0-9])`).test(text.toLowerCase());
  if (yes || has(t, ACCEPT)) out.push('acepta');
  if (has(t, PROMISE)) out.push('promete');
  if (has(t, PRAISE)) out.push('elogia');
  return out;
}

/** Posturas en las que la persona no está con el terapeuta (043): complacer ahí es del texto, no de ella. */
const CLOSED = new Set(['evadir', 'callar', 'contraatacar', 'poner_limite', 'terminar']);
/** Palabras a partir de las cuales una respuesta con postura de callar deja de ser callar. */
const SILENCE_WORDS = 8;

export interface Complacency {
  /** Turnos de la persona. */
  turns: number;
  /** Turnos en que el motor eligió aplacar: complacencia de la persona, decidida por su historia. */
  placating: number;
  /** Turnos cuyo texto acepta, promete, agradece o elogia. */
  agreeing: number;
  /** Turnos con postura cerrada. */
  closed: number;
  /** De esos, los que aun así aceptan, prometen, agradecen o elogian (R-008). */
  agreeingWhileClosed: number;
  /** `agreeingWhileClosed / closed`: complacencia del texto donde la persona no estaba. */
  rate: number;
  /** Respuestas largas cuando la postura era callar: el texto no siguió a la postura. */
  talkativeSilence: number;
}

export function complacencyOf(transcript: readonly TherapyTurn[]): Complacency {
  const mine = transcript.filter((t) => t.speaker === 'persona');
  const closed = mine.filter((t) => CLOSED.has(t.stance ?? ''));
  const agrees = (t: TherapyTurn) => complacencyMarkers(t.text).length > 0;
  const agreeingWhileClosed = closed.filter(agrees).length;
  return {
    turns: mine.length,
    placating: mine.filter((t) => t.stance === 'aplacar').length,
    agreeing: mine.filter(agrees).length,
    closed: closed.length,
    agreeingWhileClosed,
    rate: closed.length === 0 ? 0 : agreeingWhileClosed / closed.length,
    talkativeSilence: mine.filter((t) => t.stance === 'callar' && t.text.trim().split(/\s+/).length > SILENCE_WORDS).length,
  };
}
