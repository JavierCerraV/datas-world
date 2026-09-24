import { createRng, createWorld, profileNumber, stateHash } from '@datas-world/engine';
import type { WorldConfig } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { loadCatalogs } from '../catalogs/load.ts';
import { DEFAULT_PROFILE, PROTOTYPE_PROFILE, loadProfile } from '../country/profile.ts';
import { generateGeography } from '../geography/generate.ts';
import { generatePlaces } from '../places/generate.ts';
import { generateOrganizations, worldDate } from './generate.ts';

const catalogs = loadCatalogs();
const base: WorldConfig = {
  name: "Data's World",
  seed: 482917,
  epoch: '2026-01-01T00:00',
  tickMinutes: 5,
  currency: { code: 'COP', minorUnit: 1 },
  population: { target: 200 },
  engineVersion: '0.2.0',
  params: {},
  initialCapabilities: ['clock'],
  holidays: [],
};

function build(profileId = DEFAULT_PROFILE, seed = 482917) {
  const profile = loadProfile(profileId);
  const { world } = createWorld({ ...base, seed, profile });
  const territory = generateGeography(world, { placeKinds: catalogs.place_kinds });
  const places = generatePlaces(world, territory, catalogs.place_kinds);
  const rng = createRng(seed).fork('gen:orgs');
  const ids = generateOrganizations(world, places.workplaceIds, catalogs, rng, {
    prototype: profileId === PROTOTYPE_PROFILE,
  });
  const orgs = ids.map((id) => world.organizations.get(id)!);
  return { world, orgs, profile };
}

const hours = (s: { days: string; start: number; end: number; lunch: number }) =>
  ((s.end - s.start - s.lunch) * (s.days === 'mon-fri' ? 5 : 6)) / 60;

describe('spec 006: organizaciones (sin contratación)', () => {
  it('una organización por lugar de trabajo, 45 puestos, sector CIIU y ocupaciones CIUO del catálogo', () => {
    const { orgs } = build();
    expect(orgs.map((o) => [o.name, o.positions.length])).toEqual([
      ['Colegio Los Alisos', 4],
      ['Gimnasio Forja', 2],
      ['Café Data', 3],
      ['Restaurante La Mesa', 3],
      ['Oficinas Andina', 12],
      ['Hospital San Rafael', 6],
      ['Tienda El Surtidor', 3],
      ['Textiles del Sur', 12],
    ]);
    const sectors = new Set(catalogs.org_sectors.entries.map((e) => e.key));
    const occ = new Set(catalogs.occupations.entries.map((e) => e.key));
    for (const o of orgs) {
      expect(sectors.has(o.sector), o.sector).toBe(true);
      for (const p of o.positions) expect(occ.has(p.occupation), p.occupation).toBe(true);
    }
    expect(orgs.find((o) => o.name === 'Textiles del Sur')!.sector).toBe('ciiu.1410');
  });

  it('CA-002 (en parte): cada organización tiene un puesto de jefe (nivel 1) y el resto le reporta', () => {
    for (const o of build().orgs) {
      const [boss, ...rest] = o.positions;
      expect(boss!.level).toBe(1);
      expect(rest.every((p) => p.level === 0 && p.supervisorPositionId === boss!.id)).toBe(true);
      expect(o.positions.every((p) => p.holderId === undefined)).toBe(true); // sin contratar todavía
    }
  });

  it('CA-007 (sueldos y turnos): ningún puesto formal bajo el salario mínimo; ningún turno sobre la jornada', () => {
    const { world, orgs, profile } = build();
    const min = profileNumber(profile, 'labor.minimumWageMonthly', worldDate(world));
    const max = profileNumber(profile, 'labor.maxWeeklyHours', worldDate(world));
    expect(min).toBe(1_750_905);
    for (const o of orgs) {
      for (const p of o.positions) {
        expect(p.wagePeriod).toBe('month');
        expect(p.wage, `${o.name} ${p.title}`).toBeGreaterThanOrEqual(min);
        expect(hours(p.shift)).toBeLessThanOrEqual(max);
        expect(hours(p.shift)).toBeLessThanOrEqual(42); // también después del 15-jul-2026
      }
      const [boss, ...rest] = o.positions;
      expect(boss!.wage).toBeGreaterThan(Math.min(...rest.map((p) => p.wage)));
    }
  });

  it('perfil prototipo: sueldo diario de hire (pay × 0,85–1,2; jefe × 1,6) y turnos de PDEF', () => {
    const { orgs } = build(PROTOTYPE_PROFILE);
    const office = orgs.find((o) => o.name === 'Oficinas Andina')!;
    expect(office.positions[0]!.shift).toEqual({ days: 'mon-fri', start: 480, end: 1020, lunch: 0 });
    for (const p of office.positions.slice(1)) {
      expect(p.wagePeriod).toBe('day');
      expect(p.wage).toBeGreaterThanOrEqual(136_000); // 160 000 × 0,85
      expect(p.wage).toBeLessThanOrEqual(192_000); // 160 000 × 1,2
    }
    expect(office.positions[0]!.wage).toBeGreaterThanOrEqual(Math.round((136_000 * 1.6) / 1000) * 1000);
  });

  it('determinismo: misma semilla, mismos sueldos, cultura y hash; otra semilla cambia los sueldos', () => {
    const a = build();
    const b = build();
    expect(stateHash(a.world)).toBe(stateHash(b.world));
    const c = build(DEFAULT_PROFILE, 7);
    const wages = (x: typeof a) => x.orgs.flatMap((o) => o.positions.map((p) => p.wage));
    expect(wages(c)).not.toEqual(wages(a));
    for (const o of a.orgs) for (const v of Object.values(o.culture)) expect(v >= 0 && v <= 1).toBe(true);
  });
});
