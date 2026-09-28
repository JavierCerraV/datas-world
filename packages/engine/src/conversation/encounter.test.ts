import { describe, expect, it } from 'vitest';
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import { defineColumn } from '../components.ts';
import { emptyStore } from '../functions/types.ts';
import type { FunctionStore } from '../functions/types.ts';
import { idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import { initNeeds } from '../needs/columns.ts';
import { addObject } from '../objects.ts';
import { createRng } from '../rng.ts';
import { initRoutines } from '../routines/columns.ts';
import { runSystems } from '../simulation/loop.ts';
import { createRegistry } from '../simulation/registry.ts';
import type { WorldView } from '../simulation/system.ts';
import { TEST_PROFILE, testConfig } from '../testing.ts';
import { addHousehold, addPerson, addPlace, completeHousehold, createWorld } from '../world.ts';
import type { Intention, World } from '../world.ts';
import { RESPONSES, consequenceSystems, respond, tensionNow } from './encounter.ts';
import { chooseIntention, intentionOptions } from './intentions.ts';
import { CLAIM_DEFAULTS } from './params.ts';
import type { ChatCatalog } from './types.ts';

// El motor no lee archivos: los catálogos se replican a mano.
const CAT: ChatCatalog = {
  tones: [],
  stances: [
    { key: 'abrirse', escape: 0, w0: 0.5 }, { key: 'aplacar', escape: 0.3, w0: 0.4 }, { key: 'callar', escape: 0.5, w0: 0.3 },
    { key: 'contraatacar', escape: 0.4, w0: 0.25 }, { key: 'evadir', escape: 0.6, w0: 0.4 }, { key: 'poner_limite', escape: 0.5, w0: 0.35 },
    { key: 'responder_breve', escape: 0.2, w0: 0.6 }, { key: 'terminar', escape: 1, w0: 0.2 },
  ],
  phone: { kind: 'tecnologia.telefono', callAccess: { '3': 1 } },
};
const P = CLAIM_DEFAULTS;
const stances = (entries: [string, number][]): FunctionStore => ({ ...emptyStore(), r: entries.map(([k, w]) => ({ r: `conv.${k}`, c: '', w, n: 5, at: 0 })) });

/** Ana y Luis, pareja; cada uno en su lugar, despiertos, con celular. */
function couple() {
  const { world } = createWorld(testConfig({ epoch: '2027-02-01T00:00', initialCapabilities: ['clock', 'needs', 'routines', 'learning'], profile: TEST_PROFILE, seed: 7 }));
  const c = world.components;
  defineColumn(c, 'i32', 'demo.birthMinute', 0);
  defineColumn(c, 'i32', 'money', 0);
  defineColumn(c, 'u8', 'demo.student', 0);
  defineColumn(c, 'u8', 'health.sleepHours', 8);
  defineColumn(c, 'i32', 'loc.place', 0);
  for (const col of ['pers.neuroticism', 'pers.extraversion', 'pers.resilience', 'pers.conscientiousness', 'pers.impulsivity']) defineColumn(c, 'f32', col, 0.5);
  const dwelling = addPlace(world, { kind: 'vivienda.unidad', name: 'Vivienda', openingHours: null });
  const work = addPlace(world, { kind: 'comercio.tienda', name: 'Tienda', openingHours: null });
  const h = addHousehold(world, { template: 'couple', dwellingId: dwelling });
  const ana = addPerson(world, { name: { given: 'Ana', family: ['Rojas', 'Gómez'] }, sex: 'F', birthplace: 'co.cali', householdId: h });
  const luis = addPerson(world, { name: { given: 'Luis', family: ['Pérez', 'Mora'] }, sex: 'M', birthplace: 'co.cali', householdId: h });
  completeHousehold(world, h, { headId: ana, kinship: [{ from: ana, to: luis, kind: 'partner' }], caregiverIds: [] });
  const rng = createRng(7);
  initNeeds(world, rng);
  initRoutines(world, rng);
  for (const id of [ana, luis]) addObject(world, { kind: 'tecnologia.telefono', name: 'un celular', ownerId: id, marketValue: 650_000, condition: 1, sentimental: {} });
  const place = (id: EntityId, p: EntityId) => { c.i32['loc.place']![idNumber(id)] = idNumber(p); };
  place(ana, dwelling);
  place(luis, work);
  for (const id of [ana, luis]) c.u8[ACTIVITY_COLUMN]![idNumber(id)] = ACTIVITY.idle;
  world.now = 10 * 60;
  return { world, ana, luis, dwelling, work, place };
}

const intend = (world: World, who: EntityId, it: Omit<Intention, 'expiresAt' | 'cause'> & { expiresAt?: number }) => {
  world.citizens.get(who)!.intentions = [{ expiresAt: world.now + P.intentTtlMin, cause: 'EVT-000099' as EntityId, ...it }];
};
const tick = (world: World) => runSystems(world, createRng(world.config.seed).fork(world.now), createRegistry(consequenceSystems(CAT, P)));
const stress = (world: World, id: EntityId) => world.components.f32['state.stress']![idNumber(id)]!;

describe('llamada, encuentro y vínculo (044 R-006 a R-008)', () => {
  it('CA-004: llama si está en otro lugar; la llamada, el encuentro y la tensión quedan encadenados en el mismo tick', () => {
    const { world, ana, luis } = couple();
    world.citizens.get(ana)!.beliefs = [{ about: luis, predicate: 'infiel', source: 'EXT-0001', credibility: 0.6, at: 0, cause: 'EVT-000098' as EntityId }];
    intend(world, ana, { kind: 'llamar', target: luis, topic: 'infiel', urgency: 0.6 });
    const s0 = stress(world, luis);
    const events = tick(world);
    expect(events.map((e) => e.type)).toEqual(['PHONE_CALL_MADE', 'CONFRONTATION', 'BOND_STRAINED']);
    const [call, conf, strain] = events as [typeof events[0], typeof events[0], typeof events[0]];
    expect(call.causes[0]).toEqual({ event: 'EVT-000099', weight: 1 });
    expect(conf.causes[0]).toEqual({ event: call.id, weight: 1 });
    expect(conf.payload).toMatchObject({ a: ana, b: luis, via: 'llamada', responseA: 'acusar', topic: 'infiel' });
    expect(strain.causes[0]).toEqual({ event: conf.id, weight: 1 });
    expect(world.citizens.get(ana)!.intentions).toEqual([]);
    const bond = world.citizens.get(ana)!.bonds![0]!;
    expect(bond.with).toBe(luis);
    expect(bond.tension).toBeGreaterThan(0);
    expect(bond.tension).toBeLessThanOrEqual(P.maxTensionDelta + 1e-9); // INV-003
    expect(bond.trust).toBeLessThan(P.trust0Family);
    expect(stress(world, luis)).toBeGreaterThan(s0);
    // R-008.4: Luis se entera de que un extraño anda diciendo cosas, por Ana.
    expect(world.citizens.get(luis)!.beliefs).toEqual([{ about: 'EXT-0001', predicate: 'anda_diciendo_cosas', source: ana, credibility: P.rumorCredibility, at: world.now, cause: conf.id }]);
    // Si Luis niega o explica, Ana duda de lo que oyó.
    const heard = world.citizens.get(ana)!.beliefs![0]!;
    const denied = ['negar', 'explicar'].includes((conf.payload as { responseB: string }).responseB);
    expect(heard.credibility < 0.6).toBe(denied);
  });

  it('CA-004: confrontar espera a coincidir en el mismo lugar; con alguien dormido no hay llamada', () => {
    const { world, ana, luis, dwelling, place } = couple();
    intend(world, ana, { kind: 'confrontar', target: luis, topic: 'infiel', urgency: 0.5 });
    expect(tick(world)).toEqual([]);
    place(luis, dwelling);
    world.now += 5;
    const [conf] = tick(world);
    expect(conf!.type).toBe('CONFRONTATION');
    expect(conf!.payload).toMatchObject({ via: 'en_persona', responseA: 'acusar' });
    expect(conf!.placeId).toBe(dwelling);

    const other = couple();
    other.world.components.u8[ACTIVITY_COLUMN]![idNumber(other.luis)] = ACTIVITY.sleep;
    intend(other.world, other.ana, { kind: 'llamar', target: other.luis, topic: 'infiel', urgency: 0.9 });
    expect(tick(other.world)).toEqual([]);
    expect(other.world.citizens.get(other.ana)!.intentions).toHaveLength(1);
  });

  it('rumiar no hace nada en el bucle de la 044 (el PNR es de la 039) y la intención caduca con su evento', () => {
    const { world, ana, luis } = couple();
    intend(world, ana, { kind: 'rumiar', target: luis, topic: 'infiel', urgency: 0.4, expiresAt: world.now + 120 });
    const s0 = stress(world, ana);
    expect(tick(world)).toEqual([]);
    expect(stress(world, ana)).toBe(s0);
    world.now += 120;
    const [expired] = tick(world);
    expect(expired!.type).toBe('INTENTION_EXPIRED');
    expect(expired!.causes[0]).toEqual({ event: 'EVT-000099', weight: 1 });
    expect(world.citizens.get(ana)!.intentions).toEqual([]);
  });

  it('R-007: la tensión decae por día desde el último cambio', () => {
    const b = { with: 'CIT-000002' as EntityId, tension: 0.3, trust: 0.5, at: 0 };
    expect(tensionNow(b, 0, P)).toBe(0.3);
    expect(tensionNow(b, 2 * 1440, P)).toBeCloseTo(0.2, 6);
    expect(tensionNow(b, 30 * 1440, P)).toBe(0);
  });
});

describe('las respuestas salen de la historia de cada uno (044 R-006, R-008.2)', () => {
  it('quien reforzó contraatacar responde contraatacando más; quien nunca lo hizo, sobre todo niega', () => {
    const { world, luis } = couple();
    const view = world as unknown as WorldView;
    const count = (store: FunctionStore) => {
      world.citizens.get(luis)!.functions = store;
      const n: Record<string, number> = Object.fromEntries(RESPONSES.map((r) => [r, 0]));
      for (let i = 0; i < 300; i++) n[respond(view, luis, CAT, 'acusar', P, createRng(i))]! += 1;
      return n;
    };
    const plain = count(emptyStore());
    const fighter = count(stances([['contraatacar', 0.95]]));
    expect(plain.negar).toBe(Math.max(...Object.values(plain)));
    expect(fighter.contraatacar!).toBeGreaterThan(plain.contraatacar! * 2);
  });

  it('sin celular no hay llamada; la historia de confrontar empuja a llamar o confrontar, la duda a preguntar', () => {
    const opts = (store: FunctionStore, call: boolean, cred = 0.9) => intentionOptions(store, CAT, 0.7, cred, call, false, P);
    expect(opts(emptyStore(), false).map((o) => o.kind)).toEqual(['confrontar', 'preguntar', 'rumiar']);
    const p = (store: FunctionStore, cred = 0.9) => {
      const n: Record<string, number> = {};
      for (let i = 0; i < 300; i++) {
        const k = chooseIntention(opts(store, true, cred), 0.5, createRng(i)).kind;
        n[k] = (n[k] ?? 0) + 1;
      }
      return n;
    };
    const avoider = p(stances([['callar', 0.9], ['evadir', 0.9], ['contraatacar', 0.05], ['poner_limite', 0.05]]));
    const fighter = p(stances([['contraatacar', 0.9], ['callar', 0.05], ['evadir', 0.05]]));
    expect((fighter.llamar ?? 0) + (fighter.confrontar ?? 0)).toBeGreaterThan((avoider.llamar ?? 0) + (avoider.confrontar ?? 0));
    expect(avoider.rumiar ?? 0).toBeGreaterThan(fighter.rumiar ?? 0);
    expect(p(emptyStore(), 0.5).preguntar ?? 0).toBeGreaterThan(p(emptyStore(), 0.95).preguntar ?? 0);
  });
});
