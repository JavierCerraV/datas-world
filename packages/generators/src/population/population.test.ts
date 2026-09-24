import {
  ageInYears,
  createRng,
  createWorld,
  idNumber,
  profileNumber,
  profileValue,
  stateHash,
} from '@datas-world/engine';
import type { EntityId, World, WorldConfig } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { loadCatalogs } from '../catalogs/load.ts';
import { DEFAULT_PROFILE, PROTOTYPE_PROFILE, loadProfile } from '../country/profile.ts';
import { generateGeography } from '../geography/generate.ts';
import { generatePlaces } from '../places/generate.ts';
import { generatePopulation } from './generate.ts';

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

export function buildPopulation(profileId = DEFAULT_PROFILE, seed = 482917, target?: number) {
  const profile = loadProfile(profileId);
  const t = target ?? profileNumber(profile, 'gen.population.target', '2026-01-01');
  const { world } = createWorld({ ...base, seed, profile, population: { target: t } });
  const territory = generateGeography(world, { placeKinds: catalogs.place_kinds });
  const places = generatePlaces(world, territory, catalogs.place_kinds);
  const pop = generatePopulation(world, territory, places, catalogs, createRng(seed));
  return { world, territory, pop, profile };
}

const ageOf = (w: World, id: EntityId) =>
  ageInYears(w.components.i32['demo.birthMinute']![idNumber(id)]!, w.now, w.config.epoch);
const share = (xs: number[], f: (a: number) => boolean) => xs.filter(f).length / xs.length;

describe('spec 007/008: población de Data’s World (perfil colombiano)', () => {
  const { world, pop, profile } = buildPopulation();
  const ages = pop.citizenIds.map((id) => ageOf(world, id));
  const households = pop.householdIds.map((h) => world.households.get(h)!);

  it('007 CA-004: con population.target = 200 se generan entre 190 y 200 personas (los hogares no se parten)', () => {
    expect(pop.citizenIds.length).toBeGreaterThanOrEqual(190);
    expect(pop.citizenIds.length).toBeLessThanOrEqual(200);
  });

  it('008 CA-001: INV-002 (una persona, un hogar; todo hogar con un adulto) e INV-003 (edades del parentesco)', () => {
    const seen = new Map<EntityId, EntityId>();
    for (const h of households) {
      expect(
        h.memberIds.some((m) => ageOf(world, m) >= 18),
        h.id,
      ).toBe(true);
      for (const m of h.memberIds) {
        expect(seen.has(m), m).toBe(false);
        seen.set(m, h.id);
        expect(world.citizens.get(m)!.householdId).toBe(h.id);
      }
      for (const k of h.kinship) {
        const gap = ageOf(world, k.from) - ageOf(world, k.to);
        if (k.kind === 'parent') expect(gap, `${k.from}→${k.to}`).toBeGreaterThanOrEqual(15);
        if (k.kind === 'grandparent') expect(gap, `${k.from}→${k.to}`).toBeGreaterThanOrEqual(30);
      }
    }
    expect(seen.size).toBe(pop.citizenIds.length);
  });

  it('007 CA-002: todo menor vive con al menos un adulto', () => {
    for (const id of pop.citizenIds) {
      if (ageOf(world, id) >= 18) continue;
      const h = world.households.get(world.citizens.get(id)!.householdId!)!;
      expect(h.memberIds.some((m) => ageOf(world, m) >= 18)).toBe(true);
    }
  });

  it('008 CA-003: en los hogares extendidos con menores, el abuelo o la abuela es cuidador', () => {
    const ext = households.filter((h) => h.template === 'extended' && h.memberIds.some((m) => ageOf(world, m) < 18));
    expect(ext.length).toBeGreaterThan(0);
    for (const h of ext) {
      const grand = h.kinship.find((k) => k.kind === 'grandparent')!.from;
      expect(h.caregiverIds).toContain(grand);
    }
  });

  it('pensión solo desde la edad legal según el sexo (spec 029)', () => {
    const pAge = profileValue(profile, 'pension.age', '2026-01-01') as Record<string, number>;
    for (const id of pop.citizenIds) {
      if (world.components.u8['demo.pensioned']![idNumber(id)])
        expect(ageOf(world, id)).toBeGreaterThanOrEqual(pAge[world.citizens.get(id)!.sex!]!);
    }
    expect(ages.length).toBe(pop.citizenIds.length);
    expect(households.length).toBe(pop.householdIds.length);
  });

  it('008 R-002: los hijos llevan el primer apellido del padre y el primero de la madre', () => {
    for (const h of households.filter((x) => x.template === 'couple_kids')) {
      const parents = h.kinship.filter((k) => k.kind === 'partner')[0]!;
      const father = world.citizens.get(parents.from)!.name!;
      const mother = world.citizens.get(parents.to)!.name!;
      for (const k of h.kinship.filter((x) => x.kind === 'parent' && x.from === parents.from)) {
        expect(world.citizens.get(k.to)!.name!.family).toEqual([father.family[0], mother.family[0]]);
      }
    }
  });

  it('007 INV-003: la trayectoria previa solo tiene eventos anteriores al presente en los que la persona participa', () => {
    const byId = new Map(pop.events.map((e) => [e.id, e]));
    for (const id of pop.citizenIds) {
      const back = world.citizens.get(id)!.backstory!;
      if (ageOf(world, id) >= 8) expect(back.length).toBeGreaterThan(0);
      let prev = -Infinity;
      for (const ev of back) {
        const e = byId.get(ev)!;
        expect(e.at).toBeLessThan(0);
        expect(e.at).toBeGreaterThanOrEqual(prev);
        expect(e.participants.some((p) => p.id === id)).toBe(true);
        prev = e.at;
      }
    }
    expect(pop.events.every((e) => e.causes.length > 0)).toBe(true);
  });

  it('un hogar con hijos se forma antes del nacimiento del hijo mayor (y no después de que un hijo adulto cumpla 18)', () => {
    const birth = (id: EntityId) => world.components.i32['demo.birthMinute']![idNumber(id)]!;
    for (const h of households.filter((x) => x.template === 'couple_kids' || x.template === 'single_parent')) {
      const formed = pop.events.find(
        (e) => e.type === 'HOUSEHOLD_FORMED' && (e.payload as { householdId: string }).householdId === h.id,
      )!;
      const kids = h.kinship.filter((k) => k.kind === 'parent').map((k) => birth(k.to));
      if (kids.length > 0) expect(formed.at, h.id).toBeLessThanOrEqual(Math.min(...kids));
    }
  });

  it('007 R-009: apariencia coherente con sexo y edad (colitas ≤ 13, calvo solo hombres ≥ 35, barba solo hombres adultos)', () => {
    const u8 = world.components.u8;
    for (const id of pop.citizenIds) {
      const row = idNumber(id);
      const { sex } = world.citizens.get(id)!;
      const age = ageOf(world, id);
      expect(u8['look.skin']![row]).toBeGreaterThanOrEqual(1);
      expect(u8['look.skin']![row]).toBeLessThanOrEqual(5);
      if (u8['look.hairStyle']![row] === 4) expect(age).toBeLessThanOrEqual(13);
      if (u8['look.hairStyle']![row] === 7) expect(sex === 'M' && age >= 35).toBe(true);
      if (u8['look.beard']![row]) expect(sex === 'M' && age >= 18).toBe(true);
    }
  });

  it('cada persona tiene personalidad y datos: educación acorde a su edad, estudiante de 5 a 17, ahorro solo adultos', () => {
    const { u8, i32, f32 } = world.components;
    for (const id of pop.citizenIds) {
      const row = idNumber(id);
      const age = ageOf(world, id);
      expect(f32['pers.openness']![row]).not.toBe(0.5); // la columna nace en 0,5
      expect(u8['demo.student']![row]).toBe(age >= 5 && age < 18 ? 1 : 0);
      if (age < 18) expect(i32['money']![row]).toBe(0);
      if (age < 11) expect(u8['demo.education']![row]).toBe(0);
    }
  });
});

describe('determinismo y perfiles', () => {
  it('001 CA-005 y 007 CA-001: la misma semilla da el mismo mundo; otra semilla, otro', () => {
    const a = buildPopulation();
    expect(stateHash(a.world)).toBe(stateHash(buildPopulation().world));
    expect(stateHash(buildPopulation(DEFAULT_PROFILE, 7).world)).not.toBe(stateHash(a.world));
  });

  it('perfil prototipo: unas 60 personas con los hogares y edades del prototipo', () => {
    const { pop, world } = buildPopulation(PROTOTYPE_PROFILE);
    expect(pop.citizenIds.length).toBeGreaterThanOrEqual(54);
    expect(pop.citizenIds.length).toBeLessThanOrEqual(60);
    for (const h of pop.householdIds.map((id) => world.households.get(id)!)) expect(h.template).not.toBe('roommates');
    for (const id of pop.citizenIds) {
      const pensioned = world.components.u8['demo.pensioned']![idNumber(id)];
      expect(pensioned).toBe(ageOf(world, id) >= 65 ? 1 : 0);
    }
  });
});

// Un pueblo de 200 personas agrupadas en hogares varía ±5 puntos respecto al país (efecto de conglomerado):
// los criterios estadísticos se comprueban sobre el agregado de 20 mundos (propuesta v0.5 de las specs 007 y 008).
describe('estadística agregada de 20 mundos (perfil colombiano)', () => {
  const world20 = (seeds: number[]) =>
    seeds.map((s) => {
      const b = buildPopulation(DEFAULT_PROFILE, s);
      return {
        ages: b.pop.citizenIds.map((id) => ageOf(b.world, id)),
        templates: b.pop.householdIds.map((h) => b.world.households.get(h)!.template),
      };
    });
  const A = world20(Array.from({ length: 20 }, (_, i) => i + 1));
  const B = world20(Array.from({ length: 20 }, (_, i) => i + 101));
  const ages = A.flatMap((w) => w.ages);
  const templates = A.flatMap((w) => w.templates);
  const profile = loadProfile(DEFAULT_PROFILE);
  const at = '2026-01-01';
  const dane = {
    u12: profileNumber(profile, 'demo.share.age0to11', at),
    t12: profileNumber(profile, 'demo.share.age12to17', at),
    o60: profileNumber(profile, 'demo.share.age60plus', at),
  };
  const shares = (xs: number[]) => ({
    u12: share(xs, (a) => a < 12),
    t12: share(xs, (a) => a >= 12 && a < 18),
    o60: share(xs, (a) => a >= 60),
  });

  it('007 CA-007: en el agregado, las proporciones por edad están a ±0,03 del DANE; en cada pueblo, a ±0,10', () => {
    const agg = shares(ages);
    for (const k of ['u12', 't12', 'o60'] as const) expect(Math.abs(agg[k] - dane[k]), k).toBeLessThanOrEqual(0.03);
    for (const w of A) {
      const s = shares(w.ages);
      for (const k of ['u12', 't12', 'o60'] as const) expect(Math.abs(s[k] - dane[k]), k).toBeLessThanOrEqual(0.1);
    }
  });

  it('007 CA-001: la pirámide agregada (6 grupos) difiere < 0,03 por grupo de la de otras 20 semillas', () => {
    const groups = (xs: number[]) =>
      [0, 12, 18, 30, 45, 60].map((lo, i, arr) => share(xs, (a) => a >= lo && a < (arr[i + 1] ?? 200)));
    const ga = groups(ages);
    const gb = groups(B.flatMap((w) => w.ages));
    ga.forEach((v, i) => expect(Math.abs(v - gb[i]!), `grupo ${i}`).toBeLessThanOrEqual(0.03));
  });

  it('008 CA-002: en el agregado, cada plantilla está a ±0,03 de su peso', () => {
    const w = profileValue(profile, 'gen.household.templateWeights', at) as Record<string, number>;
    for (const [tpl, weight] of Object.entries(w)) {
      expect(Math.abs(templates.filter((t) => t === tpl).length / templates.length - weight), tpl).toBeLessThanOrEqual(
        0.03,
      );
    }
  });

  it('008 CA-006: en el agregado, tamaño medio 2,82 ± 0,15 y tipologías del DANE ± 0,05', () => {
    expect(
      Math.abs(ages.length / templates.length - profileNumber(profile, 'household.meanSize', at)),
    ).toBeLessThanOrEqual(0.15);
    const t = (f: (tpl: string) => boolean) => templates.filter(f).length / templates.length;
    const ext = t((x) => x === 'extended');
    // Biparental ≈ parejas (con o sin hijos) + 2/3 de los extendidos; monoparental ≈ monoparentales + 1/3 (spec 008 §8).
    expect(
      Math.abs(t((x) => x === 'single') - profileNumber(profile, 'household.share.unipersonal', at)),
    ).toBeLessThanOrEqual(0.05);
    expect(
      Math.abs(
        t((x) => x === 'couple' || x === 'couple_kids') +
          (2 / 3) * ext -
          profileNumber(profile, 'household.share.biparental', at),
      ),
    ).toBeLessThanOrEqual(0.05);
    expect(
      Math.abs(t((x) => x === 'single_parent') + ext / 3 - profileNumber(profile, 'household.share.monoparental', at)),
    ).toBeLessThanOrEqual(0.05);
    expect(
      Math.abs(t((x) => x === 'roommates') - profileNumber(profile, 'household.share.otros', at)),
    ).toBeLessThanOrEqual(0.05);
  });
});
