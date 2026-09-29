// Sistema de memoria (spec 013): al final de cada tick codifica lo que pasó (con lo que emitieron todas las fases,
// incluida la rumiación de la 039) y repasa lo que se volvió a pensar o a encontrar; al cambiar de día, olvida,
// consolida en la red (capacidad `consolidation`) y rehace los capítulos. Un solo sistema, para que los parches de
// la memoria no se pisen dentro de la misma fase.
import { learningParams } from '../functions/system.ts';
import { directValue } from '../functions/learn.ts';
import type { FunctionStore, Ontology } from '../functions/types.ts';
import { formatId } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import type { RelationalNetwork } from '../relations/types.ts';
import { personStimulus } from '../relationships/params.ts';
import type { Patch, System, SystemEvent, SystemOutput, TickCtx, WorldView } from '../simulation/system.ts';
import { consolidate, openChapter, updateChapters } from './consolidate.ts';
import { decayDay, encodeEvent, rehearse, remembererOf, trim } from './episodes.ts';
import type { FnOf } from './episodes.ts';
import { MEMORY_KINDS } from './kinds.ts';
import { MEMORY_DEFAULTS, emptyMemory } from './types.ts';
import type { MemoryParams, MemoryStore } from './types.ts';

const DAY = 1440;
/** Repasos como mucho por episodio de rumiación (039). */
const MAX_PNR_REHEARSALS = 5;

export function createMemorySystem(onto: Ontology, p: MemoryParams = MEMORY_DEFAULTS): System {
  return {
    id: 'memory', phase: 'end_of_day', order: 10, capability: 'memory', cadence: 'tick', minLevel: 0,
    run: (view: WorldView, ctx: TickCtx): SystemOutput => {
      const now = ctx.now;
      const P = learningParams(view.config.profile, view.config.epoch.slice(0, 10));
      const active = new Set(ctx.citizens.map((r) => formatId('CIT', r) as EntityId));
      const stores = new Map<EntityId, MemoryStore>();
      const nets = new Map<EntityId, RelationalNetwork>();
      const fns = new Map<EntityId, FnOf>();
      const events: SystemEvent[] = [];
      const storeOf = (id: EntityId) =>
        stores.get(id) ?? stores.set(id, JSON.parse(JSON.stringify(view.citizens.get(id)?.memory ?? emptyMemory())) as MemoryStore).get(id)!;
      const fnOf = (id: EntityId): FnOf => {
        const hit = fns.get(id);
        if (hit) return hit;
        const own = view.citizens.get(id)?.functions as FunctionStore | undefined;
        const f: FnOf = (s) => directValue(own, onto, s, '', now, P);
        fns.set(id, f);
        return f;
      };
      const who = (id: EntityId) => [{ id, role: 'persona' }];

      // R-001, R-010: lo que pasó en este tick.
      for (const e of ctx.events) {
        const kind = MEMORY_KINDS[e.type];
        if (!kind) continue;
        for (const id of remembererOf(e, view)) {
          if (!active.has(id)) continue;
          const store = storeOf(id);
          const m = encodeEvent(store, e, id, view, fnOf(id), p);
          if (!m || !kind.theme || m.intensity < p.chapterOpen) continue;
          const { closed, opened } = openChapter(store, kind.theme, now, m.valence, e.id, m);
          if (closed) events.push({ type: 'CHAPTER_CLOSED', payload: { citizenId: id, theme: closed.theme, tone: closed.tone }, causes: [{ event: e.id, weight: 1 }], participants: who(id) });
          events.push({ type: 'CHAPTER_OPENED', payload: { citizenId: id, theme: opened.theme, tone: opened.tone }, causes: [{ event: e.id, weight: 1 }], participants: who(id) });
        }
      }
      // R-008: la rumiación (039) repasa lo que contiene su foco; el pensamiento derivado, lo que contiene su destino.
      for (const e of ctx.events) {
        if (e.type !== 'PNR_EPISODE' && e.type !== 'THOUGHT_DERIVED') continue;
        const x = e.payload as { citizenId: EntityId; trigger?: string; to?: string; steps?: number };
        if (!active.has(x.citizenId) || !view.citizens.get(x.citizenId)?.memory) continue;
        const stim = e.type === 'PNR_EPISODE' ? x.trigger! : x.to!;
        const times = e.type === 'PNR_EPISODE' ? Math.min(MAX_PNR_REHEARSALS, x.steps ?? 1) : 1;
        for (const m of storeOf(x.citizenId).episodes) if (m.stims.includes(stim)) for (let i = 0; i < times; i++) rehearse(m, fnOf(x.citizenId), p);
      }
      // R-008: un encuentro (012) repasa el recuerdo más intenso con esa persona.
      for (const row of ctx.citizens) {
        const id = formatId('CIT', row) as EntityId;
        const c = view.citizens.get(id);
        if (!c?.memory?.episodes.length || !c.bonds) continue;
        for (const b of c.bonds) {
          if (b.lastEncounter !== now) continue;
          const stim = personStimulus(b.with);
          const best = storeOf(id).episodes.filter((m) => m.stims.includes(stim)).sort((a, b2) => b2.intensity - a.intensity)[0];
          if (best) rehearse(best, fnOf(id), p);
        }
      }
      // Cambio de día: olvido, consolidación y capítulos.
      if (now % DAY === 0) {
        const consolidating = view.capabilities.includes('consolidation');
        for (const row of ctx.citizens) {
          const id = formatId('CIT', row) as EntityId;
          if (!view.citizens.get(id)?.memory) continue;
          const store = storeOf(id);
          for (const m of store.episodes) decayDay(m, now, p);
          if (consolidating) {
            const net = nets.get(id) ?? nets.set(id, JSON.parse(JSON.stringify(view.citizens.get(id)?.network ?? { e: [], pruned: 0 })) as RelationalNetwork).get(id)!;
            for (const ch of consolidate(store, net, now, p)) {
              const causes = ch.events.length ? ch.events.map((x) => ({ event: x, weight: 1 })) : [{ state: 'episodios', entity: id, weight: 1 }];
              events.push(ch.created
                ? { type: 'SCHEMA_FORMED', payload: { citizenId: id, a: ch.a, b: ch.b, strength: ch.after }, causes, participants: who(id) }
                : { type: 'SCHEMA_REVISED', payload: { citizenId: id, a: ch.a, b: ch.b, before: ch.before, after: ch.after }, causes, participants: who(id) });
            }
          }
          updateChapters(store, p);
        }
      }
      for (const store of stores.values()) trim(store, now, p);
      const patches: Patch[] = [];
      for (const id of [...new Set([...stores.keys(), ...nets.keys()])].sort()) {
        patches.push({ op: 'entity', id, owned: true, fields: { ...(stores.has(id) ? { memory: stores.get(id) } : {}), ...(nets.has(id) ? { network: nets.get(id) } : {}) } });
      }
      return { patches, events };
    },
  };
}
