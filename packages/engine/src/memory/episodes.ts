// Episodios (spec 013 R-001 a R-007): codificar un hecho con la saliencia que le dan las funciones de la persona,
// olvidar en ley de potencia, recuperar con el sesgo del ánimo y reconstruir al recordar. Puro y sin azar.
import type { WorldEvent } from '../events.ts';
import type { EntityId } from '../ids.ts';
import { personStimulus } from '../relationships/params.ts';
import type { DeepReadonly, WorldView } from '../simulation/system.ts';
import { MEMORY_KINDS, peopleOf } from './kinds.ts';
import type { Memory, MemoryParams, MemoryStore } from './types.ts';

const DAY = 1440;
const clamp1 = (x: number) => Math.max(-1, Math.min(1, x));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const r3 = (x: number) => Math.round(x * 1000) / 1000;
/** La función actual de un estímulo para la persona (036, directa). */
export type FnOf = (stim: string) => number;

/**
 * R-001: el valor de un hecho para la persona. La consecuencia (λ) pesa más cuanto más le importa lo presente
 * (la mayor función en valor absoluto), y el afecto por las personas presentes tiñe el conjunto. Con las funciones
 * de hoy, es también el blanco de la reconstruccion (R-007).
 */
export function episodeValue(lambda: number, stims: readonly string[], fn: FnOf): number {
  let relevance = 0;
  let aff = 0;
  let people = 0;
  for (const s of stims) {
    const v = fn(s);
    relevance = Math.max(relevance, Math.abs(v));
    if (s.startsWith('cit.')) {
      aff += v;
      people++;
    }
  }
  return clamp1(lambda * (0.5 + relevance) + (people ? (0.5 * aff) / people : 0));
}

const numberOf = (id: string) => Number(id.slice(4));
const byId = (a: { id: string }, b: { id: string }) => numberOf(a.id) - numberOf(b.id);

/** Quién recuerda un hecho: los de su tipo o las personas que participan. */
export function remembererOf(e: DeepReadonly<WorldEvent>, view: WorldView): EntityId[] {
  const kind = MEMORY_KINDS[e.type];
  if (!kind) return [];
  if (kind.onlyA) return [(e.payload as { a: EntityId }).a];
  if (kind.who) return kind.who(e, view);
  return [...new Set(e.participants.filter((p) => p.id.startsWith('CIT-')).map((p) => p.id))];
}

/**
 * R-001: codifica un hecho en la memoria de `me` si su saliencia supera `encodeMin`. La habituación rebaja lo que
 * se repite: el mismo tipo con lo mismo presente en los últimos días. Devuelve el episodio creado.
 */
export function encodeEvent(
  store: MemoryStore, e: DeepReadonly<WorldEvent>, me: EntityId, view: WorldView, fn: FnOf, p: MemoryParams, source: Memory['source'] = 'lived',
): Memory | undefined {
  const kind = MEMORY_KINDS[e.type];
  if (!kind) return undefined;
  const stims = [...peopleOf(e, me).map(personStimulus), ...(kind.stims?.(e, view) ?? [])].slice(0, 4);
  const lambda = typeof kind.lambda === 'number' ? kind.lambda : kind.lambda(e);
  const value = episodeValue(lambda, stims, fn);
  const seen = store.episodes.some((m) => m.kind === e.type && m.stims[0] === stims[0] && e.at - m.at < p.noveltyDays * DAY);
  const salience = Math.abs(value) * (0.5 + 0.5 * e.importance) * (seen ? p.noveltyFactor : 1);
  if (salience < p.encodeMin) return undefined;
  return addMemory(store, {
    event: e.id, at: e.at, source, kind: e.type, stims, lambda, valence: r3(value), valence0: r3(value), intensity: r3(clamp01(salience)), rehearsals: 0,
    ...(kind.us ? { us: kind.us } : {}),
  });
}

/** Añade un episodio con el siguiente id y el capítulo abierto. */
export function addMemory(store: MemoryStore, m: Omit<Memory, 'id'>): Memory {
  const open = store.chapters.find((c) => c.to === undefined);
  const mem: Memory = { id: `MEM-${store.next++}`, ...m, ...(open && m.chapter === undefined ? { chapter: open.id } : {}) };
  store.episodes.push(mem);
  return mem;
}

/** R-004 [E] fenómeno / [M] forma: retención en ley de potencia (Wixted; referencia a verificar, PA-146). */
export const retention = (days: number, valence: number, rehearsals: number, p: MemoryParams): number =>
  Math.pow(1 + Math.max(0, days) / p.tauDays, -p.beta / ((1 + Math.abs(valence)) * (1 + rehearsals)));

/** Un día más de olvido: la razón entre la retención de hoy y la de ayer. */
export function decayDay(m: Memory, now: number, p: MemoryParams): void {
  const days = (now - m.at) / DAY;
  if (days <= 0) return;
  m.intensity = r3(m.intensity * (retention(days, m.valence, m.rehearsals, p) / retention(days - 1, m.valence, m.rehearsals, p)));
}

/** R-004, R-005: olvida lo que bajó de `forget` y, por encima del tope, lo de menor intensidad × recencia. */
export function trim(store: MemoryStore, now: number, p: MemoryParams): number {
  const anchors = new Set(store.chapters.flatMap((c) => c.anchors));
  const before = store.episodes.length;
  store.episodes = store.episodes.filter((m) => m.intensity >= p.forget || anchors.has(m.id));
  if (store.episodes.length > p.maxEpisodes) {
    const weight = (m: Memory) => m.intensity / (1 + (now - m.at) / DAY / p.recencyDays);
    const drop = new Set(store.episodes.filter((m) => !anchors.has(m.id)).sort((a, b) => weight(a) - weight(b) || byId(a, b)).slice(0, store.episodes.length - p.maxEpisodes).map((m) => m.id));
    store.episodes = store.episodes.filter((m) => !drop.has(m.id));
  }
  const gone = before - store.episodes.length;
  store.forgotten += gone;
  return gone;
}

export interface RecallContext {
  /** Estímulos del momento (personas, lugar, términos): suben lo que los comparte. */
  stims?: readonly string[];
  mood: number;
  now: number;
}

/** R-006: los k episodios más relevantes; empates por id (CA-008). */
export function recall(store: DeepReadonly<MemoryStore> | undefined, c: RecallContext, k: number, p: MemoryParams): Memory[] {
  if (!store) return [];
  const ctx = new Set(c.stims ?? []);
  const score = (m: DeepReadonly<Memory>) => {
    const overlap = m.stims.reduce((n, s) => n + (ctx.has(s) ? 1 : 0), 0);
    const recency = 1 / (1 + (c.now - m.at) / DAY / p.recencyDays);
    const mood = Math.max(0, 1 + p.moodBias * m.valence * (c.mood - 0.5));
    return m.intensity * recency * (1 + overlap) * mood;
  };
  return [...store.episodes]
    .map((m) => ({ m, s: score(m) }))
    .sort((a, b) => b.s - a.s || byId(a.m, b.m))
    .slice(0, k)
    .map((x) => x.m as Memory);
}

/** R-007: recordar sube la intensidad y reconstruye la valencia hacia el valor que tiene hoy el hecho. */
export function rehearse(m: Memory, fn: FnOf, p: MemoryParams): void {
  m.intensity = r3(clamp01(m.intensity + p.rehearsalGain * (1 - m.intensity)));
  m.valence = r3(clamp1(m.valence + p.reconstruct * (episodeValue(m.lambda, m.stims, fn) - m.valence)));
  m.rehearsals++;
}

/** Distorsión de un episodio: cuánto se aleja lo que recuerda de lo que vivió. */
export const distortion = (m: DeepReadonly<Memory>): number => Math.abs(m.valence - m.valence0);
