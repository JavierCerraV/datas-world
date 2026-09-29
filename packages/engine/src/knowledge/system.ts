// Sistema de conocimiento (spec 025): al final de cada tick, con lo que emitieron todas las fases, aplica lo que se
// presenció (R-002), lo que se oyó en un encuentro (R-003, R-004, R-007) y lo que se corrigió (R-006). Así cada
// creencia cita el evento que la creó.
import { canCall, chooseIntention, intentionOptions, together } from '../conversation/intentions.ts';
import type { ClaimParams } from '../conversation/params.ts';
import type { ChatCatalog } from '../conversation/types.ts';
import { variabilityOf } from '../functions/history.ts';
import { pair } from '../functions/learn.ts';
import { sensitivityOf } from '../functions/sensitivity.ts';
import { learningParams, storeOf } from '../functions/system.ts';
import type { FunctionStore, Ontology } from '../functions/types.ts';
import { idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import { PRIVATE_DEFAULTS } from '../private/params.ts';
import { activate } from '../private/pnr.ts';
import type { MindState } from '../private/types.ts';
import { personStimulus } from '../relationships/params.ts';
import { createRng } from '../rng.ts';
import type { Patch, System, SystemEvent, SystemOutput, TickCtx, WorldView } from '../simulation/system.ts';
import type { Belief, Intention } from '../world.ts';
import { learn, topicsOf } from './beliefs.ts';
import { SEEN, topicOf } from './types.ts';
import type { KnowledgeCatalog, KnowledgeParams } from './types.ts';

export interface KnowledgeDeps {
  cat: KnowledgeCatalog;
  chat: ChatCatalog;
  onto: Ontology;
  claim: ClaimParams;
  p: KnowledgeParams;
}

interface Told { from: EntityId; to: EntityId; about: EntityId; predicate: string; credibility: number; hops: number; value: number; concern: number; distortedFrom?: string }
interface Corrected { citizenId: EntityId; about: EntityId; predicate: string; by: EntityId; credibility: number; truth: string; truthCredibility: number }

export function createKnowledgeSystem(d: KnowledgeDeps): System {
  const { cat, p, claim: cp } = d;
  return {
    id: 'knowledge', phase: 'end_of_day', order: 7, capability: 'beliefs', cadence: 'tick', minLevel: 0,
    run: (view: WorldView, ctx: TickCtx): SystemOutput => {
      const now = ctx.now;
      const active = (id: string) => view.citizens.get(id as EntityId)?.status === 'active' && !view.citizens.get(id as EntityId)?.ancestor;
      const beliefs = new Map<EntityId, Belief[]>();
      const stores = new Map<EntityId, FunctionStore>();
      const minds = new Map<EntityId, MindState>();
      const intents = new Map<EntityId, Intention[]>();
      const listOf = (id: EntityId) => beliefs.get(id) ?? beliefs.set(id, (view.citizens.get(id)?.beliefs ?? []).map((b) => JSON.parse(JSON.stringify(b)) as Belief)).get(id)!;
      const storeFor = (id: EntityId) => stores.get(id) ?? stores.set(id, storeOf(view, idNumber(id))).get(id)!;
      const events: SystemEvent[] = [];

      for (const e of ctx.events) {
        // R-002: lo presenciado, por quienes participan y por el hogar de la persona.
        for (const { topic, about } of topicsOf(e, cat)) {
          const home = view.citizens.get(about)?.householdId;
          const members = home ? view.households.get(home)?.memberIds ?? [] : [];
          const knowers = [...new Set([...e.participants.map((x) => x.id), ...members])].filter((x) => x.startsWith('CIT-') && active(x)).sort();
          for (const k of knowers) learn(listOf(k as EntityId), { about, predicate: topic.key, source: SEEN, credibility: 1, at: e.at, cause: e.id, hops: 0 }, cat, p);
        }
        if (e.type === 'RUMOR_TOLD') {
          const x = e.payload as Told;
          if (!active(x.to)) continue;
          const t = topicOf(cat, x.predicate);
          if (!t) continue;
          const kept = learn(listOf(x.to), { about: x.about, predicate: x.predicate, source: x.from, credibility: x.credibility, at: now, cause: e.id, hops: x.hops }, cat, p);
          if (x.distortedFrom)
            events.push({ type: 'RUMOR_DISTORTED', payload: { from: x.from, to: x.to, about: x.about, before: x.distortedFrom, after: x.predicate }, causes: [{ event: e.id, weight: 1 }], participants: e.participants.map((q) => ({ ...q })) });
          if (!kept) continue;
          // R-007: lo oído tiñe a la persona de la que se habla (036) y, si preocupa, mueve a actuar (044).
          const row = idNumber(x.to);
          const store = storeFor(x.to);
          pair(store, d.onto, { stim: personStimulus(x.about), ctx: '', now, lambda: x.value * t.magnitude * x.credibility, social: true }, learningParams(view.config.profile, view.config.epoch.slice(0, 10)), sensitivityOf(view, row));
          if (x.value < 0 && x.concern >= cp.intentThreshold) {
            const mind = minds.get(x.to) ?? minds.set(x.to, JSON.parse(JSON.stringify(view.citizens.get(x.to)?.mind ?? { active: [] })) as MindState).get(x.to)!;
            activate(mind, { s: t.stimulus, fn: -x.concern, from: t.key, at: now, cause: e.id }, PRIVATE_DEFAULTS);
            const r = createRng(view.config.seed).fork(`rumor:${x.to}`).fork(now);
            const impact = x.credibility * x.concern;
            const options = intentionOptions(store, d.chat, impact, x.credibility, canCall(view, x.to, d.chat, r.fork('call')), together(view, x.to, x.about), cp);
            const choice = chooseIntention(options, variabilityOf(view, row), r.fork('choice'));
            const list = intents.get(x.to) ?? intents.set(x.to, (view.citizens.get(x.to)?.intentions ?? []).map((i) => ({ ...i }))).get(x.to)!;
            const it: Intention = { kind: choice.kind, target: x.about, topic: x.predicate, urgency: Math.round(impact * 1000) / 1000, expiresAt: now + cp.intentTtlMin, cause: e.id };
            const i = list.findIndex((q) => q.target === x.about);
            if (i >= 0) list[i] = it;
            else list.push(it);
            events.push({
              type: 'INTENTION_FORMED', payload: { citizenId: x.to, kind: it.kind, target: it.target, urgency: it.urgency, expiresAt: it.expiresAt, topic: it.topic },
              causes: [{ event: e.id, weight: 1 }, ...choice.sources.slice(0, 2).map((s) => ({ state: `fuente.${s.source}:${s.ref ?? ''}`, entity: x.to, weight: 0.3 }))],
              participants: [{ id: x.to, role: 'persona' }, { id: x.about, role: 'tercero' }],
            });
          }
        }
        if (e.type === 'BELIEF_CORRECTED') {
          // R-006: la versión corregida pierde credibilidad y, si cae bajo el mínimo, se olvida; la de quien corrige entra.
          const x = e.payload as Corrected;
          if (!active(x.citizenId)) continue;
          const list = listOf(x.citizenId);
          const b = list.find((q) => q.about === x.about && q.predicate === x.predicate);
          if (b) {
            b.credibility = x.credibility;
            if (b.credibility < p.forgetMin) list.splice(list.indexOf(b), 1);
          }
          if (x.truthCredibility >= cp.beliefMin)
            learn(list, { about: x.about, predicate: x.truth, source: x.by, credibility: x.truthCredibility, at: now, cause: e.id, hops: 1 }, cat, p);
        }
      }
      const ids = [...new Set([...beliefs.keys(), ...stores.keys(), ...minds.keys(), ...intents.keys()])].sort();
      const patches: Patch[] = ids.map((id) => ({
        op: 'entity', id, owned: true,
        fields: {
          ...(beliefs.has(id) ? { beliefs: beliefs.get(id) } : {}), ...(stores.has(id) ? { functions: stores.get(id) } : {}),
          ...(minds.has(id) ? { mind: minds.get(id) } : {}), ...(intents.has(id) ? { intentions: intents.get(id) } : {}),
        },
      }));
      return { patches, events };
    },
  };
}
