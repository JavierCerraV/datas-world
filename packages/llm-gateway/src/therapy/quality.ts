// Calidad del terapeuta en una transcripción (spec 047 R-005f), por reglas léxicas: lo que el piloto mostró que fallaba.
// Mide, no corrige: tutear cuando se pidió tratar de usted, hacer dos preguntas en un turno, repetir una pregunta ya
// hecha y elogiar con fórmulas. Es una medida burda, para comparar corridas tras cambiar el prompt.
import type { TherapyTurn } from './therapist.ts';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const word = (list: string) => new RegExp(`(^|[^a-záéíóúñ])(${list})($|[^a-záéíóúñ])`, 'i');

/** Formas de tuteo frecuentes en una consulta. Se buscan con tildes: «tú» y «cuéntame» lo son, «tu casa» también. */
const INFORMAL = word('tú|tu|tus|ti|te|contigo|puedes|quieres|tienes|sientes|piensas|notas|haces|necesitas|prefieres|estás|cuéntame|dime|permíteme|fíjate|[a-záéíóúñ]+(?:rías|aste|iste)');
const PRAISE = word('perfecto|muy bien|excelente|genial|estupendo|buen trabajo|qué bueno|me alegra');

/** Palabras con contenido de un turno, para comparar preguntas. */
const content = (s: string): Set<string> => new Set(fold(s).replace(/[^a-zñ\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
/** Parecido de dos turnos: proporción de palabras con contenido compartidas (Jaccard). */
const similarity = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;
  let both = 0;
  for (const w of a) if (b.has(w)) both++;
  return both / (a.size + b.size - both);
};
/** A partir de aquí dos turnos son la misma pregunta dicha otra vez [M]. */
export const REPEAT_SIMILARITY = 0.7;

export interface TherapistQuality {
  turns: number;
  /** Turnos con alguna forma de tuteo. */
  informal: number;
  /** Turnos con dos o más preguntas. */
  doubleQuestions: number;
  /** Turnos que repiten casi con las mismas palabras una pregunta anterior. */
  repeats: number;
  /** Turnos con un elogio de fórmula. */
  praise: number;
}

export function therapistQuality(transcript: readonly TherapyTurn[]): TherapistQuality {
  const mine = transcript.filter((t) => t.speaker === 'terapeuta').map((t) => t.text);
  const sets = mine.map(content);
  let repeats = 0;
  for (let i = 1; i < mine.length; i++)
    if (mine[i]!.includes('?') && sets[i]!.size >= 5 && sets.slice(0, i).some((p) => similarity(p, sets[i]!) >= REPEAT_SIMILARITY)) repeats++;
  return {
    turns: mine.length,
    informal: mine.filter((t) => INFORMAL.test(t)).length,
    doubleQuestions: mine.filter((t) => (t.match(/\?/g) ?? []).length >= 2).length,
    repeats,
    praise: mine.filter((t) => PRAISE.test(t)).length,
  };
}
