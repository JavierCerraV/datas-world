// Reglas (spec 038): tipo según la historia, aporte, tope, arista en la red, reglas de la rutina y confirmación.
import { describe, expect, it } from 'vitest';
import type { WorldEvent } from '../events.ts';
import { idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import { emptyNetwork } from '../relations/types.ts';
import type { TickCtx, WorldView } from '../simulation/system.ts';
import { testConfig } from '../testing.ts';
import { defineColumn } from '../components.ts';
import { addHousehold, addPerson, addPlace, createWorld } from '../world.ts';
import { ROUTINE_RULES, initRules, routineResponse, rulesSystem } from './routine.ts';
import { MAX_RULES, addRule, kindOf, observe, ruleContribution } from './rules.ts';
import type { Rule } from './rules.ts';

const DAY = 1440;

describe('038: reglas', () => {
  it('R-003: el tipo sale de la historia; sin historia, de quién la formuló', () => {
    const rules: Rule[] = [];
    const net = emptyNetwork();
    const r = addRule(rules, net, { ante: 'lab', resp: 'A', cons: 'refuerzo', src: 'speaker', s: 0.8, now: 0 });
    expect(kindOf(r)).toBe('pliance');
    observe(r, 0, 0.1, 'contingency');
    expect(kindOf(r)).toBe('tracking');
    r.hist.bySpeaker = 3;
    expect(kindOf(r)).toBe('pliance');
    expect(kindOf({ ...r, aug: true })).toBe('augmenting');
    expect(kindOf(addRule(rules, net, { ante: 'lab', resp: 'B', cons: 'x', src: 'self', s: 0.5, now: 1 }))).toBe('tracking');
  });

  it('R-004 y R-005: el contraste resta aporte, y al pliance mucho menos', () => {
    const rules: Rule[] = [];
    const net = emptyNetwork();
    const p = addRule(rules, net, { ante: 'lab', resp: 'A', cons: 'c', src: 'speaker', s: 0.8, now: 0 });
    const t = addRule(rules, net, { ante: 'lab', resp: 'B', cons: 'c', src: 'self', s: 0.8, now: 0 });
    for (let k = 0; k < 30; k++) {
      observe(p, 1, 0.1);
      observe(t, 1, 0.1);
    }
    expect(p.contrast).toBeCloseTo(t.contrast, 10);
    expect(ruleContribution(t)).toBeLessThan(0.8 * 0.1);
    expect(ruleContribution(p)).toBeGreaterThan(0.8 * 0.7);
  });

  it('R-002 e INV-001: la regla vive en la red como `resp causes cons` en su contexto; la aprobación del hablante la refuerza', () => {
    const rules: Rule[] = [];
    const net = emptyNetwork();
    addRule(rules, net, { ante: 'trabajo', resp: 'rutina.job_search', cons: 'verbal.trabajo', src: 'speaker', s: 0.4, approval: 0.5, now: 0 });
    expect(rules[0]!.s).toBeCloseTo(0.4 * 1.25, 10);
    expect(net.e).toEqual([{ a: 'rutina.job_search', b: 'verbal.trabajo', t: 'causes', s: 0.5, crel: 'trabajo', o: 'taught', src: [], at: 0 }]);
  });

  it('INV-003: no pasa de 32 reglas; descarta la de menor aporte', () => {
    const rules: Rule[] = [];
    const net = emptyNetwork();
    for (let k = 0; k < MAX_RULES + 3; k++) addRule(rules, net, { ante: 'lab', resp: `R${k}`, cons: 'c', src: 'self', s: k === 0 ? 0.01 : 0.5, now: k });
    expect(rules.length).toBe(MAX_RULES);
    expect(rules.some((r) => r.resp === 'R0')).toBe(false);
  });
});

describe('038 R-010 y R-005: reglas de la rutina en el mundo', () => {
  const build = () => {
    const { world } = createWorld(testConfig());
    defineColumn(world.components, 'i32', 'demo.birthMinute', 0);
    const dwelling = addPlace(world, { kind: 'vivienda.unidad', name: 'Casa', openingHours: null });
    const h = addHousehold(world, { template: 'single', dwellingId: dwelling });
    const adult = addPerson(world, { name: { given: 'Ana', family: ['Rojas', 'Gómez'] }, sex: 'F', birthplace: 'co.cali', householdId: h });
    const child = addPerson(world, { name: { given: 'Leo', family: ['Rojas', 'Gómez'] }, sex: 'M', birthplace: 'co.cali', householdId: h });
    world.components.i32['demo.birthMinute']![idNumber(adult)] = -30 * 365 * DAY;
    world.components.i32['demo.birthMinute']![idNumber(child)] = -8 * 365 * DAY;
    initRules(world);
    return { world, adult, child };
  };

  it('las personas de 12 años o más reciben las reglas de su rutina con el aporte del número fijo de la 040', () => {
    const { world, adult, child } = build();
    const rules = world.citizens.get(adult)!.rules!;
    expect(rules.map((r) => r.resp)).toEqual(ROUTINE_RULES.map((x) => routineResponse(x.activity)));
    expect(rules.map((r) => ruleContribution(r))).toEqual(ROUTINE_RULES.map((x) => x.s));
    expect(rules.map((r) => kindOf(r))).toEqual(ROUTINE_RULES.map((x) => (x.tracking ? 'tracking' : 'pliance')));
    expect(world.citizens.get(adult)!.network!.e.length).toBe(ROUTINE_RULES.length);
    expect(world.citizens.get(child)!.rules).toBeUndefined();
  });

  it('CA-004: JOB_HIRED confirma la regla de buscar empleo (contraste a 0)', () => {
    const { world, adult } = build();
    const rule = world.citizens.get(adult)!.rules!.find((r) => r.resp === routineResponse('job_search'))!;
    rule.contrast = 0.5;
    const hired: WorldEvent = {
      id: 'EVT-00000000009' as EntityId,
      type: 'JOB_HIRED',
      at: 600,
      participants: [{ id: adult, role: 'empleado' }],
      importance: 0.5,
      payload: {},
      causes: [],
      origin: 'engine',
    };
    const out = rulesSystem.run(world as unknown as WorldView, { now: 600, citizens: [idNumber(adult)], level: 2, events: [hired] } as unknown as TickCtx, undefined as never);
    const rules = (out.patches![0] as { fields: Record<string, unknown> }).fields.rules as Rule[];
    const after = rules.find((r) => r.resp === routineResponse('job_search'))!;
    expect(after.contrast).toBe(0);
    expect(after.hist.byContingency).toBe(2);
  });
});
