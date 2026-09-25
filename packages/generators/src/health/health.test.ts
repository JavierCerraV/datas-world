import { idNumber, profileNumber, profileValue } from '@datas-world/engine';
import type { EntityId, World } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, PROTOTYPE_PROFILE, loadProfile } from '../country/profile.ts';
import { ageOf, buildWorld, catalogs } from '../testing.ts';
import { INSURANCE } from './params.ts';

const YEAR = 365 * 1440;
const at = '2026-01-01';
const profile = loadProfile(DEFAULT_PROFILE);
const u8 = (w: World, name: string, id: EntityId) => w.components.u8[name]![idNumber(id)]!;

describe('spec 031: ficha de salud de un mundo (perfil colombiano)', () => {
  const { world, pop, events } = buildWorld(DEFAULT_PROFILE, 482917);
  const byId = new Map(events.map((e) => [e.id, e]));

  it('CA-003 INV-001 e INV-004: valores en rango; los menores de 15 no fuman ni beben', () => {
    for (const id of pop.citizenIds) {
      expect(u8(world, 'health.insurance', id)).toBeLessThanOrEqual(4);
      expect(u8(world, 'health.bmiClass', id)).toBeLessThanOrEqual(3);
      expect(u8(world, 'health.tobacco', id)).toBeLessThanOrEqual(2);
      expect(u8(world, 'health.alcohol', id)).toBeLessThanOrEqual(3);
      expect(u8(world, 'health.activityDays', id)).toBeLessThanOrEqual(7);
      const sleep = u8(world, 'health.sleepHours', id);
      expect(sleep >= 4 && sleep <= 10).toBe(true);
      expect(u8(world, 'health.disability', id)).toBeLessThan(128);
      const phys = world.components.f32['health.physical']![idNumber(id)]!;
      expect(phys >= 0.05 && phys <= 1 && !Number.isNaN(phys)).toBe(true);
      if (ageOf(world, id) < 15) {
        expect(u8(world, 'health.tobacco', id)).toBe(0);
        expect(u8(world, 'health.alcohol', id)).toBe(0);
      }
    }
  });

  it('CA-003 INV-002: un empleado formal cotiza (contributivo o especial); un beneficiario tiene su cotizante en el hogar', () => {
    for (const id of pop.citizenIds) {
      const c = world.citizens.get(id)!;
      const ins = u8(world, 'health.insurance', id);
      if (c.occupation?.kind === 'formal') expect([INSURANCE.contributor, INSURANCE.special]).toContain(ins);
      if (ins === INSURANCE.beneficiary) {
        const h = world.households.get(c.householdId!)!;
        expect(h.memberIds.some((m) => m !== id && u8(world, 'health.insurance', m) === INSURANCE.contributor)).toBe(true);
      }
      if (ins !== INSURANCE.none) {
        const e = c.backstory!.map((x) => byId.get(x)!).find((x) => x.type === 'HEALTH_INSURANCE_SET');
        expect(e, id).toBeDefined();
        expect(e!.causes.length).toBeGreaterThan(0);
      }
    }
  });

  it('CA-003 INV-003: cada condición existe en el catálogo, es posterior a su edad mínima y anterior al presente, con su diagnóstico', () => {
    const minAge = new Map(catalogs.health_conditions.entries.map((e) => [e.key, (e.attrs as { minAge: number }).minAge]));
    for (const id of pop.citizenIds) {
      const c = world.citizens.get(id)!;
      const birth = world.components.i32['demo.birthMinute']![idNumber(id)]!;
      for (const h of c.conditions ?? []) {
        expect(minAge.has(h.key)).toBe(true);
        expect(h.since).toBeLessThan(0);
        expect(h.since).toBeGreaterThanOrEqual(birth + minAge.get(h.key)! * YEAR);
        const e = c.backstory!.map((x) => byId.get(x)!).find(
          (x) => x.type === 'CONDITION_DIAGNOSED' && (x.payload as { condition: string }).condition === h.key,
        );
        expect(e?.at).toBe(h.since);
        expect(e!.causes.length).toBeGreaterThan(0);
      }
    }
  });

  it('CA-005: la misma semilla da la misma ficha', () => {
    const again = buildWorld(DEFAULT_PROFILE, 482917).world;
    for (const id of pop.citizenIds) {
      expect(again.citizens.get(id)!.conditions).toEqual(world.citizens.get(id)!.conditions);
      for (const col of ['health.insurance', 'health.bmiClass', 'health.tobacco', 'health.disability'])
        expect(u8(again, col, id)).toBe(u8(world, col, id));
    }
  });

  it('el perfil prototipo no tiene ficha de salud (paridad)', () => {
    const { world: w } = buildWorld(PROTOTYPE_PROFILE, 482917);
    expect('health.insurance' in w.components.u8).toBe(false);
  });
});

describe('spec 031: agregado de 20 mundos frente al perfil', () => {
  const t = { n: 0, ins: [0, 0, 0, 0, 0], a1864: 0, excess: 0, n12: 0, smoke: 0, dis: 0, hta: 0, dm: 0 };
  const phys = { young: [] as number[], old: [] as number[], byConditions: new Map<number, number[]>() };
  for (let s = 1; s <= 20; s++) {
    const { world, pop } = buildWorld(DEFAULT_PROFILE, s);
    for (const id of pop.citizenIds) {
      const a = ageOf(world, id);
      const p = world.components.f32['health.physical']![idNumber(id)]!;
      const conds = world.citizens.get(id)!.conditions ?? [];
      t.n++;
      t.ins[u8(world, 'health.insurance', id)]!++;
      if (a >= 18 && a < 65) {
        t.a1864++;
        if (u8(world, 'health.bmiClass', id) >= 2) t.excess++;
      }
      if (a >= 12 && a <= 65) {
        t.n12++;
        if (u8(world, 'health.tobacco', id) === 2) t.smoke++;
      }
      if (u8(world, 'health.disability', id)) t.dis++;
      if (conds.some((c) => c.key === 'cronica.hipertension')) t.hta++;
      if (conds.some((c) => c.key === 'cronica.diabetes_2')) t.dm++;
      if (a >= 18 && a < 40) phys.young.push(p);
      if (a >= 60) phys.old.push(p);
      if (a >= 18) phys.byConditions.set(Math.min(conds.length, 2), [...(phys.byConditions.get(Math.min(conds.length, 2)) ?? []), p]);
    }
  }
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

  it('CA-001: la afiliación agregada está a ±0,05 del perfil', () => {
    const share = profileValue(profile, 'health.insurance.share', at) as Record<string, number>;
    const f = (k: number) => t.ins[k]! / t.n;
    expect(Math.abs(f(INSURANCE.contributor) + f(INSURANCE.beneficiary) - share.contributivo!)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(f(INSURANCE.subsidized) - share.subsidiado!)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(f(INSURANCE.special) - share.especial!)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(f(INSURANCE.none) - share.sin!)).toBeLessThanOrEqual(0.05);
  });

  it('CA-002: hipertensión, diabetes, exceso de peso, tabaquismo y discapacidad a ±0,04 del perfil', () => {
    const bmi = profileValue(profile, 'health.bmi.adult', at) as Record<string, number>;
    expect(Math.abs(t.hta / t.n - profileNumber(profile, 'health.hypertension.prevalence', at))).toBeLessThanOrEqual(0.04);
    expect(Math.abs(t.dm / t.n - profileNumber(profile, 'health.diabetes.prevalence', at))).toBeLessThanOrEqual(0.04);
    expect(Math.abs(t.excess / t.a1864 - (bmi.overweight! + bmi.obese!))).toBeLessThanOrEqual(0.04);
    expect(Math.abs(t.smoke / t.n12 - profileNumber(profile, 'health.tobacco.current', at))).toBeLessThanOrEqual(0.04);
    expect(Math.abs(t.dis / t.n - profileNumber(profile, 'health.disability.total', at))).toBeLessThanOrEqual(0.04);
  });

  it('CA-004: la salud física baja con la edad y con el número de condiciones', () => {
    expect(mean(phys.old)).toBeLessThan(mean(phys.young));
    expect(mean(phys.byConditions.get(2)!)).toBeLessThan(mean(phys.byConditions.get(0)!));
  });
});
