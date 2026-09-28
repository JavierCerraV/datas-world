import { describe, expect, it } from 'vitest';
import { defineColumn } from '../components.ts';
import { selectStance } from './stance.ts';
import type { PersonCtx } from './stance.ts';
import { makeEvent } from '../events.ts';
import { createOntology } from '../functions/sensitivity.ts';
import { LEARNING_DEFAULTS, NEUTRAL, emptyStore } from '../functions/types.ts';
import type { FunctionStore } from '../functions/types.ts';
import { idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import { initNeeds } from '../needs/columns.ts';
import { teach } from '../relations/network.ts';
import type { RelationalNetwork } from '../relations/types.ts';
import { createRng } from '../rng.ts';
import { initRoutines } from '../routines/columns.ts';
import { applyPatches } from '../simulation/patches.ts';
import type { WorldView } from '../simulation/system.ts';
import { TEST_PROFILE, testConfig } from '../testing.ts';
import { addHousehold, addPerson, addPlace, completeHousehold, createWorld } from '../world.ts';
import { assessClaim, claimsHeard, resolveRelation } from './claims.ts';
import { consolidateChat } from './consolidate.ts';
import { CHAT_DEFAULTS, CLAIM_DEFAULTS } from './params.ts';
import { startConversation, visitorSaid } from './tone.ts';
import type { ChatCatalog } from './types.ts';

// Réplica mínima de los catálogos (el motor no lee archivos): dos tonos, las 8 posturas y dos afirmaciones.
const CAT: ChatCatalog = {
  tones: [{ key: 'neutro', stimulus: 'verbal.neutro', magnitude: 0.2, prior: 0 }, { key: 'invasivo', stimulus: 'verbal.pregunta_invasiva', magnitude: 0.6, prior: -0.3 }],
  stances: [
    { key: 'abrirse', escape: 0, w0: 0.5 }, { key: 'aplacar', escape: 0.3, w0: 0.4 }, { key: 'callar', escape: 0.5, w0: 0.3 },
    { key: 'contraatacar', escape: 0.4, w0: 0.25 }, { key: 'evadir', escape: 0.6, w0: 0.4 }, { key: 'poner_limite', escape: 0.5, w0: 0.35 },
    { key: 'responder_breve', escape: 0.2, w0: 0.6 }, { key: 'terminar', escape: 1, w0: 0.2 },
  ],
  claims: [
    { key: 'infiel', stimulus: 'verbal.traicion', magnitude: 0.9, prior: -0.8, about: ['pareja'] },
    { key: 'te_extrana', stimulus: 'verbal.afecto', magnitude: 0.5, prior: 0.6, about: ['pareja', 'madre'] },
  ],
  relations: [{ key: 'madre', resolve: 'mother', closeness: 0.8 }, { key: 'pareja', resolve: 'partner', closeness: 1 }],
};
// El abandono queda lejos de la traición en rasgos: lo que los une en la prueba de la red es la relación enseñada.
const onto = createOntology([
  ['verbal.neutro', [0.5, 0, 0, 0, 0, 0]], ['verbal.pregunta_invasiva', [1, 0.2, 0.3, 0, 0, 0.3]], ['verbal.traicion', [1, 0.2, 0.2, 0, 0, 0.8]],
  ['verbal.afecto', [1, 0.2, 0, 0, 0, 0.5]], ['verbal.abandono', [0, 1, 0, 0, 1, 0]],
].map(([key, features]) => ({ key: key as string, kind: 'verbal_term' as const, features: features as number[] })));
const pc = (over: Partial<PersonCtx> = {}): PersonCtx => ({ onto, P: LEARNING_DEFAULTS, sens: NEUTRAL, rules: [], variability: 0.5, ...over });
const storeWith = (entries: [string, number][]): FunctionStore => ({
  ...emptyStore(),
  f: entries.map(([s, v]) => ({ s, v, c: '', inh: [], hab: 0, n: 5, rs: [], o: 'direct' as const, src: [], at: 0 })),
});
const INFIEL = [{ predicate: 'infiel', about: 'pareja' }];

/** Ana y Luis, pareja en el mismo hogar; Ana no tiene madre en el mundo. */
function couple() {
  const { world } = createWorld(testConfig({ epoch: '2027-02-01T00:00', initialCapabilities: ['clock', 'needs', 'routines'], profile: TEST_PROFILE, seed: 5 }));
  const c = world.components;
  defineColumn(c, 'i32', 'demo.birthMinute', 0);
  defineColumn(c, 'i32', 'money', 0);
  defineColumn(c, 'u8', 'demo.student', 0);
  defineColumn(c, 'u8', 'health.sleepHours', 8);
  for (const col of ['pers.neuroticism', 'pers.extraversion', 'pers.resilience', 'pers.conscientiousness', 'pers.impulsivity']) defineColumn(c, 'f32', col, 0.5);
  const dwelling = addPlace(world, { kind: 'vivienda.unidad', name: 'Vivienda', openingHours: null });
  const h = addHousehold(world, { template: 'couple', dwellingId: dwelling });
  const ana = addPerson(world, { name: { given: 'Ana', family: ['Rojas', 'Gómez'] }, sex: 'F', birthplace: 'co.cali', householdId: h });
  const luis = addPerson(world, { name: { given: 'Luis', family: ['Pérez', 'Mora'] }, sex: 'M', birthplace: 'co.cali', householdId: h });
  completeHousehold(world, h, { headId: ana, kinship: [{ from: ana, to: luis, kind: 'partner' }], caregiverIds: [] });
  for (const id of [ana, luis]) c.i32['demo.birthMinute']![idNumber(id)] = -35 * 365 * 1440;
  const rng = createRng(5);
  initNeeds(world, rng);
  initRoutines(world, rng);
  return { world, view: world as unknown as WorldView, ana, luis };
}

describe('afirmaciones sobre terceros (044 R-001 a R-004)', () => {
  it('R-001: resuelve la relación a la persona real desde lo que conoce; si no la tiene, se descarta con el motivo', () => {
    const { view, ana, luis } = couple();
    expect(resolveRelation(view, ana, 'partner')).toBe(luis);
    expect(resolveRelation(view, luis, 'partner')).toBe(ana);
    expect(resolveRelation(view, ana, 'mother')).toBeUndefined();
    const s = startConversation(emptyStore(), 'EXT-0001');
    expect(assessClaim(s, pc(), view, ana, CAT, { predicate: 'te_extrana', about: 'madre' }, 0, CLAIM_DEFAULTS).discarded).toBe('no tiene madre');
    expect(assessClaim(s, pc(), view, ana, CAT, { predicate: 'infiel', about: 'madre' }, 0, CLAIM_DEFAULTS).discarded).toBe('no se puede decir de madre');
    expect(assessClaim(s, pc(), view, ana, CAT, { predicate: 'no_existe', about: 'pareja' }, 0, CLAIM_DEFAULTS).discarded).toBe('afirmación desconocida');
  });

  it('CA-002: la misma frase pega más a quien tiene historia de traición (aprendida o por la red) y sube más el escape', () => {
    const { view, ana } = couple();
    const assess = (store: FunctionStore, net?: RelationalNetwork) =>
      assessClaim(startConversation(store, 'EXT-0001'), pc(net ? { net } : {}), view, ana, CAT, INFIEL[0]!, 0, CLAIM_DEFAULTS);
    const plain = assess(emptyStore());
    const learned = assess(storeWith([['verbal.traicion', -0.7]]));
    expect(learned.impact).toBeGreaterThan(plain.impact);
    // Por la red (037): su padre se fue (abandono aversivo) y para ella traición y abandono son lo mismo.
    const net: RelationalNetwork = { e: [], pruned: 0 };
    teach(net, { a: 'verbal.traicion', b: 'verbal.abandono', t: 'coordination', s: 1, cfunc: '', now: 0 });
    const derived = assess(storeWith([['verbal.abandono', -1]]), net);
    expect(derived.valueSource).toBe('derived');
    expect(derived.derivedFrom).toBe('verbal.abandono');
    expect(derived.impact).toBeGreaterThan(plain.impact);

    // En la charla, la carga sube con el impacto y con ella la probabilidad de las posturas de escape.
    const escapeP = (store: FunctionStore) => {
      const s = startConversation(store, 'EXT-0001');
      visitorSaid(s, pc(), CAT, CAT.tones[0]!, 0, CHAT_DEFAULTS);
      claimsHeard(s, pc(), view, ana, CAT, INFIEL, 0, CLAIM_DEFAULTS);
      const c = selectStance(s, pc(), CAT, CAT.tones[0]!, { energy: 0.8, stress: 0.2 }, 0, CHAT_DEFAULTS, createRng(1));
      return c.probabilities.filter((p) => ['contraatacar', 'terminar', 'poner_limite'].includes(p.stance)).reduce((a, p) => a + p.p, 0);
    };
    expect(escapeP(storeWith([['verbal.traicion', -0.7]]))).toBeGreaterThan(escapeP(emptyStore()));
  });

  it('CA-003 e INV-001: a un visitante hostil se le cree menos; lo que el tercero es de verdad no cambia nada', () => {
    const { view, world, ana, luis } = couple();
    const cred = (store: FunctionStore) => assessClaim(startConversation(store, 'EXT-0001'), pc(), view, ana, CAT, INFIEL[0]!, 0, CLAIM_DEFAULTS).credibility;
    const neutral = cred(emptyStore());
    const hostile = cred(storeWith([['ext.EXT-0001', -0.8]]));
    expect(hostile).toBeLessThan(neutral);
    // L5.5: la preocupación (cuánto le importa si fuera cierto) no depende de quién lo dice; el impacto sí.
    const both = [emptyStore(), storeWith([['ext.EXT-0001', -0.8]])].map((st) => assessClaim(startConversation(st, 'EXT-0001'), pc(), view, ana, CAT, INFIEL[0]!, 0, CLAIM_DEFAULTS));
    // (casi igual: lo aprendido del visitante se generaliza un poco a la traición por la ontología, 036 R-004)
    expect(both[0]!.concern).toBeCloseTo(both[1]!.concern, 1);
    expect(both[1]!.impact).toBeLessThan(both[0]!.impact);
    expect(both[0]!.impact).toBeCloseTo(both[0]!.credibility * both[0]!.concern, 2);
    // Cambiar el estado real de Luis (lo que cree, lo que aprendió) no cambia lo que Ana cree de él.
    Object.assign(world.citizens.get(luis)!, { functions: storeWith([['verbal.traicion', 1]]), beliefs: [{ about: ana, predicate: 'infiel', source: 'EXT-0001', credibility: 1, at: 0, cause: 'EVT-000001' as EntityId }] });
    expect(cred(emptyStore())).toBe(neutral);
    // La confianza en él baja la credibilidad de lo malo y sube la de lo bueno.
    const good = assessClaim(startConversation(emptyStore(), 'EXT-0001'), pc(), view, ana, CAT, { predicate: 'te_extrana', about: 'pareja' }, 0, CLAIM_DEFAULTS);
    expect(good.credibility).toBeGreaterThan(neutral);
  });
});

describe('consolidación de lo que oyó (044 §5, R-005)', () => {
  const consolidate = (store: FunctionStore, claims = INFIEL) => {
    const { world, view, ana, luis } = couple();
    world.citizens.get(ana)!.functions = store;
    const row = idNumber(ana);
    const stress0 = world.components.f32['state.stress']![row]!;
    const r = consolidateChat(
      view, { sessionId: 'CHS-000001', citizenId: ana, visitorId: 'EXT-0001', turns: [{ tone: 'neutro', stance: 'abrirse' }, { tone: 'invasivo', stance: 'poner_limite', claims }] },
      CAT, { onto, P: LEARNING_DEFAULTS, sens: NEUTRAL }, CHAT_DEFAULTS, 600, [{ state: 'external_input', weight: 1 }], (e) => makeEvent(world.counters, 600, e),
    );
    applyPatches(world, r.patches, 'chat');
    return { r, world, ana, luis, stress: world.components.f32['state.stress']![row]! - stress0 };
  };

  it('CA-001: oye que su pareja le es infiel, lo cree, queda como creencia con su causa y el estrés sube más que sin la revelación', () => {
    const { r, world, ana, luis, stress } = consolidate(storeWith([['verbal.traicion', -0.5]]));
    const heard = r.events.find((e) => e.type === 'CHAT_CLAIM_HEARD')!;
    expect(heard.payload).toMatchObject({ citizenId: ana, about: luis, predicate: 'infiel', seq: 1, sessionId: 'CHS-000001' });
    expect(heard.causes[0]).toEqual({ event: r.events[0]!.id, weight: 1 });
    expect(heard.participants.map((p) => p.id)).toEqual([ana, luis]);
    const believed = r.events.find((e) => e.type === 'CHAT_CLAIM_BELIEVED')!;
    expect(believed.causes[0]).toEqual({ event: heard.id, weight: 1 });
    expect(believed.causes[1]).toMatchObject({ state: 'fuente.funcion:verbal.traicion' });
    const belief = world.citizens.get(ana)!.beliefs![0]!;
    expect(belief).toMatchObject({ about: luis, predicate: 'infiel', source: 'EXT-0001', cause: believed.id });
    const without = consolidate(storeWith([['verbal.traicion', -0.5]]), []);
    expect(stress).toBeGreaterThan(without.stress);
    expect(stress - without.stress).toBeLessThanOrEqual(CLAIM_DEFAULTS.maxClaimStressDelta + 1e-6);
  });

  it('CA-008: si no lo cree (visitante hostil), lo oyó pero no queda creencia; el estrés solo sube por una charla más tensa', () => {
    const hostile = storeWith([['ext.EXT-0001', -0.8], ['verbal.traicion', -0.5]]);
    const { r, world, ana, stress } = consolidate(hostile);
    expect(r.events.some((e) => e.type === 'CHAT_CLAIM_HEARD')).toBe(true);
    expect(r.events.some((e) => e.type === 'CHAT_CLAIM_BELIEVED')).toBe(false);
    expect(world.citizens.get(ana)!.beliefs).toEqual([]);
    // Sin el estrés propio de la revelación (R-005): mucho menos que si se lo hubiera creído.
    const extra = stress - consolidate(hostile, []).stress;
    const believedExtra = consolidate(storeWith([['verbal.traicion', -0.5]])).stress - consolidate(storeWith([['verbal.traicion', -0.5]]), []).stress;
    expect(extra).toBeLessThan(believedExtra / 2);
  });

  it('una afirmación descartada (no tiene madre) no deja eventos; la consolidación es determinista', () => {
    const { r } = consolidate(emptyStore(), [{ predicate: 'te_extrana', about: 'madre' }]);
    expect(r.events.filter((e) => e.type.startsWith('CHAT_CLAIM'))).toEqual([]);
    const a = consolidate(storeWith([['verbal.traicion', -0.5]]));
    const b = consolidate(storeWith([['verbal.traicion', -0.5]]));
    expect(JSON.stringify(a.r.patches)).toBe(JSON.stringify(b.r.patches));
  });
});
