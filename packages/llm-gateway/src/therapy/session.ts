// Una sesión del protocolo como diálogo (spec 047 R-005b, R-005c): terapeuta → persona → terapeuta… El terapeuta es
// un LLM; la persona la aporta quien llama (`respond`: la charla de la 043, con la postura que decide el motor). El
// motor lleva la cuenta de lo cubierto. Nada de aquí cambia el mundo (INV-001): devuelve la transcripción y la fidelidad.
import { coverage, newProgress, recordExchange, sessionOf } from '@datas-world/engine';
import type { Protocol, SessionNumber } from '@datas-world/engine';
import type { Gateway } from '../gateway.ts';
import { therapistRequest } from './therapist.ts';
import type { TherapyTurn } from './therapist.ts';

/** 047 §8, `MAX_TURNS_SESSION`: turnos del terapeuta en una sesión. */
export const MAX_TURNS_SESSION = 40;

export interface PatientReply {
  text: string;
  /** Postura que el motor decidió para este turno; se guarda en la transcripción. */
  stance?: string;
  /** La persona dio por terminada la conversación. */
  left?: boolean;
}

export interface TherapySessionInput {
  gateway: Gateway;
  protocol: Protocol;
  session: SessionNumber;
  patientName: string;
  citizenId?: string;
  admission?: string;
  /** Formulación del caso que viene de la sesión anterior. */
  formulation?: string;
  maxTurns?: number;
  /** La persona responde a lo que el terapeuta le dijo. `turn` empieza en 0. */
  respond: (say: string, turn: number) => Promise<PatientReply>;
}

/** `completa`: se cubrió todo; `tope`: se acabaron los turnos; `abandono`: la persona se fue; `sin_llm`: falló el terapeuta. */
export type SessionEnd = 'completa' | 'tope' | 'abandono' | 'sin_llm';

export interface TherapySessionResult {
  transcript: TherapyTurn[];
  covered: string[];
  missing: string[];
  fidelity: number;
  /** Lo que el terapeuta declaró cubierto en su último turno. Solo informativo: no cuenta para la fidelidad. */
  claimed: string[];
  /** Formulación del caso al terminar, para la sesión siguiente. */
  formulation: string;
  therapistTurns: number;
  ended: SessionEnd;
  /** Motivo del fallo del LLM, si lo hubo. */
  detail?: string;
}

export async function runTherapySession(input: TherapySessionInput): Promise<TherapySessionResult> {
  const session = sessionOf(input.protocol, input.session);
  const maxTurns = input.maxTurns ?? MAX_TURNS_SESSION;
  const progress = newProgress();
  const transcript: TherapyTurn[] = [];
  let formulation = input.formulation ?? '';
  let claimed: string[] = [];
  let ended: SessionEnd = 'tope';
  let detail: string | undefined;
  let turn = 0;

  for (; turn < maxTurns; turn++) {
    if (coverage(session, progress).missing.length === 0) {
      ended = 'completa';
      break;
    }
    const req = therapistRequest({
      protocol: input.protocol, session: input.session, patientName: input.patientName, formulation, progress, transcript, turnsLeft: maxTurns - turn,
      ...(input.admission !== undefined ? { admission: input.admission } : {}),
    });
    const res = await input.gateway.run({ ...req, ...(input.citizenId ? { citizenId: input.citizenId } : {}) });
    if (!res.data) {
      // Sin terapeuta no se inventa una sesión: se corta y se informa (la dosis sale de lo cubierto hasta aquí).
      ended = 'sin_llm';
      detail = `${res.fallbackReason ?? 'invalid'}${res.errorDetail ? `: ${res.errorDetail.trim()}` : ''}`;
      break;
    }
    const out = res.data;
    const known = session.components.some((c) => c.id === out.component);
    const section = known ? out.component : 'otro';
    if (out.notes.trim()) formulation = out.notes.trim();
    claimed = out.covered;
    transcript.push({ speaker: 'terapeuta', text: out.say, section, notes: formulation });

    const reply = await input.respond(out.say, turn);
    transcript.push({ speaker: 'persona', text: reply.text, section, ...(reply.stance !== undefined ? { stance: reply.stance } : {}) });
    if (reply.left) {
      ended = 'abandono';
      turn++;
      break;
    }
    if (known) recordExchange(progress, session, out.component);
  }
  if (ended === 'tope' && coverage(session, progress).missing.length === 0) ended = 'completa';

  const cov = coverage(session, progress);
  return {
    transcript, covered: cov.covered, missing: cov.missing, fidelity: cov.fidelity, claimed, formulation, therapistTurns: turn, ended,
    ...(detail !== undefined ? { detail } : {}),
  };
}
