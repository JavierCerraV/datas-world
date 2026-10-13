// La persona en la sesión (spec 047 R-005b, R-005d, R-005e): responde con la charla de la 043. El motor elige su postura
// en cada turno y el LLM solo la expresa; aquí se une esa charla con el diálogo del terapeuta y se guarda lo que el motor
// decidió, para el análisis (compromiso, complacencia) y nunca para el terapeuta.
import type { DisclosureLevel } from '@datas-world/engine';
import type { ChatSession } from '../chat/session.ts';
import type { Verification } from '../chat/verify.ts';
import type { PatientReply } from './session.ts';

/** Lo que el motor decidió en un turno de la persona. Queda fuera del prompt del terapeuta. */
export interface PatientTurnLog {
  turn: number;
  tone: string;
  stance: string;
  /** Nivel de intimidad abierto (043 R-026). */
  level: DisclosureLevel;
  /** `template`: el LLM de la persona no respondió y habló la plantilla de la postura. */
  expression: 'llm' | 'template';
  /** El texto se acortó porque la postura era callar (R-005e). */
  trimmed?: boolean;
  /** Afirmaciones de la respuesta contra su vista y adherencia a la postura (043 R-012, R-013); llega después. */
  verification: Promise<Verification>;
}

const GONE = 'Se levanta y se va.';

/** La función `respond` de `runTherapySession` a partir de una charla abierta en escenario de consulta. */
export function patientResponder(chat: ChatSession, log?: PatientTurnLog[]): (say: string, turn: number) => Promise<PatientReply> {
  return async (say, turn) => {
    if (chat.ended) return { text: GONE, left: true };
    const out = await chat.turn(say);
    log?.push({ turn, tone: out.tone.tone, stance: out.choice.stance, level: out.level, expression: out.expression, ...(out.trimmed ? { trimmed: true } : {}), verification: out.verification });
    return { text: out.reply, stance: out.choice.stance, ...(chat.ended ? { left: true } : {}) };
  };
}
