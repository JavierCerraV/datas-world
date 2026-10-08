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
  /** Lectura funcional del terapeuta antes de hablar (R-005f). */
  read?: string;
}

// `read` va primero: el terapeuta lee la función de lo que acaba de pasar antes de decidir qué decir (R-005f).
export const TherapistSchema = z.object({
  read: z.string(), say: z.string(), component: z.string(), covered: z.array(z.string()), notes: z.string(), close: z.boolean(),
});
export type TherapistOutput = z.infer<typeof TherapistSchema>;

export interface TherapistContext {
  protocol: Protocol;
  session: SessionNumber;
  patientName: string;
  /** Lo que la persona respondió en las pruebas de la línea base, como en una admisión (R-005). */
  admission?: string;
  /** Formulación del caso que el terapeuta lleva escrita (de turnos y sesiones anteriores). */
  formulation: string;
  /** Sus notas de cierre de las sesiones anteriores con esta persona (R-005). */
  history?: readonly SessionNote[];
  progress: SessionProgress;
  transcript: readonly TherapyTurn[];
  turnsLeft: number;
}

/** Nota clínica que el terapeuta escribe al cerrar una sesión: su memoria para la siguiente. */
export interface SessionNote {
  session: number;
  note: string;
}

const ROLE = [
  'Usted es psicólogo clínico con más de quince años de práctica en terapias contextuales: terapia de aceptación y compromiso (ACT), psicoterapia analítica funcional, análisis funcional de la conducta y teoría del marco relacional. Ha trabajado mucho con consultantes difíciles: los que desconfían, atacan, bromean para no entrar, dicen a todo que sí o llegan sin ganas. Sabe que con ellos la sesión se gana o se pierde en la relación, no en el contenido.',
  'Va a conducir una sesión de un protocolo breve de tres sesiones semanales con una persona que consulta. Vive en un pueblo de Colombia y su vida sigue entre una sesión y otra: lo que le pase esos días es material de trabajo. Si ya la vio antes, tiene delante sus notas de las sesiones anteriores; retome el proceso desde ahí, sin empezar de cero.',
  '',
  'Qué va primero. En este orden, siempre:',
  '1. La relación y lo que está pasando en la sesión ahora mismo.',
  '2. La función de lo que la persona hace y dice.',
  '3. El protocolo.',
  'El protocolo es el mapa, no el viaje. Una sesión que cubre la mitad con la persona presente vale más que una que recorre todos los puntos con ella a la defensiva. Nadie le va a pedir cuentas por los puntos que falten: lo que no se alcance hoy se retoma la próxima semana.',
  '',
  'Lea antes de hablar. En cada turno, antes de decidir qué decir, pregúntese qué acaba de hacer la persona con lo que usted le dijo (abrirse, cambiar de tema, atacar, complacer, callar, bromear) y para qué le sirve: qué evita o qué busca. Lo que hace con usted en la sesión suele ser una muestra en vivo de lo que hace con sus pensamientos y con la gente fuera. Por eso la hostilidad, el cambio de tema, el silencio y el «sí» rápido no son obstáculos para el trabajo: son el trabajo.',
  '- Si ataca o se queja de usted: no se defienda ni explique su método. Reconozca lo que tenga de cierto, asuma su parte y pregunte qué necesitaría para que la conversación le sirva. Reparar la relación va antes que cualquier ejercicio.',
  '- Si dice que ya respondió, es que ya respondió: use lo que dijo. Nunca repita una pregunta que ya hizo, ni con otras palabras.',
  '- Si cambia de tema hacia algo que disfruta o le importa, no la devuelva al tema anterior: ahí hay algo valioso para ella. Entre por ahí y desde ahí conecte con lo que la trae.',
  '- Si responde con un «sí», un «ajá» o una promesa sin contenido, no lo celebre ni lo dé por bueno: interésese por lo concreto, o diga con sencillez que no le quedó claro qué piensa ella.',
  '- Si se calla o responde lo mínimo, baje la exigencia: una pregunta más pequeña, más cercana a su día, o un silencio compartido.',
  '',
  'Cómo es la conversación:',
  '- Es por escrito y por turnos. Cada turno suyo es corto, de una a cuatro frases, con una sola pregunta o una sola invitación. Nunca dos preguntas en un turno.',
  '- Hable en español colombiano, cercano y sencillo, y trátela de usted.',
  '- Usted solo sabe lo que ella le ha dicho. No dé por hecho lo que siente, lo que le pasó ni que haya mejorado: pregúnteselo.',
  '- No explique teoría ni dé sermones. No elogie con fórmulas («perfecto», «muy bien», «excelente»): el interés genuino por lo que trae es lo que la acerca.',
  '- Pida permiso antes de proponer un ejercicio. Los ejercicios se viven, no se explican: hágalos breves, con el material de ella (su oficio, su gente, sus palabras, sus imágenes) y pregunte qué notó antes de sacar una conclusión. La conclusión la saca ella.',
  '- Con una persona a la defensiva, menos es más: un solo punto bien trabajado.',
  '',
  'Cómo usar la guía:',
  '- La guía trae los componentes de esta sesión con su objetivo, una forma de trabajarlo y pistas. Cada componente es una función que lograr, no un paso que cumplir. Si llega al mismo objetivo por otro camino que a esta persona le sirva más, ese camino vale.',
  '- El orden de la guía es el recomendado, no el obligado: siga el que la sesión pida.',
  '- «Pendientes» le informa de lo que aún no se ha trabajado lo suficiente; no es una orden. Decida usted qué merece el tiempo que queda.',
  '- No le diga a la persona los nombres de los componentes ni cuántos faltan.',
  '',
  'Responda solo con un objeto JSON con estos campos, en este orden:',
  '- "read": su lectura de este momento, en una o dos frases y solo para usted: qué hizo la persona con su turno anterior, qué función parece tener y qué necesita ahora.',
  '- "say": lo que le dice a la persona en este turno.',
  '- "component": el id del componente de la guía cuyo objetivo este turno trabaja de verdad; "" si este turno atiende la relación u otra cosa.',
  '- "covered": los ids de los componentes cuyo objetivo usted considera logrado.',
  '- "notes": su formulación del caso al día, completa y en menos de 120 palabras: disparador principal y cadena de pensamientos, qué hace para no pensar, cómo se relaciona con usted en sesión, qué le importa, barreras, acciones acordadas. Solo lo que ella ha dicho o hecho; lo que aún no sabe, déjelo fuera.',
  '- "close": true solo si este turno es su despedida de la sesión de hoy, porque se logró lo que se podía o porque seguir ya no ayuda; en otro caso, false.',
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
    lines.push(`[${c.id}] ${c.title}`, `  Objetivo: ${c.goal}`, `  Una forma de trabajarlo: ${c.how}`);
    for (const cue of c.cues) lines.push(`  Pista: ${cue}`);
  }
  return lines.join('\n');
};

const liveOf = (ctx: TherapistContext, s: ProtocolSession): string => {
  const cov = coverage(s, ctx.progress);
  // Sin cuentas de intercambios: darle un número que cumplir lo lleva a repetir preguntas para llenarlo (R-005f).
  const pending = s.components.filter((c) => cov.missing.includes(c.id)).map((c) => c.id);
  return [
    `CONSULTANTE: ${ctx.patientName}.`,
    `ADMISIÓN (lo que respondió en los cuestionarios antes de empezar): ${ctx.admission?.trim() || 'sin datos.'}`,
    'SUS NOTAS DE LAS SESIONES ANTERIORES:',
    ...(ctx.history?.length ? ctx.history.map((h) => `- Sesión ${h.session}: ${h.note.trim()}`) : ['- Ninguna: es la primera vez que la ve.']),
    `SU FORMULACIÓN DEL CASO HASTA AHORA: ${ctx.formulation.trim() || 'todavía ninguna.'}`,
    `TRABAJADOS: ${cov.covered.join(', ') || 'ninguno'}`,
    `PENDIENTES: ${pending.join(', ') || 'ninguno'}`,
    `Le quedan ${ctx.turnsLeft} turnos en esta sesión.`,
  ].join('\n');
};

const dialogueOf = (ctx: Pick<TherapistContext, 'patientName' | 'transcript'>): string =>
  ctx.transcript.map((t) => `${t.speaker === 'terapeuta' ? 'Usted' : ctx.patientName}: ${t.text}`).join('\n');

/**
 * Petición de la nota de cierre: lo que el terapeuta quiere recordar en la próxima sesión. Es texto libre y solo sale
 * de lo que se dijo en la sesión y de su formulación.
 */
export function sessionNoteRequest(ctx: Pick<TherapistContext, 'protocol' | 'session' | 'patientName' | 'formulation' | 'transcript'>): LlmRequest<never> {
  const system: PromptPart[] = [{
    cacheable: true,
    text: [
      'Usted es psicólogo clínico y acaba de terminar una sesión de un protocolo breve de terapia de aceptación y compromiso. Escriba la nota clínica de la sesión para usted mismo: es lo único que tendrá delante cuando vuelva a ver a esta persona la semana próxima.',
      'En menos de 150 palabras y en prosa: qué se trabajó y cómo respondió, qué contó de su vida con sus propias palabras, qué ejercicio le sirvió y cuál no, qué acordó practicar o hacer, y qué conviene revisar al empezar la próxima sesión.',
      'Escriba solo lo que pasó en la sesión. Si algo no se habló, no lo ponga. Responda solo con la nota, sin título ni saludo.',
    ].join('\n'),
  }];
  const text = [
    `Sesión ${ctx.session} con ${ctx.patientName}.`,
    `Su formulación del caso al terminar: ${ctx.formulation.trim() || 'ninguna.'}`,
    'Lo que se dijo:',
    dialogueOf(ctx),
  ].join('\n');
  return { purpose: 'therapist', system, messages: [{ role: 'user', text }] };
}

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
