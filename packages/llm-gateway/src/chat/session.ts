// Sesión de charla (spec 043): une el motor (tono, postura y aprendizaje; `@datas-world/engine`) con la pasarela
// (clasificar, expresar y verificar). Orden de cada turno (R-016, R-023): tono → postura (local, < 10 ms) →
// `onStance` → texto en streaming → la verificación queda en segundo plano.
import {
  CHAT_DEFAULTS, createRng, formatId, rulesOf, selectStance, sensitivityOf, startConversation, storeOf, variabilityOf, visitorSaid,
} from '@datas-world/engine';
import type {
  ChatParams, ChatSessionInput, ConversationState, EntityId, LearningParams, LiveState, Ontology, PersonCtx, Rng, StanceChoice,
  WorldEvent, WorldView,
} from '@datas-world/engine';
import type { Gateway } from '../gateway.ts';
import type { ChatCatalogs, StanceInfo } from './catalog.ts';
import { classifyTone } from './classify.ts';
import type { ToneResult } from './classify.ts';
import { expressionRequest } from './prompt.ts';
import type { TranscriptTurn } from './prompt.ts';
import { verifyReply } from './verify.ts';
import type { Verification } from './verify.ts';
import { buildPersonView } from './view.ts';
import type { PersonView } from './view.ts';

/** R-014: plantilla por postura cuando no hay LLM, presupuesto o red. */
export const TEMPLATES: Record<string, string> = {
  abrirse: 'Pues sí, con gusto le cuento.',
  aplacar: 'Tranquilo, no se preocupe, eso se arregla.',
  callar: 'Mmm.',
  contraatacar: '¿Y usted quién se cree para hablarme así?',
  evadir: 'Mejor hablemos de otra cosa.',
  poner_limite: 'No, así no. A mí me habla con respeto.',
  responder_breve: 'Sí, claro.',
  terminar: 'Bueno, me tengo que ir. Hasta luego.',
};

export class ChatEndedError extends Error {
  constructor(id: string) {
    super(`La charla ${id} ya terminó`);
  }
}

export interface ChatSessionOptions {
  gateway: Gateway;
  catalogs: ChatCatalogs;
  onto: Ontology;
  P: LearningParams;
  params?: ChatParams;
  view: WorldView;
  citizenId: string;
  /** Eventos candidatos de la persona y su familia (los filtra la vista, R-003). */
  events: readonly WorldEvent[];
  sessionId: string;
  visitorId: string;
  /** Semilla de la sesión (R-011): sale del hash del mundo y del id de la sesión. */
  seed: number;
  now: number;
}

export interface TurnOptions {
  toneTag?: string;
  /** Estado vivo releído del mundo (R-019.4); sin él, el de la vista. */
  live?: LiveState;
  /** Fin por compromiso o por tiempo (R-019.5): la postura es esa. */
  forced?: string;
  now?: number;
  onStance?: (s: { tone: ToneResult; choice: StanceChoice }) => void;
  onText?: (chunk: string) => void;
}

export interface TurnOutcome {
  seq: number;
  tone: ToneResult;
  choice: StanceChoice;
  reply: string;
  expression: 'llm' | 'template';
  llmRef?: string;
  latencyMs: { firstToken?: number; total: number };
  /** Llega después, sin bloquear el turno (R-012, R-013). */
  verification: Promise<Verification>;
}

export class ChatSession {
  readonly view: PersonView;
  readonly state: ConversationState;
  readonly transcript: TranscriptTurn[] = [];
  ended = false;
  #o: ChatSessionOptions;
  #pc: PersonCtx;
  #rng: Rng;
  #turns: { tone: string; stance: string }[] = [];

  constructor(o: ChatSessionOptions) {
    this.#o = o;
    const row = Number(o.citizenId.slice(4));
    this.view = buildPersonView({ view: o.view, citizenId: o.citizenId, now: o.now, events: o.events });
    this.state = startConversation(storeOf(o.view, row), o.visitorId);
    const person = o.view.citizens.get(formatId('CIT', row) as EntityId);
    this.#pc = {
      onto: o.onto, P: o.P, sens: sensitivityOf(o.view, row), rules: rulesOf(o.view, row),
      ...(person?.network ? { net: JSON.parse(JSON.stringify(person.network)) } : {}),
      variability: variabilityOf(o.view, row),
    };
    this.#rng = createRng(o.seed).fork(`chat:${o.sessionId}`);
  }

  get params(): ChatParams {
    return this.#o.params ?? CHAT_DEFAULTS;
  }

  async turn(text: string, t: TurnOptions = {}): Promise<TurnOutcome> {
    if (this.ended) throw new ChatEndedError(this.#o.sessionId);
    const { gateway: gw, catalogs } = this.#o;
    const now = t.now ?? this.#o.now;
    const t0 = performance.now();
    const tone = await classifyTone(gw, catalogs, text, t.toneTag);
    const toneDef = catalogs.engine.tones.find((x) => x.key === tone.tone);
    if (!toneDef) throw new Error(`Tono desconocido: ${tone.tone}`);
    visitorSaid(this.state, this.#pc, catalogs.engine, toneDef, now, this.params);
    const live = t.live ?? { energy: this.view.state.needs['energía'] ?? 1, stress: this.view.state.stress };
    const seq = this.state.turns.length;
    const choice = selectStance(this.state, this.#pc, catalogs.engine, toneDef, live, now, this.params, this.#rng.fork(seq), t.forced);
    t.onStance?.({ tone, choice });
    this.transcript.push({ speaker: 'visitor', text });
    const stance = catalogs.stances.find((s) => s.key === choice.stance) as StanceInfo;
    const r = await gw.run(expressionRequest(this.view, this.transcript, choice, stance, t.onText));
    let reply = r.text ?? '';
    let expression: 'llm' | 'template' = 'llm';
    if (!reply.trim()) {
      reply = TEMPLATES[choice.stance] ?? '…';
      expression = 'template';
      t.onText?.(reply);
    }
    this.transcript.push({ speaker: 'citizen', text: reply });
    this.#turns.push({ tone: tone.tone, stance: choice.stance });
    if (choice.stance === 'terminar') this.ended = true;
    return {
      seq, tone, choice, reply, expression,
      ...(expression === 'llm' ? { llmRef: r.recordKey } : {}),
      latencyMs: { ...(r.latencyMs.firstToken !== undefined ? { firstToken: r.latencyMs.firstToken } : {}), total: performance.now() - t0 },
      verification: expression === 'llm' ? verifyReply(gw, this.view, stance, reply) : Promise.resolve({ claims: [], stanceCheck: 'unchecked' }),
    };
  }

  /** La entrada que consolidará el worker, sin resumen (plantilla del motor). */
  input(): ChatSessionInput {
    this.ended = true;
    return { sessionId: this.#o.sessionId, citizenId: this.#o.citizenId as EntityId, visitorId: this.#o.visitorId, turns: [...this.#turns] };
  }

  /** Cierra la charla (R-019.6): el resumen para el recuerdo y la entrada que consolidará el worker. */
  async close(): Promise<ChatSessionInput> {
    this.ended = true;
    const r = this.transcript.length === 0 ? undefined : await this.#o.gateway.run({
      purpose: 'summarize',
      citizenId: this.#o.citizenId,
      system: [{ text: `Resume en una sola frase, en tercera persona y en español, cómo fue esta charla por chat para ${this.view.name}: de qué hablaron y en qué tono. Sin inventar nada que no esté en la charla.`, cacheable: true }],
      messages: [{ role: 'user', text: this.transcript.map((x) => `${x.speaker === 'visitor' ? 'Visitante' : this.view.name}: ${x.text}`).join('\n') }],
    });
    const summary = r && r.source !== 'fallback' ? r.text?.trim() : undefined;
    return {
      sessionId: this.#o.sessionId, citizenId: this.#o.citizenId as EntityId, visitorId: this.#o.visitorId,
      turns: [...this.#turns], ...(summary ? { summary } : {}),
    };
  }
}
