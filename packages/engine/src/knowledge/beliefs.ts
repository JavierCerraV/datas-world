// Creencias (spec 025 R-001, R-002, R-006, R-008): qué temas trae un hecho, cómo se guarda lo que se sabe (con sus
// contradicciones y un tope), cómo se evalúa lo que otro cuenta (con la credibilidad de la 044) y, solo para el
// análisis, si una creencia es verdad. Puro y sin azar.
import { bondOf } from '../conversation/claims.ts';
import type { ClaimParams } from '../conversation/params.ts';
import type { WorldEvent } from '../events.ts';
import { directValue } from '../functions/learn.ts';
import type { FunctionStore, LearningParams, Ontology } from '../functions/types.ts';
import type { EntityId } from '../ids.ts';
import { functionalValue } from '../relations/derive.ts';
import type { RelationalNetwork } from '../relations/types.ts';
import { personStimulus } from '../relationships/params.ts';
import type { DeepReadonly, WorldView } from '../simulation/system.ts';
import type { Belief } from '../world.ts';
import { SEEN, topicOf } from './types.ts';
import type { KnowledgeCatalog, KnowledgeParams, TopicDef } from './types.ts';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const clamp1 = (x: number) => Math.max(-1, Math.min(1, x));
export const r3 = (x: number) => Math.round(x * 1000) / 1000;
type Ev = DeepReadonly<WorldEvent>;

/** R-001: los temas que trae un hecho y de quién tratan. */
export function topicsOf(e: Ev, cat: KnowledgeCatalog): { topic: TopicDef; about: EntityId }[] {
  const out: { topic: TopicDef; about: EntityId }[] = [];
  const p = e.payload as Record<string, unknown>;
  for (const t of cat.topics) {
    if (t.event !== e.type) continue;
    if (t.when && Object.entries(t.when).some(([k, v]) => p[k] !== v)) continue;
    const who = t.subjects === 'pair' ? [p.a, p.b] : [p.citizenId];
    for (const x of who) if (typeof x === 'string' && x.startsWith('CIT-')) out.push({ topic: t, about: x as EntityId });
  }
  return out;
}

/**
 * Guarda una creencia (R-002, R-006): la misma se refuerza con la credibilidad mayor; una del mismo asunto con otro
 * estado o nivel la sustituye solo si es más creíble. Devuelve si quedó guardada. Por encima del tope sale la de
 * menor credibilidad × recencia.
 */
export function learn(list: Belief[], b: Belief, cat: KnowledgeCatalog, p: KnowledgeParams): boolean {
  const t = topicOf(cat, b.predicate);
  const same = list.findIndex((x) => x.about === b.about && x.predicate === b.predicate);
  if (same >= 0) {
    const cur = list[same]!;
    if (b.credibility <= cur.credibility && b.source !== SEEN) return false;
    list[same] = { ...b, ...(cur.told ? { told: cur.told } : {}) };
    return true;
  }
  if (t) {
    const rivals = list.filter((x) => x.about === b.about && x.predicate !== b.predicate && topicOf(cat, x.predicate)?.group === t.group);
    if (rivals.some((x) => x.credibility >= b.credibility && b.source !== SEEN)) return false;
    for (const x of rivals) list.splice(list.indexOf(x), 1);
  }
  list.push(b);
  if (list.length > p.maxBeliefs) {
    const weakest = [...list].sort((x, y) => x.credibility - y.credibility || x.at - y.at)[0]!;
    list.splice(list.indexOf(weakest), 1);
  }
  list.sort((x, y) => (x.about < y.about ? -1 : x.about > y.about ? 1 : x.predicate < y.predicate ? -1 : 1));
  return list.includes(b);
}

export interface Hearing {
  credibility: number;
  value: number;
  concern: number;
  impact: number;
}

export interface Listener {
  id: EntityId;
  store: FunctionStore | undefined;
  net: RelationalNetwork | undefined;
  onto: Ontology;
  P: LearningParams;
}

/** Cercanía del oyente con el tercero [M]: su pareja, su familia o, si no, el trato de su vínculo (012). */
export function closeness(view: WorldView, listener: EntityId, about: EntityId): number {
  const b = view.citizens.get(listener)?.bonds?.find((x) => x.with === about);
  if (!b) return 0;
  if (b.labels?.includes('pareja')) return 1;
  if (b.labels?.includes('familia')) return 0.8;
  return clamp01(b.familiarity ?? 0);
}

/**
 * R-003 con la 044: lo que oye `L` de `teller` sobre `about`. La credibilidad sale de la función que tiene quien
 * cuenta para el oyente y de la confianza en el tercero (una mala noticia de alguien en quien no confía se cree más),
 * como en la charla, y se degrada con la credibilidad que traía quien cuenta. El valor y la preocupación, de lo que
 * el oyente aprendió del tema y de su cercanía con el tercero.
 */
export function hear(view: WorldView, L: Listener, teller: string, about: EntityId, t: TopicDef, tellerCred: number, now: number, cp: ClaimParams): Hearing {
  const direct = (s: string) => directValue(L.store, L.onto, s, '', now, L.P);
  const source = direct(personStimulus(teller));
  const { trust } = bondOf(view, L.id, about, closeness(view, L.id, about) >= 0.8, cp);
  const sign = t.prior < 0 ? -1 : 1;
  const credibility = clamp01(cp.credBase + cp.credSource * source + sign * cp.credTrust * (trust - 0.5)) * (0.5 + 0.5 * tellerCred);
  const value = clamp1(t.prior + functionalValue(L.net, direct, t.stimulus).value);
  const concern = clamp01(Math.abs(value) * closeness(view, L.id, about));
  return { credibility: r3(credibility), value: r3(value), concern: r3(concern), impact: r3(credibility * concern) };
}

/**
 * R-008: si una creencia es verdad, para el análisis (API, informe, pruebas); ningún sistema de la persona lo lee.
 * Es verdad si el último hecho del mismo asunto sobre esa persona tiene su estado y la creencia no es una versión
 * deformada. Lo que solo llega por la charla no tiene hecho que lo haga verdad.
 */
export function beliefTruth(b: DeepReadonly<Belief>, eventsOfAbout: readonly Ev[], cat: KnowledgeCatalog): boolean {
  const t = topicOf(cat, b.predicate);
  if (!t || t.level > 0) return false;
  let state: string | undefined;
  for (const e of eventsOfAbout) {
    for (const x of topicsOf(e, cat)) if (x.about === b.about && x.topic.group === t.group) state = x.topic.state;
  }
  return state === t.state;
}
