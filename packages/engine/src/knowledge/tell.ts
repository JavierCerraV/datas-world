// Contar en un encuentro (spec 025 R-003 a R-006): quien se abre corrige al otro si cree una versión distinta de algo
// que él sabe mejor, o le cuenta algo de un tercero que el otro conoce, salvo lo propio que oculta. Contar es una
// respuesta aprendida: se refuerza si el otro se interesa. El oyente no cambia aquí: lo aplica el sistema de
// conocimiento al final del tick, con el evento como causa.
import { bondOf } from '../conversation/claims.ts';
import type { ClaimParams } from '../conversation/params.ts';
import type { CauseRef } from '../events.ts';
import { operant } from '../functions/learn.ts';
import type { FunctionStore, LearningParams, Ontology, Sensitivity } from '../functions/types.ts';
import type { EntityId } from '../ids.ts';
import type { RelationalNetwork } from '../relations/types.ts';
import type { Rng } from '../rng.ts';
import type { SystemEvent, WorldView } from '../simulation/system.ts';
import type { Belief } from '../world.ts';
import { hear, r3 } from './beliefs.ts';
import { TELL, topicOf } from './types.ts';
import type { KnowledgeCatalog, KnowledgeParams } from './types.ts';

export interface TellSide {
  id: EntityId;
  /** Copias de trabajo (el encuentro las parchea). */
  store: FunctionStore;
  beliefs: Belief[];
  net: RelationalNetwork | undefined;
  /** Postura que eligió en este encuentro (012 R-002). */
  stance: string;
  P: LearningParams;
  sens: Sensitivity;
}

export interface TellDeps {
  cat: KnowledgeCatalog;
  onto: Ontology;
  claim: ClaimParams;
  p: KnowledgeParams;
}

/** [M] Cómo le fue al contar, según la postura con que el otro respondió. */
const OUTCOME: Readonly<Record<string, number>> = { abrirse: 1, aplacar: 0.9, responder_breve: 0.6, evadir: 0.3, callar: 0.1, poner_limite: 0, terminar: 0, contraatacar: 0 };

const strength = (store: FunctionStore, r: string, w0: number) => store.r.find((x) => x.r === r && x.c === '')?.w ?? w0;

/** Recuerda a quién se lo contó (los últimos). */
function markTold(b: Belief, to: EntityId, p: KnowledgeParams): void {
  b.told = [...(b.told ?? []).filter((x) => x !== to), to].slice(-p.toldMemory);
}

/** Refuerza o castiga contar según cómo respondió el otro (036 R-002). */
function reinforce(t: TellSide, listenerStance: string, now: number, p: KnowledgeParams): void {
  if (!t.store.r.some((x) => x.r === TELL && x.c === '')) t.store.r.push({ r: TELL, c: '', w: p.tellW0, n: 0, at: now });
  operant(t.store, TELL, '', OUTCOME[listenerStance] ?? 0.5, now, t.P, t.sens);
}

/**
 * Lo que `teller` le dice a `listener` en un encuentro en que se abrió. Devuelve los eventos (`BELIEF_CORRECTED` o
 * `RUMOR_TOLD`); modifica las copias de quien cuenta (a quién lo contó, fuerza de contar).
 */
export function tellInEncounter(view: WorldView, teller: TellSide, listener: TellSide, here: CauseRef, d: TellDeps, now: number, rng: Rng): SystemEvent[] {
  if (teller.stance !== 'abrirse') return [];
  const { cat, p } = d;
  const who = [{ id: teller.id, role: 'cuenta' }, { id: listener.id, role: 'oye' }];
  const mine = teller.beliefs.filter((b) => b.about.startsWith('CIT-') && b.credibility >= p.tellMin && topicOf(cat, b.predicate));

  // R-006: corrige primero lo que el otro cree de otra forma, si lo sabe mejor.
  for (const b of mine) {
    const t = topicOf(cat, b.predicate)!;
    const wrong = listener.beliefs.find((x) => {
      const u = topicOf(cat, x.predicate);
      return x.about === b.about && u?.group === t.group && (u.state !== t.state || u.level > t.level) && b.credibility > x.credibility;
    });
    if (!wrong || b.told?.includes(listener.id)) continue;
    const trust = bondOf(view, listener.id, teller.id, false, d.claim).trust;
    markTold(b, listener.id, p);
    reinforce(teller, listener.stance, now, p);
    return [{
      type: 'BELIEF_CORRECTED',
      payload: { citizenId: listener.id, about: b.about, predicate: wrong.predicate, by: teller.id, credibility: r3(wrong.credibility * (1 - trust)), truth: b.predicate, truthCredibility: r3(trust * b.credibility) },
      causes: [{ event: b.cause, weight: 1 }, here],
      participants: who,
    }];
  }

  // R-003: cuenta, con la probabilidad de su fuerza de contar.
  if (rng.next() >= p.pTell * strength(teller.store, TELL, p.tellW0)) return [];
  const knows = new Set((view.citizens.get(listener.id)?.bonds ?? []).map((x) => x.with as string));
  // R-005: lo propio que le duele no lo cuenta quien aprendió más a evadir que a abrirse.
  const hides = strength(teller.store, 'conv.evadir', 0.4) > strength(teller.store, 'conv.abrirse', 0.5);
  const candidates = mine.filter((b) => {
    if (b.about === listener.id || b.told?.includes(listener.id)) return false;
    const t = topicOf(cat, b.predicate)!;
    if (b.about === teller.id) return !(t.prior < 0 && hides);
    return knows.has(b.about);
  });
  if (!candidates.length) return [];
  const b = [...candidates].sort((x, y) => Math.abs(topicOf(cat, y.predicate)!.prior) * y.credibility - Math.abs(topicOf(cat, x.predicate)!.prior) * x.credibility
    || (x.about < y.about ? -1 : x.about > y.about ? 1 : x.predicate < y.predicate ? -1 : 1))[0]!;
  // R-004: a veces se cuenta una versión peor.
  const base = topicOf(cat, b.predicate)!;
  // Nadie cuenta de sí mismo una versión peor de lo que le pasó (revisión de cierre de M3).
  const distorted = base.escalatesTo && b.about !== teller.id && rng.next() < p.distort ? topicOf(cat, base.escalatesTo) : undefined;
  const t = distorted ?? base;
  markTold(b, listener.id, p);
  reinforce(teller, listener.stance, now, p);
  const h = hear(view, { id: listener.id, store: listener.store, net: listener.net, onto: d.onto, P: listener.P }, teller.id, b.about as EntityId, t, b.credibility, now, d.claim);
  if (h.credibility < d.claim.beliefMin) return [];
  return [{
    type: 'RUMOR_TOLD',
    payload: {
      from: teller.id, to: listener.id, about: b.about, predicate: t.key, credibility: h.credibility, hops: (b.hops ?? 0) + 1,
      value: h.value, concern: h.concern, ...(distorted ? { distortedFrom: base.key } : {}),
    },
    causes: [{ event: b.cause, weight: 1 }, here],
    // El tercero no participa: no se entera de que hablan de él (025 INV-003); va solo en el payload.
    participants: who,
  }];
}
