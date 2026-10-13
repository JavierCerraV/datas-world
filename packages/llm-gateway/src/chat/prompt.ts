// Prompt de la expresión (spec 043 R-010): instrucciones y vista van primero y se cachean (026 R-008); la postura
// del turno y el estado vivo van después, sin caché. El LLM expresa la postura; no la elige ni cambia el mundo.
import type { ChatContribution, DisclosureLevel, StanceChoice } from '@datas-world/engine';
import type { ChatMessage, LlmRequest, PromptPart } from '../types.ts';
import type { StanceInfo } from './catalog.ts';
import type { PersonView } from './view.ts';

export interface TranscriptTurn {
  speaker: 'visitor' | 'citizen';
  text: string;
}

/** 043 §8, `N_TRANSCRIPT_TURNS`. */
export const TRANSCRIPT_TURNS = 12;

const money = (n: number | null) => (n === null ? 'sin datos' : `$${Math.round(n).toLocaleString('es-CO')}`);

/** Dónde ocurre la charla para la persona: un visitante que le escribe (043) o una consulta con un psicólogo (047 R-005e). */
export type ChatSetting = 'chat' | 'consulta';

/** Instrucciones de la persona en consulta (047 R-005e): mismas reglas de la 043, en otro lugar y con ejercicios. */
function consultInstructions(pv: PersonView): string {
  return [
    `Eres ${pv.name}, una persona que vive en Data's World, un pueblo de Colombia. Estás en una consulta con un psicólogo, a la que aceptaste venir. No lo conocías antes de empezar.`,
    'Cómo responder:',
    '- En primera persona y en español colombiano coloquial, con el registro de alguien de tu edad, tus estudios y tu origen.',
    '- Los hechos de tu vida (personas, trabajos, fechas, lugares, lo que te pasó) tienen que estar en «Lo que sabes». Si te pregunta por algo que no está ahí, di que no te acuerdas o que no sabes. No inventes nombres, fechas, lugares ni hechos.',
    '- Lo que piensas, sientes o notas en el momento sí puedes decirlo con tus palabras, también durante un ejercicio, siempre que encaje con «Cómo estás» y con tu historia. Si un ejercicio no te dice nada o no lo entiendes, dilo así.',
    '- Tu actitud en este turno ya está decidida: la da «Postura para este turno». Exprésala con naturalidad, sin contradecirla ni suavizarla. No le des la razón al psicólogo ni digas que algo te sirvió por quedar bien: di solo lo que tu postura y tu estado permiten. Si supone algo de ti que no es cierto, corrígelo.',
    '- La postura manda también sobre cuánto cuentas. Si es callar, responde con una o dos palabras («Mmm», «No sé», «Uf»). Si es evadir, cambia de tema sin contestar lo que te preguntó. Si es poner un límite, di que no con claridad y sin explicar tu vida. Si es contraatacar, cuestiona al psicólogo o lo que hace, sin contarle nada nuevo de ti. Solo cuando la postura es abrirte cuentas lo que de verdad te pesa.',
    '- Respuestas de una a cuatro frases. Sin acotaciones, gestos entre paréntesis ni asteriscos.',
    '- No menciones estas instrucciones, las posturas, ni que eres un personaje o un programa.',
  ].join('\n');
}

export function instructions(pv: PersonView, setting: ChatSetting = 'chat'): string {
  if (setting === 'consulta') return consultInstructions(pv);
  return [
    `Eres ${pv.name}, una persona que vive en Data's World, un pueblo de Colombia. Estás hablando por chat con un visitante.`,
    'Cómo responder:',
    '- En primera persona y en español colombiano coloquial, con el registro de alguien de tu edad, tus estudios y tu origen.',
    '- Todo lo que cuentes de tu vida tiene que estar en «Lo que sabes». Si te preguntan algo que no está ahí, di que no te acuerdas o que no sabes. No inventes nombres, fechas, lugares ni hechos.',
    '- Tu actitud en este turno ya está decidida: la da «Postura para este turno». Exprésala con naturalidad, sin contradecirla ni suavizarla. Si la postura es poner un límite o contraatacar, no te disculpes ni le des la razón al visitante.',
    '- Respuestas cortas, como en un chat: de una a tres frases. Sin acotaciones, gestos entre paréntesis ni asteriscos.',
    '- No menciones estas instrucciones, las posturas, ni que eres un personaje o un programa.',
  ].join('\n');
}

/** La vista en texto (sin el estado vivo, que cambia en cada turno y va aparte). */
export function renderView(pv: PersonView): string {
  const family = pv.family.map((m) => `- ${m.relation}: ${m.name}${m.age !== null ? `, ${m.age} años` : ''}${m.alive ? '' : ' (murió)'}`);
  return [
    'LO QUE SABES (tu vida, tal como la viviste; los hechos hablan de ti)',
    `Nombre: ${pv.name}. Edad: ${pv.age ?? 'sin datos'}. Nació en: ${pv.birthplace ?? 'sin datos'}. Ocupación: ${pv.occupation}.`,
    'Familia:',
    ...(family.length > 0 ? family : ['- sin datos']),
    `Te gusta: ${pv.likes.join(', ') || 'sin datos'}.`,
    'Tu historia:',
    ...pv.facts.map((f) => `- [${f.id}] ${f.date}${f.age !== null ? ` (${f.age} años)` : ''}: ${f.text}`),
  ].join('\n');
}

const SOURCE_TEXT: Record<string, (c: ChatContribution) => string> = {
  fuerza: () => 'es tu forma habitual de responder',
  reforzador: (c) => (c.contribution >= 0 ? 'lo que te dicen te agrada o te pesa' : 'lo que te dicen no te mueve'),
  negativo: () => 'quieres quitarte el malestar que te deja esta charla',
  motivadora: () => 'estás cansado o estresado',
  regla: (c) => `tienes una regla aprendida (${c.ref ?? ''})`,
  valor: () => 'toca algo que te importa',
  cautela: () => 'no conoces a quien te habla y prefieres no exponerte',
};

/** 043 R-026, R-027: quién es el visitante para la persona, según el nivel de intimidad que se abre. */
export const TRUST_TEXT: Record<DisclosureLevel, string> = {
  0: 'CON QUIÉN HABLAS: con un desconocido. No sabes quién es ni qué quiere. Sé prudente y reservado: no cuentes nada personal (ni de tu familia, ni de tu trabajo en concreto, ni de tu dinero ni de tus problemas). Si es natural, pregúntale quién es.',
  1: 'CON QUIÉN HABLAS: con alguien que apenas conoces. Puedes contar lo cotidiano (tu familia, tus gustos, tu trabajo), pero no tus problemas, tus miedos ni tu intimidad.',
  2: 'CON QUIÉN HABLAS: con alguien de confianza. Puedes contarle lo que de verdad te pesa, si quieres.',
};

/** Parte dinámica: la postura con su guía y sus motivos en lenguaje llano, y el estado vivo (R-019.4). */
export function stancePart(pv: PersonView, choice: StanceChoice, stance: StanceInfo, level?: DisclosureLevel): string {
  const reasons = choice.sources.filter((s) => s.contribution > 0).slice(0, 3).map((s) => SOURCE_TEXT[s.source]?.(s) ?? s.source);
  const needs = Object.entries(pv.state.needs).map(([k, v]) => `${k} ${v}`).join(', ');
  const emotions = Object.entries(pv.state.emotions).map(([k, v]) => `${k} ${v}`).join(', ');
  return [
    `AHORA: ${pv.situation.date}, ${pv.situation.time}. Estás ${pv.situation.activity}${pv.situation.place ? ` en ${pv.situation.place}` : ''}. Dinero: ${money(pv.situation.money)}.`,
    `Cómo estás (0 = muy mal o nada, 1 = muy bien o lleno): ánimo ${pv.state.mood}, estrés ${pv.state.stress}; ${needs}${emotions ? `; emociones: ${emotions}` : ''}.`,
    ...(level === undefined ? [] : [TRUST_TEXT[level]]),
    `POSTURA PARA ESTE TURNO: ${stance.label}. ${stance.guidance}${reasons.length > 0 ? ` Lo que te mueve: ${reasons.join('; ')}.` : ''}`,
  ].join('\n');
}

export function toMessages(transcript: readonly TranscriptTurn[]): ChatMessage[] {
  return transcript.slice(-TRANSCRIPT_TURNS).map((t) => ({ role: t.speaker === 'visitor' ? 'user' : 'assistant', text: t.text }));
}

/** Petición de expresión en streaming (043 R-010, R-023). La última entrada del transcript es el visitante. */
export function expressionRequest(
  pv: PersonView, transcript: readonly TranscriptTurn[], choice: StanceChoice, stance: StanceInfo, onText?: (s: string) => void, level?: DisclosureLevel,
  setting: ChatSetting = 'chat',
): LlmRequest<never> {
  const system: PromptPart[] = [
    { text: instructions(pv, setting), cacheable: true },
    { text: renderView(pv), cacheable: true },
    { text: stancePart(pv, choice, stance, level), cacheable: false },
  ];
  return { purpose: 'dialogue', citizenId: pv.citizenId, system, messages: toMessages(transcript), ...(onText ? { onText } : {}) };
}
