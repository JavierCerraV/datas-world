import { describe, expect, it } from 'vitest';
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import { POLICY } from '../architecture/rules.ts';
import { defineColumn } from '../components.ts';
import { setOccupation } from '../employment.ts';
import { makeEvent } from '../events.ts';
import { createOntology } from '../functions/sensitivity.ts';
import { storeOf } from '../functions/system.ts';
import { LEARNING_DEFAULTS, NEUTRAL, emptyStore } from '../functions/types.ts';
import type { FunctionStore } from '../functions/types.ts';
import { formatId, idNumber } from '../ids.ts';
import { initNeeds } from '../needs/columns.ts';
import { createRng } from '../rng.ts';
import { initRoutines } from '../routines/columns.ts';
import { dayInfo } from '../routines/day.ts';
import { planAt } from '../routines/plan.ts';
import type { Rule } from '../rules/rules.ts';
import { applyPatches } from '../simulation/patches.ts';
import type { WorldView } from '../simulation/system.ts';
import { TEST_PROFILE, testConfig } from '../testing.ts';
import { addHousehold, addPerson, addPlace, createWorld } from '../world.ts';
import { chatAvailability, openingEvent } from './availability.ts';
import { consolidateChat } from './consolidate.ts';
import { CHAT_DEFAULTS } from './params.ts';
import { selectStance, stanceOptions } from './stance.ts';
import type { PersonCtx } from './stance.ts';
import { startConversation, toneValue, visitorSaid, visitorValue } from './tone.ts';
import type { ChatCatalog, ToneDef } from './types.ts';
import { softmax, temperatureOf } from '../decision/select.ts';

// Réplica de los catálogos `chat_tones` y `chat_stances` (el motor no lee archivos; los valores son los del JSON).
const T = (key: string, stimulus: string, magnitude: number, prior: number): ToneDef => ({ key, stimulus, magnitude, prior });
const CAT: ChatCatalog = {
  tones: [
    T('amable', 'verbal.aprobacion', 0.5, 0.5), T('burla', 'verbal.burla', 0.7, -0.5), T('culpabilizador', 'verbal.culpa', 0.7, -0.4),
    T('curioso', 'verbal.pregunta', 0.4, 0.1), T('desagradable', 'verbal.critica', 0.5, -0.4), T('grosero', 'verbal.insulto', 0.8, -0.6),
    T('hostil', 'verbal.amenaza', 1, -0.8), T('intimo', 'verbal.confidencia', 0.6, 0.2), T('invasivo', 'verbal.pregunta_invasiva', 0.6, -0.3),
    T('neutro', 'verbal.neutro', 0.2, 0), T('presion', 'verbal.presion', 0.6, -0.3), T('victimizante', 'verbal.lamento', 0.6, -0.1),
  ],
  stances: [
    { key: 'abrirse', escape: 0, w0: 0.5 }, { key: 'aplacar', escape: 0.3, w0: 0.4 }, { key: 'callar', escape: 0.5, w0: 0.3 },
    { key: 'contraatacar', escape: 0.4, w0: 0.25 }, { key: 'evadir', escape: 0.6, w0: 0.4 }, { key: 'poner_limite', escape: 0.5, w0: 0.35 },
    { key: 'responder_breve', escape: 0.2, w0: 0.6 }, { key: 'terminar', escape: 1, w0: 0.2 },
  ],
};
const VERBAL: [string, number[]][] = [
  ['verbal.amenaza', [1, 0.5, 0, 0, 0, 0]], ['verbal.aprobacion', [1, 0, 0, 0, 0.3, 0]], ['verbal.burla', [1, 0, 0, 0, 0.2, 0]],
  ['verbal.confidencia', [1, 0, 0, 0, 0, 0.3]], ['verbal.critica', [1, 0, 0, 0, 0, 0]], ['verbal.culpa', [1, 0, 0, 0, 0, 0.2]],
  ['verbal.insulto', [1, 0.2, 0, 0, 0, 0]], ['verbal.lamento', [1, 0.2, 0, 0, 0, 0.2]], ['verbal.neutro', [0.5, 0, 0, 0, 0, 0]],
  ['verbal.pregunta', [0.8, 0, 0, 0, 0, 0]], ['verbal.pregunta_invasiva', [1, 0.2, 0.3, 0, 0, 0.3]], ['verbal.presion', [1, 0, 0, 0.3, 0, 0]],
];
const onto = createOntology(VERBAL.map(([key, features]) => ({ key, kind: 'verbal_term' as const, features })));
const tone = (k: string) => CAT.tones.find((t) => t.key === k)!;
const LIVE = { energy: 0.8, stress: 0.2 };
const ESCAPE = new Set(['evadir', 'poner_limite', 'contraatacar', 'callar', 'terminar']);
const person = (over: Partial<PersonCtx> = {}): PersonCtx => ({ onto, P: LEARNING_DEFAULTS, sens: NEUTRAL, rules: [], variability: 0.5, ...over });
const storeWith = (entries: [string, number][]): FunctionStore => ({
  ...emptyStore(),
  f: entries.map(([s, v]) => ({ s, v, c: '', inh: [], hab: 0, n: 5, rs: [], o: 'direct' as const, src: [], at: 0 })),
});

/** Juega un guion y devuelve las posturas elegidas. */
function play(script: string[], seed: number, store = emptyStore(), pc = person()): string[] {
  const s = startConversation(store, 'EXT-0001');
  const rng = createRng(seed).fork('chat');
  return script.map((k, i) => {
    visitorSaid(s, pc, CAT, tone(k), i, CHAT_DEFAULTS);
    return selectStance(s, pc, CAT, tone(k), LIVE, i, CHAT_DEFAULTS, rng.fork(i)).stance;
  });
}
const escapeShare = (stances: string[]) => stances.filter((x) => ESCAPE.has(x)).length / stances.length;

describe('charla: tono, postura y aprendizaje (043)', () => {
  it('R-005: la función del tono es prior + netValue; la aprobación aprendida no vuelve agradable un insulto', () => {
    const s = storeWith([['verbal.aprobacion', 0.09]]);
    expect(toneValue(s, person(), tone('grosero'), 0)).toBeLessThan(-0.45);
    expect(toneValue(s, person(), tone('amable'), 0)).toBeGreaterThan(0.55);
    expect(toneValue(emptyStore(), person(), tone('hostil'), 0)).toBe(-0.8);
  });

  it('CA-004: el guion grosero produce más posturas de escape o defensa que el amable (200 charlas)', () => {
    const kind = Array.from({ length: 200 }, (_, i) => play(['amable', 'amable', 'amable'], i)).flat();
    const rude = Array.from({ length: 200 }, (_, i) => play(['desagradable', 'grosero', 'grosero', 'grosero'], i)).flat();
    expect(escapeShare(rude) - escapeShare(kind)).toBeGreaterThanOrEqual(0.15);
  });

  it('CA-005: con el insulto aprendido más aversivo se escapa más; la selección no lee el temperamento', () => {
    const script = ['grosero', 'grosero', 'grosero'];
    const hard = Array.from({ length: 200 }, (_, i) => play(script, i, storeWith([['verbal.insulto', -0.8]]))).flat();
    const soft = Array.from({ length: 200 }, (_, i) => play(script, i, storeWith([['verbal.insulto', -0.2]]))).flat();
    expect(escapeShare(hard)).toBeGreaterThan(escapeShare(soft));
    expect(POLICY.selectionModules).toContain('packages/engine/src/conversation/');
  });

  it('CA-006: una regla "si me faltan al respeto, me voy" hace más probable terminar y aparece entre los aportes', () => {
    const rule: Rule = {
      id: 1, ante: 'verbal.insulto', resp: 'conv.terminar', cons: 'verbal.aprobacion', src: 'speaker', speaker: 'familia', s: 0.6,
      contrast: 0, hist: { followed: 0, byContingency: 0, bySpeaker: 0 }, at: 0,
    };
    const pTerminar = (pc: PersonCtx) => {
      const s = startConversation(emptyStore(), 'EXT-0001');
      for (let i = 0; i < 3; i++) visitorSaid(s, pc, CAT, tone('grosero'), i, CHAT_DEFAULTS);
      const opts = stanceOptions(s, pc, CAT, tone('grosero'), LIVE, 3, CHAT_DEFAULTS);
      const p = softmax(opts.map((o) => o.value), temperatureOf(pc.variability));
      return { p: p[opts.findIndex((o) => o.stance === 'terminar')]!, opts };
    };
    const without = pTerminar(person());
    const withRule = pTerminar(person({ rules: [rule] }));
    expect(withRule.p).toBeGreaterThan(without.p);
    expect(withRule.opts.find((o) => o.stance === 'terminar')!.sources.some((x) => x.source === 'regla')).toBe(true);
  });

  it('CA-007: el guion victimizante da al menos 3 posturas distintas y una distribución distinta de la amable', () => {
    const lament = ['victimizante', 'victimizante', 'victimizante', 'victimizante'];
    const people = Array.from({ length: 50 }, (_, i) => {
      const r = createRng(1000 + i);
      return storeWith([['verbal.aprobacion', r.next() * 0.4], ['verbal.critica', -r.next() * 0.5]]);
    });
    const vict = people.flatMap((st, i) => play(lament, i, st));
    const kind = people.flatMap((st, i) => play(['amable', 'amable', 'amable', 'amable'], i, st));
    expect(new Set(vict).size).toBeGreaterThanOrEqual(3);
    const share = (xs: string[], k: string) => xs.filter((x) => x === k).length / xs.length;
    const diff = CAT.stances.reduce((a, st) => a + Math.abs(share(vict, st.key) - share(kind, st.key)), 0);
    expect(diff).toBeGreaterThan(0.1);
  });

  it('CA-008: en un guion hostil de 20 turnos, al menos uno de 50 ciudadanos termina la charla antes del final', () => {
    const hostile = Array.from({ length: 20 }, () => 'hostil');
    const ended = Array.from({ length: 50 }, (_, i) => play(hostile, i).slice(0, 19).includes('terminar'));
    expect(ended.some(Boolean)).toBe(true);
  });

  it('R-006 y R-007: un visitante grosero se vuelve aversivo y la carga crece y decae', () => {
    const s = startConversation(emptyStore(), 'EXT-0001');
    visitorSaid(s, person(), CAT, tone('grosero'), 0, CHAT_DEFAULTS);
    const load1 = s.aversiveLoad;
    visitorSaid(s, person(), CAT, tone('grosero'), 1, CHAT_DEFAULTS);
    expect(visitorValue(s)).toBeLessThan(0);
    expect(s.aversiveLoad).toBeGreaterThan(load1);
    visitorSaid(s, person(), CAT, tone('neutro'), 2, CHAT_DEFAULTS);
    expect(s.aversiveLoad).toBeLessThan(load1 * 2);
  });

  it('CA-020 (motor): el fin por compromiso fuerza la postura terminar sin consumir azar', () => {
    const s = startConversation(emptyStore(), 'EXT-0001');
    visitorSaid(s, person(), CAT, tone('amable'), 0, CHAT_DEFAULTS);
    const rng = createRng(7);
    const before = JSON.stringify(rng.state());
    const c = selectStance(s, person(), CAT, tone('amable'), LIVE, 0, CHAT_DEFAULTS, rng, 'terminar');
    expect(c.stance).toBe('terminar');
    expect(c.forced).toBe(true);
    expect(JSON.stringify(rng.state())).toBe(before);
  });
});

// Un mundo mínimo con una persona sin empleo: rutina con comidas (poco flexibles), tiempo libre y sueño.
function worldWithPerson() {
  const { world } = createWorld(
    testConfig({ epoch: '2027-02-01T00:00', initialCapabilities: ['clock', 'needs', 'routines'], profile: TEST_PROFILE, seed: 11 }),
  );
  const c = world.components;
  defineColumn(c, 'i32', 'demo.birthMinute', 0);
  defineColumn(c, 'i32', 'money', 0);
  defineColumn(c, 'u8', 'demo.student', 0);
  defineColumn(c, 'u8', 'health.sleepHours', 8);
  for (const col of ['pers.neuroticism', 'pers.extraversion', 'pers.resilience', 'pers.conscientiousness', 'pers.impulsivity'])
    defineColumn(c, 'f32', col, 0.5);
  const dwelling = addPlace(world, { kind: 'vivienda.unidad', name: 'Vivienda', openingHours: null });
  const h = addHousehold(world, { template: 'single', dwellingId: dwelling });
  const id = addPerson(world, { name: { given: 'Ana', family: ['Rojas', 'Gómez'] }, sex: 'F', birthplace: 'co.cali', householdId: h });
  const row = idNumber(id);
  c.i32['demo.birthMinute']![row] = -35 * 365 * 1440;
  setOccupation(world, id, { kind: 'none', reason: 'other_inactive', since: 0 });
  const rng = createRng(11);
  initNeeds(world, rng);
  initRoutines(world, rng);
  return { world, row, id };
}

describe('charla en el mundo: disponibilidad y consolidación (043 R-019 a R-022)', () => {
  it('CA-019: dormida no charla; en una obligación, solo un momento; libre, hasta su próximo compromiso', () => {
    const { world, row } = worldWithPerson();
    const view = world as unknown as WorldView;
    let busyAt = -1;
    let freeAt = -1;
    for (let m = 6 * 60; m < 22 * 60; m += 5) {
      const plan = planAt(view, row, dayInfo(view, m), m);
      if (plan.activity === 'sleep') continue;
      if (plan.flexibility < 0.5 && busyAt < 0) busyAt = m;
      if (plan.flexibility >= 0.5 && freeAt < 0) freeAt = m;
    }
    expect(busyAt).toBeGreaterThan(0);
    expect(chatAvailability(view, row, busyAt, CHAT_DEFAULTS)).toEqual({ ok: true, until: busyAt + 10, busy: true });
    const free = chatAvailability(view, row, freeAt, CHAT_DEFAULTS);
    expect(free.ok && !free.busy && free.until > freeAt).toBe(true);
    world.components.u8[ACTIVITY_COLUMN]![row] = ACTIVITY.sleep;
    const asleep = chatAvailability(view, row, freeAt, CHAT_DEFAULTS);
    expect(asleep).toEqual({ ok: false, reason: 'dormido' });
    const ev = openingEvent(view, row, 'EXT-0001', 'CHS-000001', asleep, [{ state: 'external_input', value: 1, weight: 1 }]);
    expect(ev.type).toBe('CONVERSATION_DECLINED');
    expect(() => makeEvent(world.counters, freeAt, ev)).not.toThrow();
  });

  it('CA-013: una charla grosera deja recuerdo, un visitante aversivo, estrés acotado y aprendizaje con tope', () => {
    const { world, row, id } = worldWithPerson();
    const view = world as unknown as WorldView;
    const stress0 = world.components.f32['state.stress']![row]!;
    const cause = [{ state: 'external_input', value: 3, weight: 1 }];
    const r = consolidateChat(
      view,
      { sessionId: 'CHS-000001', citizenId: id, visitorId: 'EXT-0001', turns: ['desagradable', 'grosero', 'grosero', 'hostil'].map((t, i) => ({ tone: t, stance: i < 3 ? 'poner_limite' : 'terminar' })) },
      CAT, { onto, P: LEARNING_DEFAULTS, sens: NEUTRAL }, CHAT_DEFAULTS, 600, cause, (e) => makeEvent(world.counters, 600, e),
    );
    applyPatches(world, r.patches, 'chat');
    const held = r.events[0]!;
    expect(held.type).toBe('CONVERSATION_HELD');
    expect(held.causes[0]).toEqual(cause[0]);
    expect(held.participants[0]!.id).toBe(formatId('CIT', row));
    expect(r.events[1]!.type).toBe('LEARNED_FROM_CONVERSATION');
    expect(r.events[1]!.causes[0]).toEqual({ event: held.id, weight: 1 });
    for (const d of r.deltas) expect(Math.abs(d.after - d.before)).toBeLessThanOrEqual(CHAT_DEFAULTS.maxLearningDelta + 1e-9);
    const stress1 = world.components.f32['state.stress']![row]!;
    expect(stress1).toBeGreaterThan(stress0);
    expect(stress1 - stress0).toBeLessThanOrEqual(CHAT_DEFAULTS.maxMoodDelta + 1e-6);
    // La siguiente charla empieza con el visitante ya aversivo (R-006, R-021).
    const next = startConversation(storeOf(view, row), 'EXT-0001');
    expect(visitorValue(next)).toBeLessThan(0);
  });

  it('la consolidación es determinista: el mismo mundo y la misma entrada dan los mismos parches', () => {
    const run = () => {
      const { world, id } = worldWithPerson();
      const out = consolidateChat(
        world as unknown as WorldView, { sessionId: 'CHS-000002', citizenId: id, visitorId: 'EXT-0001', turns: [{ tone: 'amable', stance: 'abrirse' }, { tone: 'curioso', stance: 'abrirse' }] },
        CAT, { onto, P: LEARNING_DEFAULTS, sens: NEUTRAL }, CHAT_DEFAULTS, 600, [{ state: 'external_input', weight: 1 }], (e) => makeEvent(world.counters, 600, e),
      );
      return JSON.stringify({ p: out.patches, d: out.deltas, s: out.summary });
    };
    expect(run()).toBe(run());
  });
});
