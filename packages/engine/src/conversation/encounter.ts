// Consecuencias en el bucle (spec 044 R-006 a R-009): las intenciones tras la charla se ejecutan o caducan, el
// encuentro lo decide la historia de cada uno y el vínculo se tensa. Tres sistemas en fases sucesivas del mismo
// tick para que cada evento cite al anterior (llamada → confrontación → vínculo, 014): el siguiente lo encuentra en
// `ctx.events`. No se programan desenlaces (R-009): el estrés y la tensión actúan después por las reglas que ya hay.
import { CHAT_UNTIL } from './inputs.ts';
import { pickIndex, softmax, strengthContribution, temperatureOf } from '../decision/select.ts';
import type { WorldEvent } from '../events.ts';
import { variabilityOf } from '../functions/history.ts';
import { storeOf } from '../functions/system.ts';
import { formatId, idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import type { Rng } from '../rng.ts';
import type { Patch, System, SystemEvent, SystemOutput, TickCtx, WorldView } from '../simulation/system.ts';
import type { Belief, Bond, Intention } from '../world.ts';
import { areFamily } from './claims.ts';
import { awake, placeOf, together } from './intentions.ts';
import type { ClaimParams } from './params.ts';
import { stanceStrength } from './tone.ts';
import type { ChatCatalog } from './types.ts';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round = (x: number) => Math.round(x * 1000) / 1000;
const DAY = 1440;

/** Respuestas del tercero en el encuentro (R-008.2), en orden de clave. */
export const RESPONSES = Object.freeze(['callar', 'contraatacar', 'explicar', 'negar'] as const);
export type EncounterResponse = (typeof RESPONSES)[number];

/** R-008.3 [M] (PA-140): cuánto tensa cada combinación, en [0,1]. */
export const SEVERITY: Readonly<Record<'acusar' | 'preguntar', Readonly<Record<EncounterResponse, number>>>> = Object.freeze({
  acusar: Object.freeze({ callar: 0.7, contraatacar: 1, explicar: 0.4, negar: 0.6 }),
  preguntar: Object.freeze({ callar: 0.4, contraatacar: 0.6, explicar: 0.1, negar: 0.3 }),
});

/** R-007: tensión vigente, con el decaimiento diario desde el último cambio (sin trabajo diario). */
export const tensionNow = (b: Bond, now: number, p: ClaimParams): number => clamp01(b.tension - p.tensionDecayDay * Math.max(0, now - b.at) / DAY);

const inChat = (view: WorldView, id: EntityId, now: number) => (view.components.i32[CHAT_UNTIL]?.[idNumber(id)] ?? 0) > now;
const activeCitizen = (view: WorldView, id: EntityId) => view.citizens.get(id)?.status === 'active';

/** Fase `actions`: caducan las intenciones viejas y se hacen las llamadas (rumiar lo lleva la 039). */
export function createCallSystem(_p: ClaimParams): System {
  return {
    id: 'intentions', phase: 'actions', order: 90, capability: 'learning', cadence: 'tick', minLevel: 0,
    run: (view: WorldView, ctx: TickCtx): SystemOutput => {
      const patches: Patch[] = [];
      const events: SystemEvent[] = [];
      for (const row of ctx.citizens) {
        const id = formatId('CIT', row) as EntityId;
        const list = view.citizens.get(id)?.intentions;
        if (!list?.length) continue;
        const keep: Intention[] = [];
        for (const it of list) {
          const who = [{ id, role: 'persona' }, { id: it.target, role: 'tercero' }];
          if (ctx.now >= it.expiresAt || !activeCitizen(view, it.target)) {
            events.push({ type: 'INTENTION_EXPIRED', payload: { citizenId: id, kind: it.kind, target: it.target }, causes: [{ event: it.cause, weight: 1 }], participants: who });
            continue;
          }
          if (it.kind === 'llamar' && awake(view, id) && awake(view, it.target) && !inChat(view, it.target, ctx.now)) {
            events.push({ type: 'PHONE_CALL_MADE', payload: { from: id, to: it.target, reason: it.topic, urgency: it.urgency }, causes: [{ event: it.cause, weight: 1 }], participants: who });
            continue;
          }
          // Rumiar no hace nada aquí: la creencia ya está en su mente y el PNR lo lleva la 039 (decisión 5).
          keep.push({ ...it });
        }
        if (keep.length !== list.length) patches.push({ op: 'entity', id, fields: { intentions: keep } });
      }
      return { patches, events };
    },
  };
}

/** R-008.2: la respuesta del tercero según su historia en las charlas; como nunca dijo eso, negar parte fuerte. */
export function respond(view: WorldView, b: EntityId, cat: ChatCatalog, how: 'acusar' | 'preguntar', p: ClaimParams, rng: Rng): EncounterResponse {
  const store = storeOf(view, idNumber(b));
  const w = (k: string) => {
    const st = cat.stances.find((x) => x.key === k);
    return st ? stanceStrength(store, st) : 0;
  };
  const accused = how === 'acusar' ? 0.3 : 0;
  const values: Record<EncounterResponse, number> = {
    callar: strengthContribution(Math.max(w('callar'), w('evadir'))),
    contraatacar: strengthContribution(w('contraatacar')) + accused,
    explicar: strengthContribution(w('abrirse')) + (how === 'preguntar' ? 0.5 : 0),
    negar: strengthContribution(p.denyStrength) + accused,
  };
  const ps = softmax(RESPONSES.map((r) => values[r]), temperatureOf(variabilityOf(view, idNumber(b))));
  return RESPONSES[pickIndex(ps, rng.next())]!;
}

/** Fase `interactions`: la llamada de este tick, o coincidir en el mismo lugar, produce el encuentro (R-008.1). */
export function createEncounterSystem(cat: ChatCatalog, p: ClaimParams): System {
  return {
    id: 'encounters', phase: 'interactions', order: 90, capability: 'learning', cadence: 'tick', minLevel: 0,
    run: (view: WorldView, ctx: TickCtx, rng: Rng): SystemOutput => {
      const patches: Patch[] = [];
      const events: SystemEvent[] = [];
      const meet = (a: EntityId, b: EntityId, topic: string, urgency: number, how: 'acusar' | 'preguntar', via: 'llamada' | 'en_persona', cause: EntityId) => {
        const responseB = respond(view, b, cat, how, p, rng.fork(`${a}/${b}`));
        const place = via === 'en_persona' ? placeOf(view, a) : 0;
        events.push({
          type: 'CONFRONTATION',
          payload: { a, b, topic, via, responseA: how, responseB, impact: round(urgency) },
          causes: [{ event: cause, weight: 1 }, ...(place ? [{ state: 'mismo_lugar', entity: formatId('PLC', place) as EntityId, weight: 0.3 }] : [])],
          participants: [{ id: a, role: 'reclama' }, { id: b, role: 'responde' }],
          ...(place ? { placeId: formatId('PLC', place) as EntityId } : {}),
        });
      };
      for (const e of ctx.events) {
        if (e.type !== 'PHONE_CALL_MADE') continue;
        const x = e.payload as { from: EntityId; to: EntityId; reason: string; urgency: number };
        meet(x.from, x.to, x.reason, x.urgency, 'acusar', 'llamada', e.id);
      }
      for (const row of ctx.citizens) {
        const id = formatId('CIT', row) as EntityId;
        const list = view.citizens.get(id)?.intentions;
        if (!list?.some((it) => it.kind === 'confrontar' || it.kind === 'preguntar')) continue;
        const keep: Intention[] = [];
        for (const it of list) {
          const ready = (it.kind === 'confrontar' || it.kind === 'preguntar') && together(view, id, it.target) && awake(view, id) && awake(view, it.target)
            && !inChat(view, id, ctx.now) && !inChat(view, it.target, ctx.now);
          if (ready) meet(id, it.target, it.topic, it.urgency, it.kind === 'preguntar' ? 'preguntar' : 'acusar', 'en_persona', it.cause);
          else keep.push({ ...it });
        }
        if (keep.length !== list.length) patches.push({ op: 'entity', id, fields: { intentions: keep } });
      }
      return { patches, events };
    },
  };
}

/** Fase `information`: lo que deja cada encuentro en los dos (R-008.3, R-008.4) y `BOND_STRAINED`. */
export function createBondSystem(p: ClaimParams): System {
  return {
    id: 'bonds', phase: 'information', order: 90, capability: 'learning', cadence: 'tick', minLevel: 0,
    run: (view: WorldView, ctx: TickCtx): SystemOutput => {
      const found = ctx.events.filter((e) => e.type === 'CONFRONTATION');
      if (found.length === 0) return {};
      const bonds = new Map<EntityId, Bond[]>();
      const beliefs = new Map<EntityId, Belief[]>();
      const stress = new Map<number, number>();
      // Copia profunda: los vínculos de la 012 tienen listas (etiquetas, eventos).
      const bondsOf = (id: EntityId) => bonds.get(id) ?? bonds.set(id, JSON.parse(JSON.stringify(view.citizens.get(id)?.bonds ?? [])) as Bond[]).get(id)!;
      const beliefsOf = (id: EntityId) => beliefs.get(id) ?? beliefs.set(id, (view.citizens.get(id)?.beliefs ?? []).map((x) => ({ ...x }))).get(id)!;
      const events: SystemEvent[] = [];
      for (const e of found as WorldEvent<{ a: EntityId; b: EntityId; topic: string; responseA: 'acusar' | 'preguntar'; responseB: EncounterResponse; impact: number }>[]) {
        const { a, b, topic, responseA, responseB, impact } = e.payload;
        const bond = (x: EntityId, y: EntityId): Bond => {
          const list = bondsOf(x);
          let found = list.find((z) => z.with === y);
          if (!found) {
            found = { with: y, tension: 0, trust: areFamily(view, x, y) ? p.trust0Family : p.trust0Other, at: ctx.now };
            list.push(found);
            list.sort((u, v) => (u.with < v.with ? -1 : 1));
          }
          return found;
        };
        const ab = bond(a, b);
        const ba = bond(b, a);
        const tension0 = Math.max(tensionNow(ab, ctx.now, p), tensionNow(ba, ctx.now, p));
        const delta = p.maxTensionDelta * SEVERITY[responseA][responseB] * (0.5 + 0.5 * impact);
        const before = { t: tension0, ab: ab.trust, ba: ba.trust };
        Object.assign(ab, { tension: clamp01(tension0 + delta), trust: clamp01(ab.trust - 0.5 * delta), at: ctx.now });
        Object.assign(ba, { tension: clamp01(tension0 + delta), trust: clamp01(ba.trust - (responseA === 'acusar' ? 0.5 : 0.2) * delta), at: ctx.now });
        for (const id of [a, b]) {
          const row = idNumber(id);
          stress.set(row, clamp01((stress.get(row) ?? view.components.f32['state.stress']?.[row] ?? 0) + 0.5 * delta));
        }
        // Una negación o una explicación hace dudar de lo oído, más cuanto más confía en el otro.
        const heard = beliefsOf(a).find((x) => x.about === b && x.predicate === topic);
        if (heard && (responseB === 'negar' || responseB === 'explicar')) heard.credibility = round(heard.credibility * (1 - p.denialDoubt * ab.trust));
        // R-008.4: el tercero aprende que alguien anda diciendo cosas de él (P4).
        if (heard?.source.startsWith('EXT-')) {
          const rumor = beliefsOf(b);
          const i = rumor.findIndex((x) => x.about === heard.source && x.predicate === 'anda_diciendo_cosas');
          const next: Belief = { about: heard.source, predicate: 'anda_diciendo_cosas', source: a, credibility: p.rumorCredibility, at: ctx.now, cause: e.id };
          if (i >= 0) rumor[i] = next;
          else rumor.push(next);
        }
        events.push({
          type: 'BOND_STRAINED',
          payload: {
            a, b, tensionBefore: round(before.t), tensionAfter: round(ab.tension), trustBefore: round(before.ab), trustAfter: round(ab.trust),
            trustOfBBefore: round(before.ba), trustOfBAfter: round(ba.trust),
          },
          causes: [{ event: e.id, weight: 1 }],
          participants: [{ id: a, role: 'persona' }, { id: b, role: 'persona' }],
        });
      }
      const ids = [...new Set([...bonds.keys(), ...beliefs.keys()])].sort();
      const patches: Patch[] = ids.map((id) => ({
        op: 'entity', id, fields: { ...(bonds.has(id) ? { bonds: bonds.get(id) } : {}), ...(beliefs.has(id) ? { beliefs: beliefs.get(id) } : {}) },
      }));
      for (const [row, value] of [...stress.entries()].sort((x, y) => x[0] - y[0])) patches.push({ op: 'set', type: 'f32', column: 'state.stress', row, value });
      return { patches, events };
    },
  };
}

/** Los tres sistemas de las consecuencias de la charla, para registrarlos con la vida diaria. */
export const consequenceSystems = (cat: ChatCatalog, p: ClaimParams): System[] => [createCallSystem(p), createEncounterSystem(cat, p), createBondSystem(p)];
