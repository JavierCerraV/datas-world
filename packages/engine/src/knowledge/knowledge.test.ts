import { describe, expect, it } from 'vitest';
import { CLAIM_DEFAULTS } from '../conversation/params.ts';
import type { ChatCatalog } from '../conversation/types.ts';
import { makeEvent } from '../events.ts';
import type { CauseRef, NewEvent, WorldEvent } from '../events.ts';
import { createOntology } from '../functions/sensitivity.ts';
import { LEARNING_DEFAULTS, NEUTRAL, emptyStore } from '../functions/types.ts';
import type { FunctionStore } from '../functions/types.ts';
import type { Counters, EntityId } from '../ids.ts';
import { createRng } from '../rng.ts';
import type { Patch, TickCtx, WorldView } from '../simulation/system.ts';
import type { Belief, Bond, Citizen } from '../world.ts';
import { beliefTruth, learn, topicsOf } from './beliefs.ts';
import { createKnowledgeSystem } from './system.ts';
import { tellInEncounter } from './tell.ts';
import type { TellSide } from './tell.ts';
import { KNOWLEDGE_DEFAULTS as P, SEEN, TELL } from './types.ts';
import type { KnowledgeCatalog, TopicDef } from './types.ts';

const DAY = 1440;
const X = 'CIT-000001' as EntityId; // de quien se habla
const H = 'CIT-000002' as EntityId; // vive con X
const A = 'CIT-000003' as EntityId; // conocida de X
const B = 'CIT-000004' as EntityId; // conocido de X
const topic = (key: string, group: string, state: string, over: Partial<TopicDef> = {}): TopicDef =>
  ({ key, name: key, event: '', subjects: '', stimulus: 'verbal.despido', magnitude: 0.6, prior: -0.5, group, state, level: 0, ...over });
const CAT: KnowledgeCatalog = {
  topics: [
    topic('perdio_el_empleo', 'empleo', 'sin', { event: 'JOB_LOST', subjects: 'citizenId', escalatesTo: 'lo_echaron_por_algo' }),
    topic('lo_echaron_por_algo', 'empleo', 'sin', { level: 1, prior: -0.7 }),
    topic('consiguio_trabajo', 'empleo', 'con', { event: 'JOB_HIRED', subjects: 'citizenId', prior: 0.5 }),
    topic('debe_al_gota_a_gota', 'deuda', 'debe', { event: 'DEBT_TAKEN', subjects: 'citizenId', when: { creditor: 'gota_a_gota' } }),
    topic('pelea_con_alguien', 'conflicto', 'pelea', { event: 'ARGUMENT', subjects: 'pair' }),
    topic('infiel', 'charla_infiel', 'si'),
  ],
};
const onto = createOntology(['verbal.despido', 'verbal.trabajo'].map((key, i) => ({ key, kind: 'verbal_term' as const, features: [i, 1 - i] })));
const CHAT: ChatCatalog = { tones: [], stances: [{ key: 'abrirse', escape: 0, w0: 0.5 }, { key: 'evadir', escape: 0.6, w0: 0.4 }], claims: [], relations: [] };
const deps = { cat: CAT, onto, claim: CLAIM_DEFAULTS, p: P };
const bond = (w: EntityId, fam = 0.5, labels: Bond['labels'] = ['conocido']): Bond => ({ with: w, tension: 0, trust: 0.5, at: 0, familiarity: fam, labels: labels ?? [] });
const withResponses = (w: Record<string, number>): FunctionStore => ({ ...emptyStore(), r: Object.entries(w).map(([r, x]) => ({ r, c: '', w: x, n: 20, at: 0 })) });

/** Cuatro personas: X vive con H; A y B conocen a X y se conocen entre sí. */
function town(stores: Partial<Record<EntityId, FunctionStore>> = {}) {
  const c = { EVT: 0 } as unknown as Counters;
  const citizens = new Map<EntityId, Citizen>([
    [X, { id: X, status: 'active', householdId: 'HOU-0001', bonds: [bond(H, 0.9, ['familia']), bond(A), bond(B)], functions: stores[X] } as unknown as Citizen],
    [H, { id: H, status: 'active', householdId: 'HOU-0001', bonds: [bond(X, 0.9, ['familia']), bond(A)], functions: stores[H] } as unknown as Citizen],
    [A, { id: A, status: 'active', bonds: [bond(X), bond(B), bond(H)], functions: stores[A] } as unknown as Citizen],
    [B, { id: B, status: 'active', bonds: [bond(X), bond(A)], functions: stores[B] } as unknown as Citizen],
  ]);
  const view = {
    citizens, households: new Map([['HOU-0001', { id: 'HOU-0001', memberIds: [X, H], kinship: [] }]]), objects: new Map(), places: new Map(),
    components: { f32: {}, i32: {}, u8: {} }, config: { seed: 7, epoch: '2027-01-01T00:00', profile: undefined }, capabilities: ['beliefs'],
  } as unknown as WorldView;
  const add = (at: number, e: NewEvent) => makeEvent(c, at, e);
  const sys = createKnowledgeSystem({ ...deps, chat: CHAT });
  /** Corre el sistema y aplica sus parches de entidad a la vista. */
  const tick = (now: number, events: WorldEvent[]) => {
    const out = sys.run(view, { now, citizens: [1, 2, 3, 4], level: () => 3, events } as TickCtx, createRng(1));
    for (const p of out.patches ?? []) if (p.op === 'entity') Object.assign(citizens.get(p.id)!, (p as Extract<Patch, { op: 'entity' }>).fields);
    return out.events ?? [];
  };
  const side = (id: EntityId, stance = 'abrirse'): TellSide => ({
    id, store: JSON.parse(JSON.stringify(citizens.get(id)!.functions ?? emptyStore())) as FunctionStore,
    beliefs: JSON.parse(JSON.stringify(citizens.get(id)!.beliefs ?? [])) as Belief[], net: undefined, stance, P: LEARNING_DEFAULTS, sens: NEUTRAL,
  });
  return { view, citizens, add, tick, side };
}
const here: CauseRef = { state: 'mismo_lugar', weight: 0.3 };
const lost = (t: ReturnType<typeof town>, at = 0) => t.add(at, { type: 'JOB_LOST', payload: { citizenId: X, reason: 'cierre' }, participants: [{ id: X, role: 'persona' }], causes: [{ state: 'caja_negativa', weight: 1 }] });

describe('025 R-001, R-002: temas y saber por presenciar', () => {
  it('un hecho trae su tema (con su condición) y lo saben quien participa y su hogar, nadie más', () => {
    const t = town();
    expect(topicsOf(t.add(0, { type: 'DEBT_TAKEN', payload: { citizenId: X, creditor: 'banco', amount: 1, monthlyRate: 0.01 }, participants: [{ id: X, role: 'deudor' }], causes: [{ state: 'd', weight: 1 }] }), CAT)).toEqual([]);
    const e = lost(t);
    t.tick(0, [e]);
    for (const id of [X, H]) expect(t.citizens.get(id)!.beliefs).toEqual([{ about: X, predicate: 'perdio_el_empleo', source: SEEN, credibility: 1, at: 0, cause: e.id, hops: 0 }]);
    for (const id of [A, B]) expect(t.citizens.get(id)!.beliefs ?? []).toEqual([]);
  });

  it('una versión contraria más creíble sustituye a la vieja; una menos creíble no entra; lo visto siempre entra', () => {
    const list: Belief[] = [{ about: X, predicate: 'perdio_el_empleo', source: SEEN, credibility: 1, at: 0, cause: 'EVT-00000000001' as EntityId }];
    expect(learn(list, { about: X, predicate: 'consiguio_trabajo', source: A, credibility: 0.5, at: 1, cause: 'EVT-00000000002' as EntityId }, CAT, P)).toBe(false);
    expect(learn(list, { about: X, predicate: 'consiguio_trabajo', source: SEEN, credibility: 1, at: 2, cause: 'EVT-00000000003' as EntityId }, CAT, P)).toBe(true);
    expect(list.map((b) => b.predicate)).toEqual(['consiguio_trabajo']);
  });

  it('R-008: la verdad, solo para el análisis: lo viejo, lo deformado y lo de la charla son falsos', () => {
    const t = town();
    const e1 = lost(t);
    const e2 = t.add(10 * DAY, { type: 'JOB_HIRED', payload: { citizenId: X, orgId: 'ORG-0001', positionId: 'p', orgName: 'La Tienda' }, participants: [{ id: X, role: 'persona' }], causes: [{ state: 'vacante', weight: 1 }] });
    const b = (predicate: string): Belief => ({ about: X, predicate, source: A, credibility: 0.6, at: 0, cause: e1.id });
    expect(beliefTruth(b('perdio_el_empleo'), [e1], CAT)).toBe(true);
    expect(beliefTruth(b('perdio_el_empleo'), [e1, e2], CAT)).toBe(false); // se quedó vieja
    expect(beliefTruth(b('lo_echaron_por_algo'), [e1], CAT)).toBe(false); // deformada
    expect(beliefTruth(b('infiel'), [e1, e2], CAT)).toBe(false); // solo de la charla
  });
});

describe('025 R-003 a R-006: contar en un encuentro', () => {
  it('CA-001: lo oculta quien aprendió a evadir; su hogar lo cuenta, y una conocida se entera de oídas mientras otro sigue sin saberlo', () => {
    const t = town({ [X]: withResponses({ 'conv.evadir': 0.9, 'conv.abrirse': 0.2, [TELL]: 1 }), [H]: withResponses({ [TELL]: 1 }) });
    t.tick(0, [lost(t)]);
    // X no lo cuenta nunca, aunque se abra y cuente mucho.
    for (let i = 0; i < 20; i++) expect(tellInEncounter(t.view, t.side(X), t.side(A), here, deps, DAY, createRng(i))).toEqual([]);
    // H sí se lo cuenta a A, con credibilidad menor que la suya y una boca más.
    let told: ReturnType<typeof tellInEncounter> = [];
    for (let i = 0; i < 40 && !told.length; i++) told = tellInEncounter(t.view, t.side(H), t.side(A), here, deps, DAY, createRng(100 + i));
    expect(told[0]!.type).toBe('RUMOR_TOLD');
    const x = told[0]!.payload as { credibility: number; hops: number; about: string };
    expect(x.about).toBe(X);
    expect(x.hops).toBe(1);
    expect(x.credibility).toBeLessThan(1);
    t.tick(DAY, [makeEvent({ EVT: 50 } as unknown as Counters, DAY, told[0]!)]);
    expect(t.citizens.get(A)!.beliefs![0]).toMatchObject({ about: X, source: H, hops: 1 });
    expect(t.citizens.get(B)!.beliefs ?? []).toEqual([]); // sigue sin saberlo: para él, nada cambió
  });

  it('CA-004: a quien contar le fue bien cuenta más que a quien lo cortaban; y contar se aprende de la reacción', () => {
    const count = (w: number) => {
      const t = town({ [H]: withResponses({ [TELL]: w }) });
      t.tick(0, [lost(t)]);
      let n = 0;
      for (let i = 0; i < 200; i++) n += tellInEncounter(t.view, t.side(H), t.side(A), here, deps, DAY, createRng(i)).length;
      return n;
    };
    expect(count(0.9)).toBeGreaterThan(count(0.1));
    const t = town({ [H]: withResponses({ [TELL]: 0.5 }) });
    t.tick(0, [lost(t)]);
    const learnFrom = (stance: string) => {
      for (let i = 0; i < 200; i++) {
        const h = t.side(H);
        if (tellInEncounter(t.view, h, t.side(A, stance), here, deps, DAY, createRng(i)).length) return h.store.r.find((r) => r.r === TELL)!.w;
      }
      return NaN;
    };
    expect(learnFrom('abrirse')).toBeGreaterThan(0.5);
    expect(learnFrom('poner_limite')).toBeLessThan(0.5);
  });

  it('R-006: quien lo sabe mejor corrige antes de contar otra cosa; no se repite lo ya contado', () => {
    const t = town();
    t.tick(0, [lost(t)]);
    const a = t.citizens.get(A)!;
    a.beliefs = [{ about: X, predicate: 'lo_echaron_por_algo', source: B, credibility: 0.4, at: 0, cause: 'EVT-00000000001' as EntityId, hops: 2 }];
    const h = t.side(H);
    const out = tellInEncounter(t.view, h, t.side(A), here, deps, DAY, createRng(1));
    expect(out.map((e) => e.type)).toEqual(['BELIEF_CORRECTED']);
    expect(out[0]!.payload).toMatchObject({ citizenId: A, predicate: 'lo_echaron_por_algo', truth: 'perdio_el_empleo', by: H });
    expect(h.beliefs[0]!.told).toEqual([A]);
  });

  it('CA-003: lo que cuenta y cómo se oye no cambian si cambia la verdad del tercero pero no lo que se cree', () => {
    const t = town({ [H]: withResponses({ [TELL]: 1 }) });
    t.tick(0, [lost(t)]);
    const run = () => JSON.stringify(Array.from({ length: 20 }, (_, i) => tellInEncounter(t.view, t.side(H), t.side(A), here, deps, DAY, createRng(i))));
    const before = run();
    Object.assign(t.citizens.get(X)!, { occupation: { kind: 'formal', orgId: 'ORG-0002', positionId: 'p' }, status: 'active' });
    expect(run()).toBe(before);
  });
});
