import { describe, expect, it } from 'vitest';
import { defineColumn } from '../components.ts';
import { hire, setOccupation } from '../employment.ts';
import type { WorldEvent } from '../events.ts';
import { idNumber } from '../ids.ts';
import { initNeeds } from '../needs/columns.ts';
import { needsSystem } from '../needs/system.ts';
import { createRng } from '../rng.ts';
import { Runner } from '../runner.ts';
import { stateHash } from '../serialize.ts';
import { createRegistry } from '../simulation/registry.ts';
import { TEST_PROFILE, testConfig } from '../testing.ts';
import { addHousehold, addOrganization, addPerson, addPlace, createWorld } from '../world.ts';
import type { World } from '../world.ts';
import { defineEconomyColumns } from './columns.ts';
import { economyParams } from './params.ts';
import { loanTerms, quincena, utilityBill } from './rules.ts';
import { economySystem, totalMoney } from './system.ts';

const P = economyParams(TEST_PROFILE, '2027-02-01')!;
const SMMLV = 1_750_905;
const DAY = 1440;

/** Un barrio de estrato 3 con una tienda y una oficina; hogares de adultos a medida. */
function town(seed = 1) {
  const { world } = createWorld(testConfig({ epoch: '2027-02-01T00:00', initialCapabilities: ['clock', 'needs', 'economy'], profile: TEST_PROFILE, seed }));
  const c = world.components;
  defineColumn(c, 'i32', 'demo.birthMinute', 0);
  defineColumn(c, 'i32', 'money', 0);
  defineColumn(c, 'u8', 'demo.pensioned', 0);
  defineColumn(c, 'u8', 'health.insurance', 1);
  defineColumn(c, 'u8', 'health.acute', 0);
  defineEconomyColumns(world);
  world.accounts = { restOfCountry: 0 };
  const district = addPlace(world, { kind: 'territorio.barrio', name: 'Centro', stratum: 3 });
  const shopPlace = addPlace(world, { kind: 'comercio.tienda_barrio', name: 'Tienda', districtId: district });
  const office = addPlace(world, { kind: 'servicios.oficina', name: 'Oficinas', districtId: district });
  const shop = addOrganization(world, {
    name: 'Tienda', sector: 'ciiu.4711', placeIds: [shopPlace], culture: { strictness: 0.5, warmth: 0.5, stability: 0.5 },
    positions: [{ title: 'Tendero', level: 0, occupation: 'ciuo.5223', wage: SMMLV, wagePeriod: 'month', shift: { days: 'mon-sat', start: 540, end: 960, lunch: 0 } }],
  });
  const org = addOrganization(world, {
    name: 'Oficinas', sector: 'ciiu.7020', placeIds: [office], culture: { strictness: 0.5, warmth: 0.5, stability: 0.5 },
    positions: Array.from({ length: 4 }, () => ({ title: 'Oficinista', level: 0, occupation: 'ciuo.4110', wage: SMMLV, wagePeriod: 'month' as const, shift: { days: 'mon-fri' as const, start: 480, end: 1020, lunch: 60 } })),
  });
  world.organizations.get(org)!.cash = 20_000_000;
  world.organizations.get(shop)!.cash = 2_000_000;
  let n = 0;
  let pos = 0;
  /** Un hogar de una persona adulta en arriendo, con su situación, saldo y ahorro. */
  const household = (o: { job: 'formal' | 'unemployed' | 'informal'; money: number; savings: number; rent: number }) => {
    const dwelling = addPlace(world, { kind: 'vivienda.unidad', name: `Vivienda ${++n}`, districtId: district, openingHours: null });
    const h = addHousehold(world, { template: 'single', dwellingId: dwelling });
    const id = addPerson(world, { name: { given: 'Ana', family: ['Rojas', 'Gómez'] }, sex: 'F', birthplace: 'co.cali', householdId: h });
    const row = idNumber(id);
    c.i32['demo.birthMinute']![row] = -35 * 365 * DAY;
    c.i32.money![row] = o.money;
    if (o.job === 'formal') hire(world, id, org, `${org}/P${String(++pos).padStart(2, '0')}`);
    else if (o.job === 'informal') setOccupation(world, id, { kind: 'informal', trade: 'oficio.ventas' });
    else setOccupation(world, id, { kind: 'none', reason: 'unemployed', since: 0 });
    Object.assign(world.households.get(h)!, { tenure: 'arriendo', rent: o.rent, savings: o.savings });
    return { id, row, h };
  };
  return { world, household, org };
}

const run = (world: World, days: number, extra = false) => {
  const r = new Runner(world, createRng(1), {}, { systems: createRegistry(extra ? [needsSystem, economySystem] : [economySystem]) });
  r.advanceDays(days);
  return r.drainEvents();
};

describe('spec 015: economía', () => {
  it('CA-004: con 1 salario mínimo, cada quincena es (salario − 8 %)/2 + auxilio/2, exacta al peso y el mes cuadra', () => {
    const q1 = quincena(P, SMMLV, 1);
    const q2 = quincena(P, SMMLV, 2);
    const monthly = SMMLV - 2 * Math.round(SMMLV * 0.04) + 249_095;
    expect(q1.net + q2.net).toBe(monthly);
    expect(Math.abs(q1.net - (SMMLV * 0.92 + 249_095) / 2)).toBeLessThanOrEqual(1);
    expect(Number.isInteger(q1.net) && Number.isInteger(q2.net)).toBe(true);
    expect(quincena(P, 3 * SMMLV, 1).allowance).toBe(0); // más de 2 salarios mínimos: sin auxilio
  });

  it('CA-005: con el mismo consumo, el estrato 2 paga menos que la tarifa plena y el 5 más, según el perfil', () => {
    const full = utilityBill(P, 4, 3);
    expect(utilityBill(P, 2, 3)).toBe(Math.round(full * (1 - 0.5)));
    expect(utilityBill(P, 5, 3)).toBe(Math.round(full * 1.2));
    expect(utilityBill(P, 2, 3)).toBeLessThan(utilityBill(P, 5, 3));
  });

  it('préstamos: banco con cuota mensual de anualidad; gota a gota con cuota diaria y 20 % de interés al mes', () => {
    const b = loanTerms(P, 'banco', 730_000);
    expect(b.principal).toBe(800_000);
    expect(b.total).toBe(b.installment * 12);
    const g = loanTerms(P, 'gota_a_gota', 120_000);
    expect(g.principal).toBe(150_000);
    expect(g.total).toBe(180_000);
    expect(g.installment).toBe(6_000);
  });

  it('CA-001 (motor): la suma de todos los saldos no cambia en 60 días, con quincenas, gastos, préstamos e impagos', () => {
    const t = town();
    t.household({ job: 'formal', money: 300_000, savings: 500_000, rent: 700_000 });
    t.household({ job: 'informal', money: 100_000, savings: 0, rent: 500_000 });
    t.household({ job: 'unemployed', money: 50_000, savings: 0, rent: 600_000 });
    initNeeds(t.world, createRng(3));
    const before = totalMoney(t.world);
    const events = run(t.world, 60, true);
    expect(totalMoney(t.world)).toBe(before);
    const types = new Set(events.map((e) => e.type));
    for (const x of ['SALARY_PAID', 'RENT_PAID', 'DEBT_TAKEN', 'PAYMENT_MISSED']) expect(types.has(x as WorldEvent['type']), x).toBe(true);
  });

  it('R-004: el déficit se cubre con el ahorro, luego el banco (con empleo formal) y luego el gota a gota', () => {
    const t = town();
    const formal = t.household({ job: 'formal', money: 0, savings: 100_000, rent: 900_000 });
    const informal = t.household({ job: 'unemployed', money: 0, savings: 100_000, rent: 900_000 });
    const events = run(t.world, 6);
    const taken = events.filter((e) => e.type === 'DEBT_TAKEN').map((e) => e.payload as { citizenId: string; creditor: string });
    expect(taken.find((x) => x.citizenId === formal.id)?.creditor).toBe('banco');
    expect(taken.find((x) => x.citizenId === informal.id)?.creditor).toBe('gota_a_gota');
    expect(t.world.households.get(formal.h)!.savings).toBe(0); // el ahorro se usa primero
    expect(t.world.citizens.get(informal.id)!.debts!.length).toBeGreaterThan(0);
    expect(t.world.components.i32['econ.debt']![informal.row]).toBeGreaterThan(0);
  });

  it('008 CA-004: un hogar sin ingresos durante 2 meses se atrasa en el arriendo (RENT_LATE) y sube el estrés de sus adultos', () => {
    const t = town();
    const poor = t.household({ job: 'unemployed', money: 0, savings: 0, rent: 800_000 });
    initNeeds(t.world, createRng(2));
    const stress0 = t.world.components.f32['state.stress']![poor.row]!;
    const events = run(t.world, 62, true);
    const late = events.filter((e) => e.type === 'RENT_LATE');
    expect(late.length).toBeGreaterThan(0);
    expect((late[0]!.payload as { householdId: string }).householdId).toBe(poor.h);
    expect(t.world.components.u8['econ.debtPressure']![poor.row]).toBe(1);
    expect(t.world.components.f32['state.stress']![poor.row]!).toBeGreaterThan(stress0);
  });

  it('determinismo: misma semilla, mismo hash tras 40 días', () => {
    const a = town();
    const b = town();
    for (const t of [a, b]) {
      t.household({ job: 'formal', money: 300_000, savings: 500_000, rent: 700_000 });
      t.household({ job: 'informal', money: 100_000, savings: 0, rent: 500_000 });
    }
    run(a.world, 40);
    run(b.world, 40);
    expect(stateHash(a.world)).toBe(stateHash(b.world));
  });

  it('sin cuentas del sistema (mundos sin economía) el sistema no hace nada', () => {
    const t = town();
    t.household({ job: 'formal', money: 300_000, savings: 0, rent: 700_000 });
    delete (t.world as { accounts?: unknown }).accounts;
    const events = run(t.world, 3);
    expect(events.filter((e) => e.type !== 'DAY_STARTED')).toEqual([]); // solo el reloj
    expect(t.world.components.i32.money![1]).toBe(300_000); // el dinero no se mueve
  });
});
