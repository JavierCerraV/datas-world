// El tono como estímulo (spec 043 R-005 a R-007, R-009): su función para la persona, lo que el visitante
// adquiere en la charla, la carga aversiva y lo que se aprende de qué sigue a cada turno. Puro y sin azar.
import { netValue, operant, pair } from '../functions/learn.ts';
import type { FunctionStore, LearningParams, Ontology, Sensitivity } from '../functions/types.ts';
import type { ChatParams } from './params.ts';
import { stanceResponse, visitorStimulus } from './params.ts';
import type { ChatCatalog, ChatSummary, ConversationState, StanceDef, ToneDef } from './types.ts';

const clamp1 = (x: number) => Math.max(-1, Math.min(1, x));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Lo que el motor necesita de la persona para la charla (sin temperamento: la sensibilidad es de la 036). */
export interface LearnerCtx {
  onto: Ontology;
  P: LearningParams;
  sens: Sensitivity;
}

/** Empieza una charla con una copia de trabajo del almacén de la persona (R-002, R-019). */
export function startConversation(store: FunctionStore, visitorId: string): ConversationState {
  return {
    visitorId,
    visitorStim: visitorStimulus(visitorId),
    baseTrials: store.f.find((f) => f.s === visitorStimulus(visitorId))?.n ?? 0,
    store: JSON.parse(JSON.stringify(store)) as FunctionStore,
    aversiveLoad: 0,
    maxLoad: 0,
    turns: [],
  };
}

/**
 * R-005 (opción A del usuario): función del tono para esta persona = `prior + netValue`, en [−1, 1]. La base
 * social siempre está y la historia (lo aprendido y lo generalizado, 036 R-004) la modula.
 */
export function toneValue(store: FunctionStore, lc: LearnerCtx, tone: ToneDef, now: number): number {
  return clamp1(tone.prior + netValue(store, lc.onto, tone.stimulus, '', now, lc.P));
}

/** R-006: valor que el visitante tiene ahora para la persona (su función propia), en [−1, 1]. */
export const visitorValue = (s: ConversationState): number => s.store.f.find((f) => f.s === s.visitorStim)?.v ?? 0;

/** Fuerza vigente de una postura: la aprendida o, si nunca la usó, su `w0` (PA-134). */
export const stanceStrength = (store: FunctionStore, st: StanceDef): number =>
  store.r.find((r) => r.r === stanceResponse(st.key) && r.c === '')?.w ?? st.w0;

/** Asegura que la respuesta de una postura exista en el almacén con su fuerza inicial antes de aprender. */
function seedStance(store: FunctionStore, st: StanceDef, now: number): void {
  const key = stanceResponse(st.key);
  if (!store.r.some((r) => r.r === key && r.c === '')) store.r.push({ r: key, c: '', w: st.w0, n: 0, at: now });
}

export interface VisitorTurn {
  toneValue: number;
  visitorValue: number;
  aversiveLoad: number;
}

/**
 * Un turno del visitante:
 * 1. R-009: lo que pasa ahora es la consecuencia del turno anterior. La postura anterior se refuerza si el trato
 *    mejora y se debilita si empeora (036 R-002), y el estímulo anterior aprende qué le sigue (036 R-001).
 * 2. R-006: el visitante se empareja con la función del tono (condicionamiento respondiente, estímulo social).
 * 3. R-007: la carga aversiva decae y suma la parte aversiva del tono.
 */
export function visitorSaid(
  s: ConversationState, lc: LearnerCtx, cat: ChatCatalog, tone: ToneDef, now: number, params: ChatParams,
): VisitorTurn {
  const v = toneValue(s.store, lc, tone, now);
  const lambda = v * tone.magnitude;
  if (s.lastTone) {
    if (s.lastStance) {
      const st = cat.stances.find((x) => x.key === s.lastStance);
      if (st) {
        seedStance(s.store, st, now);
        operant(s.store, stanceResponse(st.key), '', clamp1(v - s.lastTone.value), now, lc.P, lc.sens);
      }
    }
    pair(s.store, lc.onto, { stim: s.lastTone.stimulus, ctx: '', now, lambda, social: true }, lc.P, lc.sens);
  }
  pair(s.store, lc.onto, { stim: s.visitorStim, ctx: '', now, lambda, us: tone.stimulus, social: true }, lc.P, lc.sens);
  s.aversiveLoad = s.aversiveLoad * (1 - params.loadDecay) + tone.magnitude * Math.max(0, -v);
  s.maxLoad = Math.max(s.maxLoad, s.aversiveLoad);
  s.lastTone = { stimulus: tone.stimulus, value: v };
  delete s.lastStance;
  const turn = { seq: s.turns.length + 1, tone: tone.key, toneValue: v, visitorValue: visitorValue(s), aversiveLoad: s.aversiveLoad };
  s.turns.push(turn);
  return { toneValue: v, visitorValue: turn.visitorValue, aversiveLoad: s.aversiveLoad };
}

/** Anota la postura del ciudadano en el último turno (la elija el motor o venga del registro, R-019). */
export function citizenAnswered(s: ConversationState, stance: string): void {
  const last = s.turns.at(-1);
  if (last) last.stance = stance;
  s.lastStance = stance;
}

const top = (xs: string[], n: number): string[] => {
  const count = new Map<string, number>();
  for (const x of xs) count.set(x, (count.get(x) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n).map(([k]) => k);
};

/** R-020: resumen para el recuerdo. La intensidad crece con la carga máxima y con la duración. */
export function summarize(s: ConversationState): ChatSummary {
  const n = s.turns.length;
  const valence = n === 0 ? 0 : clamp1(s.turns.reduce((a, t) => a + t.visitorValue, 0) / n);
  return {
    turns: n,
    dominantTones: top(s.turns.map((t) => t.tone), 2),
    dominantStances: top(s.turns.flatMap((t) => (t.stance ? [t.stance] : [])), 2),
    valence,
    intensity: clamp01(0.6 * Math.tanh(s.maxLoad) + 0.4 * Math.min(1, n / 20)),
  };
}
