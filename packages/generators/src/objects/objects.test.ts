import { objectsOf } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '../country/profile.ts';
import { ageOf, buildWorld } from '../testing.ts';

describe('spec 005: objetos iniciales', () => {
  const { world, objectIds, events } = buildWorld(DEFAULT_PROFILE, 482917);
  const byId = new Map(events.map((e) => [e.id, e]));
  const objs = objectIds.map((id) => world.objects.get(id)!);

  it('CA-002: todo objeto inicial empieza su historia con un evento de origen anterior al presente', () => {
    expect(objs.length).toBeGreaterThan(100);
    for (const o of objs) {
      const first = byId.get(o.historyEventIds[0]!)!;
      expect(['OBJECT_ACQUIRED', 'OBJECT_INHERITED']).toContain(first.type);
      expect(first.at).toBeLessThan(0);
      expect(o.fate).toBe('owned');
    }
  });

  it('CA-003: el carro es del hogar y todos sus miembros lo tienen entre sus objetos', () => {
    const cars = objs.filter((o) => o.kind === 'transporte.carro');
    expect(cars.length).toBeGreaterThan(0);
    for (const car of cars) {
      expect(car.ownerId.startsWith('HOU-')).toBe(true);
      for (const m of world.households.get(car.ownerId)!.memberIds)
        expect(objectsOf(world, m).map((o) => o.id)).toContain(car.id);
    }
  });

  it('R-004: la herencia tiene valor emocional alto para su dueño; los demás objetos superan el valor mínimo', () => {
    for (const o of objs) {
      if (o.kind === 'recuerdo.herencia') expect(o.sentimental[o.ownerId]).toBe(0.95);
      else expect(o.marketValue).toBeGreaterThanOrEqual(300_000);
      expect(o.condition >= 0 && o.condition <= 1).toBe(true);
    }
  });
});

describe('005 CA-001: proporciones agregadas de 20 mundos', () => {
  const stats = { adults: [0, 0], teens: [0, 0], bike: [0, 0], heir: [0, 0] };
  const cars: Record<string, [number, number]> = { '2': [0, 0], '3': [0, 0], '4': [0, 0] };
  for (let s = 1; s <= 20; s++) {
    const { world, pop } = buildWorld(DEFAULT_PROFILE, s);
    for (const id of pop.citizenIds) {
      const a = ageOf(world, id);
      const kinds = new Set([...world.objects.values()].filter((o) => o.ownerId === id).map((o) => o.kind));
      const count = (k: keyof typeof stats, has: boolean) => {
        const s = stats[k] as [number, number];
        s[0] += has ? 1 : 0;
        s[1] += 1;
      };
      if (a >= 18) count('adults', kinds.has('tecnologia.telefono'));
      else if (a >= 12) count('teens', kinds.has('tecnologia.telefono'));
      if (a >= 10 && a <= 59) count('bike', kinds.has('transporte.bicicleta'));
      if (a >= 25) count('heir', kinds.has('recuerdo.herencia'));
    }
    for (const h of pop.householdIds.map((x) => world.households.get(x)!)) {
      const s2 = String(world.places.get(world.places.get(h.dwellingId)!.districtId!)!.stratum);
      cars[s2]![1] += 1;
      if ([...world.objects.values()].some((o) => o.ownerId === h.id)) cars[s2]![0] += 1;
    }
  }
  const rate = ([k, n]: number[]) => k! / n!;

  it('teléfono (adultos 0,9 y de 12 a 17 0,6), bicicleta (10–59: 0,3) y herencia (25+: 0,08) a ±0,03; adolescentes a ±0,06 por ser pocos', () => {
    expect(Math.abs(rate(stats.adults) - 0.9)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(rate(stats.teens) - 0.6)).toBeLessThanOrEqual(0.06);
    expect(Math.abs(rate(stats.bike) - 0.3)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(rate(stats.heir) - 0.08)).toBeLessThanOrEqual(0.03);
  });

  it('carro del hogar según el estrato (gen.objects.carP: 0,05 · 0,2 · 0,45) a ±0,08', () => {
    expect(Math.abs(rate(cars['2']!) - 0.05)).toBeLessThanOrEqual(0.08);
    expect(Math.abs(rate(cars['3']!) - 0.2)).toBeLessThanOrEqual(0.08);
    expect(Math.abs(rate(cars['4']!) - 0.45)).toBeLessThanOrEqual(0.08);
  });
});
