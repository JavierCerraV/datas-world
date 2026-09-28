// El intercambio de un encuentro (spec 012 R-002): cada lado elige una postura con la selección de la 040 y el
// catálogo de la charla (043), y lo que recibe del otro forma la función del otro (`cit.<CIT>`) en su almacén. Es la
// charla sin LLM: la misma escena deja vínculos distintos en cada lado. Puro salvo el `rng`.
import { operant } from '../functions/learn.ts';
import type { FunctionStore } from '../functions/types.ts';
import type { Rng } from '../rng.ts';
import type { ChatParams } from '../conversation/params.ts';
import { selectStance } from '../conversation/stance.ts';
import type { PersonCtx } from '../conversation/stance.ts';
import { visitorSaid } from '../conversation/tone.ts';
import type { ChatCatalog, ConversationState, LiveState, ToneDef } from '../conversation/types.ts';
import { APPROACH, CLASH, TONE_OF_STANCE, personStimulus } from './params.ts';
import type { RelationshipParams } from './params.ts';

export interface Side {
  id: string;
  /** Copia de trabajo del almacén de la persona (se modifica). */
  store: FunctionStore;
  pc: PersonCtx;
  live: LiveState;
  /** Tensión vigente con el otro: es la carga aversiva con que llega al encuentro. */
  tension: number;
}

export interface Exchange {
  stanceA: string;
  stanceB: string;
  /** Tono con que cada uno recibió al otro. */
  receivedA: string;
  receivedB: string;
}

const conversation = (me: Side, other: string): ConversationState => ({
  visitorId: other,
  visitorStim: personStimulus(other),
  store: me.store,
  aversiveLoad: me.tension,
  maxLoad: me.tension,
  turns: [],
});

/** [M] Tensión viva y función del otro desde las que el otro ya es ocasión de chocar. */
const AVERSIVE_TENSION = 0.1;
const AVERSIVE_FN = -0.1;

/**
 * R-002: contraatacar y poner un límite son respuestas ante algo aversivo (su estímulo discriminativo): solo son
 * opciones si el trato recibido es aversivo, si hay tensión viva con el otro o si su función ya es negativa (antes
 * de este encuentro).
 */
function optionsFor(cat: ChatCatalog, me: Side, other: string, received: ToneDef): ChatCatalog {
  const fn = me.store.f.find((f) => f.s === personStimulus(other))?.v ?? 0;
  if (received.prior < 0 || me.tension > AVERSIVE_TENSION || fn < AVERSIVE_FN) return cat;
  return { ...cat, stances: cat.stances.filter((s) => !CLASH.has(s.key)) };
}

/** R-002: A se fija en B y elige; B recibe esa postura como tono y elige; A recibe la de B. */
export function exchange(a: Side, b: Side, cat: ChatCatalog, chat: ChatParams, p: RelationshipParams, now: number, rng: Rng): Exchange {
  const tone = (key: string): ToneDef => cat.tones.find((t) => t.key === key) ?? cat.tones.find((t) => t.key === 'neutro')!;
  const sA = conversation(a, b.id);
  const sB = conversation(b, a.id);
  const hello = tone('neutro');
  const catA = optionsFor(cat, a, b.id, hello);
  // A inicia: no oye nada de B todavía (no empareja a B con su propio saludo); el saludo neutro es la línea base con
  // la que se compara lo que B le devuelva (043 R-009).
  sA.lastTone = { stimulus: hello.stimulus, value: 0 };
  const cA = selectStance(sA, a.pc, catA, hello, a.live, now, chat, rng.fork('a'));
  const toB = tone(TONE_OF_STANCE[cA.stance] ?? 'neutro');
  const catB = optionsFor(cat, b, a.id, toB);
  visitorSaid(sB, b.pc, cat, toB, now, chat);
  const cB = selectStance(sB, b.pc, catB, toB, b.live, now, chat, rng.fork('b'));
  const toA = tone(TONE_OF_STANCE[cB.stance] ?? 'neutro');
  // A recibe la respuesta: aprende la función de B y su postura se refuerza o se castiga (043 R-009).
  visitorSaid(sA, a.pc, cat, toA, now, chat);
  // Acercarse (036 R-002): se refuerza si le fue bien, se debilita si no [M].
  if (!a.store.r.some((x) => x.r === APPROACH && x.c === '')) a.store.r.push({ r: APPROACH, c: '', w: p.approachW0, n: 0, at: now });
  operant(a.store, APPROACH, '', Math.max(0, Math.min(1, 0.5 + 0.5 * toA.prior)), now, a.pc.P, a.pc.sens);
  return { stanceA: cA.stance, stanceB: cB.stance, receivedA: toA.key, receivedB: toB.key };
}
