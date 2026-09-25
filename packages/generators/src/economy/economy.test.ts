// Economía sobre el mundo generado (spec 015): estado inicial (F2), conservación de un año (CA-001), saldo por
// estrato (CA-003) y pérdida del empleo (CA-002).
import {
  NEEDS_SYSTEMS,
  Runner,
  createActionValidator,
  createDecisionSystem,
  createRegistry,
  createRng,
  economySystem,
  idNumber,
  mobilitySystem,
  routinesSystem,
  totalMoney,
} from '@datas-world/engine';
import type { EntityId, World, WorldEvent } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '../country/profile.ts';
import { leisureTable } from '../leisure/params.ts';
import { ageOf, buildWorld, catalogs } from '../testing.ts';

const economyOnly = (w: World) => {
  w.capabilities = ['clock', 'economy'];
  return new Runner(w, createRng(1), {}, { systems: createRegistry([economySystem]) });
};
const stratumOf = (w: World, id: EntityId) => {
  const h = w.households.get(w.citizens.get(id)!.householdId!)!;
  return w.places.get(w.places.get(h.dwellingId)!.districtId!)!.stratum!;
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

describe('015 sobre el mundo generado (perfil colombiano, 200 habitantes)', () => {
  it('F2: tenencia de la ECV, arriendo por estrato, ahorro del hogar, caja de las organizaciones y resto del país', () => {
    const { world, pop } = buildWorld(DEFAULT_PROFILE, 482917);
    expect(world.accounts).toEqual({ restOfCountry: 0 });
    const hs = pop.householdIds.map((id) => world.households.get(id)!);
    const renting = hs.filter((h) => h.tenure === 'arriendo').length / hs.length;
    expect(renting).toBeGreaterThan(0.25); // ECV 2024: 40,4 % (72 hogares: tolerancia amplia)
    expect(renting).toBeLessThan(0.6);
    for (const h of hs) {
      expect(Number.isSafeInteger(h.savings)).toBe(true);
      if (h.tenure === 'arriendo' || h.tenure === 'pagando') expect(h.rent! % 10_000).toBe(0);
      else expect(h.rent).toBeUndefined();
    }
    for (const o of world.organizations.values()) if (o.positions.some((p) => p.holderId)) expect(o.cash!).toBeGreaterThan(0);
  });

  it('CA-001: un año de economía y 30 días con toda la vida diaria: la suma de todos los saldos no cambia (error 0)', () => {
    const { world } = buildWorld(DEFAULT_PROFILE, 482917);
    const before = totalMoney(world);
    const r = economyOnly(world);
    r.advanceDays(365);
    expect(totalMoney(world)).toBe(before);
    const events = r.drainEvents();
    expect(events.filter((e) => e.type === 'SALARY_PAID').length).toBeGreaterThan(500);
    // La caja de las organizaciones no crece sin tope (R-007, `maxCashMonths` = 3): el tope se aplica al entrar los
    // ingresos del día; después llegan las ventas locales de ese día, así que se admite medio mes de margen.
    for (const o of world.organizations.values()) {
      const payroll = o.positions.filter((p) => p.holderId).reduce((s, p) => s + p.wage, 0);
      if (payroll > 0) expect(o.cash!).toBeLessThanOrEqual(payroll * 3.5);
    }
    // Las cuotas atrasadas no producen un evento por día: a lo sumo el primero y uno cada 30.
    const missedFees = events.filter((e) => e.type === 'PAYMENT_MISSED' && (e.payload as { concept: string }).concept === 'cuota').length;
    const debts = events.filter((e) => e.type === 'DEBT_TAKEN').length;
    expect(missedFees).toBeLessThanOrEqual(debts * 13);

    const { world: w2 } = buildWorld(DEFAULT_PROFILE, 482917);
    w2.capabilities = ['clock', 'needs', 'routines', 'mobility', 'economy'];
    const table = leisureTable(catalogs.leisure_activities, w2.config.profile!, w2.config.epoch.slice(0, 10));
    const start = totalMoney(w2);
    new Runner(w2, createRng(1), {}, {
      systems: createRegistry([...NEEDS_SYSTEMS, routinesSystem, createDecisionSystem(table), mobilitySystem, economySystem]),
      loop: { validate: createActionValidator(table) },
    }).advanceDays(30);
    expect(totalMoney(w2)).toBe(start);
  }, 180_000);

  it('CA-003: tras 90 días, la mediana del patrimonio de los adultos (saldo − deudas) sube con el estrato', () => {
    const { world, pop } = buildWorld(DEFAULT_PROFILE, 482917);
    economyOnly(world).advanceDays(90);
    const byStratum = new Map<number, number[]>();
    for (const id of pop.citizenIds) {
      if (ageOf(world, id) < 18) continue;
      const row = idNumber(id);
      const worth = world.components.i32.money![row]! - world.components.i32['econ.debt']![row]!;
      byStratum.set(stratumOf(world, id), [...(byStratum.get(stratumOf(world, id)) ?? []), worth]);
    }
    const m = [2, 3, 4].map((s) => median(byStratum.get(s) ?? [0]));
    expect(m[0]!).toBeLessThan(m[1]!);
    expect(m[1]!).toBeLessThan(m[2]!);
  }, 60_000);

  it('CA-002: quien pierde el empleo ve bajar su saldo y en ≤ 3 meses su hogar se endeuda o gasta el ahorro', () => {
    const pick = (w: World) => {
      // Un empleado formal que es el único adulto con empleo formal de su hogar, en arriendo.
      for (const o of [...w.organizations.values()].sort((a, b) => (a.id < b.id ? -1 : 1)))
        for (const p of o.positions) {
          if (!p.holderId) continue;
          const h = w.households.get(w.citizens.get(p.holderId)!.householdId!)!;
          const formal = h.memberIds.filter((m) => w.citizens.get(m)!.occupation?.kind === 'formal');
          if (formal.length === 1 && h.tenure === 'arriendo') return { id: p.holderId, h, position: p };
        }
      throw new Error('sin candidato');
    };
    const base = buildWorld(DEFAULT_PROFILE, 482917).world;
    const fired = buildWorld(DEFAULT_PROFILE, 482917).world;
    const a = pick(base);
    const b = pick(fired);
    expect(b.id).toBe(a.id);
    delete b.position.holderId; // despido (el despido con causas llega en el bloque G, 006)
    fired.citizens.get(b.id)!.occupation = { kind: 'none', reason: 'unemployed', since: 0 };
    const savings0 = b.h.savings!;
    economyOnly(base).advanceDays(90);
    const r = economyOnly(fired);
    r.advanceDays(90);
    const events: WorldEvent[] = r.drainEvents();
    const row = idNumber(b.id);
    expect(fired.components.i32.money![row]!).toBeLessThan(base.components.i32.money![row]!);
    const members = new Set<string>(b.h.memberIds);
    const tookDebt = events.some((e) => e.type === 'DEBT_TAKEN' && members.has((e.payload as { citizenId: string }).citizenId));
    expect(tookDebt || b.h.savings! < savings0).toBe(true);
    expect(events.some((e) => e.type === 'SALARY_PAID' && (e.payload as { citizenId: string }).citizenId === b.id)).toBe(false);
  }, 60_000);
});
