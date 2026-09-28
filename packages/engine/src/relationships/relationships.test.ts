import { describe, expect, it } from 'vitest';
import { CHAT_DEFAULTS, CLAIM_DEFAULTS } from '../conversation/params.ts';
import type { PersonCtx } from '../conversation/stance.ts';
import type { ChatCatalog } from '../conversation/types.ts';
import { createOntology } from '../functions/sensitivity.ts';
import { LEARNING_DEFAULTS, NEUTRAL, emptyStore } from '../functions/types.ts';
import type { FunctionStore } from '../functions/types.ts';
import type { EntityId } from '../ids.ts';
import { createRng } from '../rng.ts';
import type { Patch, TickCtx, WorldView } from '../simulation/system.ts';
import type { Bond, BondLabel, Citizen } from '../world.ts';
import { attachmentOf } from './attachment.ts';
import { affectionFor, bondWith, decayDay, forgettable, relabel, touch } from './bonds.ts';
import { createBondDailySystem, createBondLedgerSystem } from './daily.ts';
import { exchange } from './exchange.ts';
import type { Side } from './exchange.ts';
import { RELATIONSHIP_DEFAULTS as P, personStimulus } from './params.ts';

const DAY = 1440;
// Réplica mínima de los catálogos de la charla: los tonos que devuelven las posturas y las 8 posturas.
const CAT: ChatCatalog = {
  tones: [
    { key: 'neutro', stimulus: 'verbal.neutro', magnitude: 0.2, prior: 0 }, { key: 'amable', stimulus: 'verbal.aprobacion', magnitude: 0.5, prior: 0.5 },
    { key: 'desagradable', stimulus: 'verbal.critica', magnitude: 0.5, prior: -0.4 }, { key: 'grosero', stimulus: 'verbal.insulto', magnitude: 0.8, prior: -0.6 },
  ],
  stances: [
    { key: 'abrirse', escape: 0, w0: 0.5 }, { key: 'aplacar', escape: 0.3, w0: 0.4 }, { key: 'callar', escape: 0.5, w0: 0.3 },
    { key: 'contraatacar', escape: 0.4, w0: 0.25 }, { key: 'evadir', escape: 0.6, w0: 0.4 }, { key: 'poner_limite', escape: 0.5, w0: 0.35 },
    { key: 'responder_breve', escape: 0.2, w0: 0.6 }, { key: 'terminar', escape: 1, w0: 0.2 },
  ],
  claims: [],
  relations: [],
};
const onto = createOntology(['verbal.neutro', 'verbal.aprobacion', 'verbal.critica', 'verbal.insulto'].map((key, i) => ({
  key, kind: 'verbal_term' as const, features: [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0, i === 3 ? 1 : 0],
})));
const pc = (): PersonCtx => ({ onto, P: LEARNING_DEFAULTS, sens: NEUTRAL, rules: [], variability: 0.2 });
/** Un almacén con la historia de posturas dada (041): fuerza de cada `conv.<postura>`. */
const history = (w: Record<string, number>): FunctionStore => ({ ...emptyStore(), r: Object.entries(w).map(([k, x]) => ({ r: `conv.${k}`, c: '', w: x, n: 50, at: 0 })) });
const side = (id: string, store: FunctionStore): Side => ({ id, store, pc: pc(), live: { energy: 0.8, stress: 0.2 }, tension: 0 });
const OPENS = { abrirse: 0.95, callar: 0.05, evadir: 0.05, responder_breve: 0.2 };
const SILENT = { abrirse: 0.05, callar: 0.95, evadir: 0.9, responder_breve: 0.2 };

describe('012 vínculos: familiaridad, etiquetas y olvido (R-003, R-004, R-008)', () => {
  it('la familiaridad sube con cada encuentro hacia 1 y baja sin contacto', () => {
    const list: Bond[] = [];
    const { bond, created } = bondWith(list, 'CIT-000002' as EntityId, 0, 0.5);
    expect(created).toBe(true);
    for (let i = 0; i < 10; i++) touch(bond, i, P);
    expect(bond.familiarity).toBeCloseTo(1 - (1 - P.familiarityGain) ** 10, 6);
    expect(bond.encounters).toBe(10);
    const f = bond.familiarity!;
    decayDay(bond, 10 + 2 * DAY, P);
    expect(bond.familiarity).toBeCloseTo(f - P.familiarityDecayDay, 6);
    expect(bondWith(list, 'CIT-000002' as EntityId, 0, 0.5).created).toBe(false);
  });

  it('amistad con histéresis; la familia no pasa a amistad; compañero si comparten organización', () => {
    const b: Bond = { with: 'CIT-000002' as EntityId, tension: 0, trust: 0.5, at: 0, familiarity: P.friendFam, labels: [] };
    expect(relabel(b, P.friendFn, true, P).becameFriend).toBe(true);
    expect(b.labels).toEqual(['amigo', 'companero', 'conocido']);
    // Entre el umbral de salida y el de entrada se conserva.
    expect(relabel(b, (P.friendFn + P.friendFnOut) / 2, false, P).becameFriend).toBe(false);
    expect(b.labels).toEqual(['amigo', 'conocido']);
    relabel(b, P.friendFnOut - 0.01, false, P);
    expect(b.labels).toEqual(['conocido']);
    const kin: Bond = { with: 'CIT-000003' as EntityId, tension: 0, trust: 0.6, at: 0, familiarity: 0.9, labels: ['familia'] };
    expect(relabel(kin, 0.9, false, P).becameFriend).toBe(false);
  });

  it('solo se olvida a los conocidos sin tensión viva', () => {
    const b = (labels: BondLabel[]): Bond => ({ with: 'CIT-000002' as EntityId, tension: 0, trust: 0.5, at: 0, familiarity: 0.01, labels });
    expect(forgettable(b(['conocido']), 0, P)).toBe(true);
    expect(forgettable(b(['conocido']), 0.3, P)).toBe(false);
    for (const l of ['familia', 'pareja', 'amigo', 'ex'] as const) expect(forgettable(b([l]), 0, P)).toBe(false);
  });
});

describe('012 R-002: el intercambio', () => {
  it('CA-001: la misma escena deja vínculos distintos en cada lado (asimetría)', () => {
    const a = side('CIT-000001', history(SILENT));
    const b = side('CIT-000002', history(OPENS));
    const rng = createRng(12);
    for (let i = 0; i < 40; i++) exchange(a, b, CAT, CHAT_DEFAULTS, P, i * 60, rng.fork(i));
    const ab = affectionFor(a.store, 'CIT-000002');
    const ba = affectionFor(b.store, 'CIT-000001');
    // A recibe a alguien que se abre y le toma afecto; B recibe silencios y evasivas.
    expect(ab).toBeGreaterThanOrEqual(0.2);
    expect(ba).toBeLessThan(0.1);
    expect(ab - ba).toBeGreaterThan(0.15);
  });

  it('sin trato aversivo, tensión ni afecto negativo, nadie contraataca ni pone límites', () => {
    const rng = createRng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const ex = exchange(side('CIT-000001', history({ contraatacar: 0.9, abrirse: 0.9 })), side('CIT-000002', emptyStore()), CAT, CHAT_DEFAULTS, P, 0, rng.fork(i));
      seen.add(ex.stanceA);
    }
    expect(seen.has('contraatacar')).toBe(false);
    expect(seen.has('poner_limite')).toBe(false);
  });

  it('CA-004: quien reforzó abrirse deja más afecto en los demás que quien reforzó callar o evadir', () => {
    const run = (w: Record<string, number>) => {
      const me = side('CIT-000001', history(w));
      const others = [2, 3, 4, 5, 6, 7].map((k) => side(`CIT-00000${k}`, emptyStore()));
      const rng = createRng(4);
      for (let i = 0; i < 30; i++) for (const [k, o] of others.entries()) exchange(o, me, CAT, CHAT_DEFAULTS, P, i * DAY, rng.fork(`${i}/${k}`));
      return others.filter((o) => affectionFor(o.store, me.id) >= P.friendFn).length;
    };
    const open = run(OPENS);
    const silent = run(SILENT);
    expect(open).toBeGreaterThan(silent);
    expect(open).toBeGreaterThanOrEqual(4);
  });

  it('acercarse se refuerza cuando le va bien y se debilita cuando no', () => {
    const rng = createRng(9);
    const w = (x: Side) => x.store.r.find((r) => r.r === 'social.acercarse')!.w;
    const warm = side('CIT-000001', emptyStore());
    const cold = side('CIT-000003', emptyStore());
    for (let i = 0; i < 20; i++) {
      exchange(warm, side('CIT-000002', history(OPENS)), CAT, CHAT_DEFAULTS, P, i * 60, rng.fork(`w${i}`));
      exchange(cold, side('CIT-000004', history(SILENT)), CAT, CHAT_DEFAULTS, P, i * 60, rng.fork(`c${i}`));
    }
    expect(w(warm)).toBeGreaterThan(w(cold));
  });
});

/** Vista mínima para los sistemas diarios: solo ciudadanos con vínculos y almacén. */
function viewOf(people: Record<string, Partial<Citizen>>): WorldView {
  return { citizens: new Map(Object.entries(people).map(([id, c]) => [id, { id, status: 'active', ...c }])) } as unknown as WorldView;
}
const ctxAt = (now: number, events: TickCtx['events'] = []): TickCtx => ({ now, citizens: [1, 2], level: () => 3, events });
const bondsIn = (patches: readonly Patch[], id: string) => (patches.find((p) => p.op === 'entity' && p.id === id) as { fields: { bonds: Bond[] } } | undefined)?.fields.bonds;

describe('012 R-006: rupturas', () => {
  it('CA-003: afecto bajo y tensión alta sostenidos rompen la pareja; las causas son la historia del par', () => {
    const A = 'CIT-000001';
    const B = 'CIT-000002';
    const pareja = (other: string, at: number, extra: Partial<Bond> = {}): Bond => ({
      with: other as EntityId, tension: 0.9, trust: 0.3, at, familiarity: 0.9, labels: ['familia', 'pareja'], events: ['EVT-00000000010', 'EVT-00000000011'], ...extra,
    });
    const storeA: FunctionStore = { ...emptyStore(), f: [{ s: personStimulus(B), v: -0.5, c: '', inh: [], hab: 0, n: 20, rs: [], o: 'direct', src: [], at: 0 }] };
    const sys = createBondDailySystem(P, CLAIM_DEFAULTS);
    // Día 1: empieza el deterioro; nadie rompe todavía.
    const day1 = sys.run(viewOf({ [A]: { bonds: [pareja(B, DAY)], functions: storeA }, [B]: { bonds: [pareja(A, DAY)] } }), ctxAt(DAY), createRng(1));
    expect(day1.events ?? []).toEqual([]);
    const since = bondsIn(day1.patches ?? [], A)![0]!.strainedSince!;
    expect(since).toBe(DAY);
    // Un mes después, con la tensión renovada por los roces: A rompe.
    const now = DAY + P.breakupDays * DAY;
    const out = sys.run(viewOf({ [A]: { bonds: [pareja(B, now, { strainedSince: since })], functions: storeA }, [B]: { bonds: [pareja(A, now)] } }), ctxAt(now), createRng(1));
    const breakup = out.events!.find((e) => e.type === 'BREAKUP')!;
    expect(breakup.payload).toEqual({ a: A, b: B, initiator: A });
    expect(breakup.causes.filter((c) => 'event' in c).length).toBeGreaterThanOrEqual(2);
    expect(bondsIn(out.patches!, A)![0]!.labels).toEqual(['ex', 'familia']);
    expect(bondsIn(out.patches!, B)![0]!.labels).toEqual(['ex', 'familia']);
  });

  it('olvida al conocido sin contacto y lo anota', () => {
    const A = 'CIT-000001';
    const old: Bond = { with: 'CIT-000002' as EntityId, tension: 0, trust: 0.5, at: 0, familiarity: 0.021, labels: ['conocido'], encounters: 1, lastEncounter: 0 };
    const out = createBondDailySystem(P, CLAIM_DEFAULTS).run(viewOf({ [A]: { bonds: [old] }, 'CIT-000002': {} }), ctxAt(10 * DAY), createRng(1));
    expect(out.events!.map((e) => e.type)).toEqual(['BOND_FORGOTTEN']);
    expect(bondsIn(out.patches!, A)).toEqual([]);
  });
});

describe('012 R-009: registro de causas del par', () => {
  it('cada evento del par queda en los vínculos de ambos lados (los últimos 5)', () => {
    const bond = (w: string): Bond => ({ with: w as EntityId, tension: 0, trust: 0.5, at: 0, familiarity: 0.2, labels: ['conocido'], events: ['E1', 'E2', 'E3', 'E4', 'E5'] });
    const view = viewOf({ 'CIT-000001': { bonds: [bond('CIT-000002')] }, 'CIT-000002': { bonds: [bond('CIT-000001')] } });
    const e = { id: 'EVT-00000000099', type: 'ENCOUNTER', at: 0, payload: { a: 'CIT-000001', b: 'CIT-000002' }, causes: [], participants: [], importance: 0.1, origin: 'engine' };
    const out = createBondLedgerSystem().run(view, ctxAt(0, [e as never]), createRng(1));
    for (const id of ['CIT-000001', 'CIT-000002']) expect(bondsIn(out.patches!, id)![0]!.events).toEqual(['E2', 'E3', 'E4', 'E5', 'EVT-00000000099']);
  });
});

describe('012 P4: el apego es una métrica de la historia', () => {
  it('cuidadores con afecto y abrirse fuerte → seguro; evadir fuerte → evitativo; cuidadores aversivos → ansioso', () => {
    const withMother = (v: number, w: Record<string, number>): FunctionStore => ({
      ...history(w), f: [{ s: personStimulus('CIT-000009'), v, c: '', inh: [], hab: 0, n: 30, rs: [], o: 'direct', src: [], at: 0 }],
    });
    expect(attachmentOf(withMother(0.6, { abrirse: 0.8, evadir: 0.2 }), ['CIT-000009']).style).toBe('seguro');
    expect(attachmentOf(withMother(0.6, { abrirse: 0.2, evadir: 0.8 }), ['CIT-000009']).style).toBe('evitativo');
    expect(attachmentOf(withMother(-0.5, { abrirse: 0.6, evadir: 0.3 }), ['CIT-000009']).style).toBe('ansioso');
    expect(attachmentOf(undefined, []).security).toBe(0.5);
  });
});
