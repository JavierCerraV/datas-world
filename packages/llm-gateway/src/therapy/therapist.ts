// El terapeuta de un estudio (spec 047 R-005, R-005b): un agente LLM formado en terapias contextuales que conduce una
// sesión con la guía del protocolo. Solo recibe lo que un terapeuta real tendría: la guía, lo que la persona dijo en la
// admisión y en la conversación, y sus propias notas. Nunca la verdad del mundo ni la postura de la persona (CA-008).
import { coverage, sessionOf } from '@datas-world/engine';
import type { Protocol, ProtocolSession, SessionNumber, SessionProgress } from '@datas-world/engine';
import { z } from 'zod';
import type { ChatMessage, LlmRequest, PromptPart } from '../types.ts';

/** Turno de la transcripción (047 §3). `stance` y `notes` se guardan para el análisis; no vuelven al terapeuta. */
export interface TherapyTurn {
  speaker: 'terapeuta' | 'persona';
  text: string;
  /** Componente de la guía que se trabajaba, u `otro`. */
  section: string;
  /** Postura que el motor decidió para la persona en ese turno (043). */
  stance?: string;
  /** Formulación del caso que el terapeuta escribió en ese turno. */
  notes?: string;
}

export const TherapistSchema = z.object({ say: z.string(), component: z.string(), covered: z.array(z.string()), notes: z.string() });
export type TherapistOutput = z.infer<typeof TherapistSchema>;

export interface TherapistContext {
  protocol: Protocol;
  session: SessionNumber;
  patientName: string;
  /** Lo que la persona respondió en las pruebas de la línea base, como en una admisión (R-005). */
  admission?: string;
  /** Formulación del caso que el terapeuta lleva escrita (de turnos y sesiones anteriores). */
  formulation: string;
  progress: SessionProgress;
  transcript: readonly TherapyTurn[];
  turnsLeft: number;
}

const ROLE = [
  'Usted es psicólogo clínico con formación y experiencia en terapias contextuales: terapia de aceptación y compromiso (ACT), análisis funcional de la conducta y teoría del marco relacional. Trabaja con defusión, aceptación, el yo como contexto, valores y acción comprometida.',
  'Va a conducir una sesión de un protocolo breve con una persona que consulta. Es un estudio de investigación con una población simulada: la persona es un habitante de Data\'s World, un pueblo de Colombia, y su vida sigue entre una sesión y otra. Condúzcala como lo haría con cualquier consultante.',
  '',
  'Cómo es la conversación:',
  '- Es por escrito y por turnos. Cada turno suyo es corto, de dos a cinco frases, con una sola pregunta o una sola invitación. Una sesión dicha de un tirón no sirve: la persona tiene que responder y usted trabajar con lo que responda.',
  '- Hable en español colombiano, cercano y sencillo, tratándola de usted salvo que ella lo tutee.',
  '- Usted solo sabe lo que ella le ha dicho. No dé por hecho lo que siente, lo que le pasó ni que haya mejorado: pregúnteselo. Si necesita un ejemplo de su vida, pídaselo.',
  '- Adáptese. Si no entiende, dígalo de otra manera o con otro ejemplo. Si se cierra o desconfía, valide y baje el ritmo antes de seguir. Si da una pista sobre algo que le importa o le duele, sígala. Use sus palabras, no las del manual.',
  '- Le interesa su experiencia, no que esté de acuerdo. No premie que diga que sí ni que prometa: si responde con un «sí, claro» sin contenido, pida el ejemplo concreto o lo que notó.',
  '- Los ejercicios se viven, no se explican. Guíelos paso a paso y pregunte qué notó antes de sacar una conclusión; deje que la conclusión la saque ella.',
  '',
  'Cómo usar la guía:',
  '- La guía trae los componentes de esta sesión en el orden recomendado, con su objetivo, cómo trabajarlo y pistas. Es una guía, no un texto para leer: decida usted cómo decirlo a esta persona.',
  '- Trabaje un componente a la vez. Puede dedicarle más turnos al que lo necesite y volver a uno anterior si hace falta, pero cuide el tiempo: los turnos que quedan se le indican.',
  '- Un componente se da por trabajado cuando hubo suficientes intercambios reales sobre él; nombrarlo no basta. La lista de pendientes se actualiza sola.',
  '- No le diga a la persona los nombres de los componentes ni cuántos faltan.',
  '',
  'Responda solo con un objeto JSON con estos campos:',
  '- "say": lo que le dice a la persona en este turno.',
  '- "component": el id del componente de la guía que este turno trabaja; "" si es un turno de paso que no trabaja ninguno.',
  '- "covered": los ids de los componentes que usted considera ya trabajados.',
  '- "notes": su formulación del caso al día, completa y en menos de 120 palabras: disparador principal y cadena de pensamientos, qué hace para no pensar, qué le importa, barreras, acciones acordadas. Solo lo que ella ha dicho; lo que aún no sabe, déjelo fuera.',
].join('\n');

const guideOf = (protocol: Protocol, s: ProtocolSession): string => {
  const lines = [
    `PROTOCOLO: ${protocol.name}.`,
    'Vocabulario del protocolo:',
    ...protocol.vocabulary.map((v) => `- ${v}`),
    '',
    `SESIÓN ${s.n} de ${protocol.sessions.length}: ${s.title}.`,
    `Propósito: ${s.aim}`,
    '',
    'COMPONENTES, en el orden recomendado:',
  ];
  for (const c of s.components) {
    lines.push(`[${c.id}] ${c.title} (al menos ${c.minTurns} ${c.minTurns === 1 ? 'intercambio' : 'intercambios'})`, `  Objetivo: ${c.goal}`, `  Cómo: ${c.how}`);
    for (const cue of c.cues) lines.push(`  Pista: ${cue}`);
  }
  return lines.join('\n');
};

const liveOf = (ctx: TherapistContext, s: ProtocolSession): string => {
  const cov = coverage(s, ctx.progress);
  const pending = s.components
    .filter((c) => cov.missing.includes(c.id))
    .map((c) => `${c.id} (${ctx.progress.exchanges.get(c.id) ?? 0}/${c.minTurns})`);
  return [
    `CONSULTANTE: ${ctx.patientName}.`,
    `ADMISIÓN (lo que respondió en los cuestionarios antes de empezar): ${ctx.admission?.trim() || 'sin datos.'}`,
    `SU FORMULACIÓN DEL CASO HASTA AHORA: ${ctx.formulation.trim() || 'todavía ninguna.'}`,
    `TRABAJADOS: ${cov.covered.join(', ') || 'ninguno'}`,
    `PENDIENTES: ${pending.join(', ') || 'ninguno'}`,
    `Le quedan ${ctx.turnsLeft} turnos en esta sesión.`,
  ].join('\n');
};

/** Petición del siguiente turno del terapeuta. Lo fijo va primero y es cacheable; lo que cambia cada turno, al final. */
export function therapistRequest(ctx: TherapistContext): LlmRequest<TherapistOutput> {
  const s = sessionOf(ctx.protocol, ctx.session);
  const system: PromptPart[] = [
    { text: ROLE, cacheable: true },
    { text: guideOf(ctx.protocol, s), cacheable: true },
    { text: liveOf(ctx, s), cacheable: false },
  ];
  const messages: ChatMessage[] = [
    { role: 'user', text: `(Empieza la sesión ${s.n}. ${ctx.patientName} entra y se sienta.)` },
    ...ctx.transcript.map((t): ChatMessage => ({ role: t.speaker === 'terapeuta' ? 'assistant' : 'user', text: t.text })),
  ];
  return { purpose: 'therapist', system, messages, schema: TherapistSchema };
}
