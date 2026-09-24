// Utilidades para las pruebas de los generadores. No se exportan desde index.ts.
// Montan un mundo de M1 con los pasos disponibles, en el orden de la spec 007 R-001.
import { ageInYears, createRng, createWorld, idNumber, profileNumber } from '@datas-world/engine';
import type { EntityId, World, WorldConfig, WorldEvent } from '@datas-world/engine';
import { loadCatalogs } from './catalogs/load.ts';
import { PROTOTYPE_PROFILE, loadProfile } from './country/profile.ts';
import { generateEmployment } from './employment/generate.ts';
import { generateGeography } from './geography/generate.ts';
import { generateObjects } from './objects/generate.ts';
import { generateOrganizations } from './organizations/generate.ts';
import { generatePlaces } from './places/generate.ts';
import { sortBackstories } from './population/backstory.ts';
import { generatePopulation } from './population/generate.ts';

export const catalogs = loadCatalogs();

export const baseConfig: WorldConfig = {
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

export function buildWorld(profileId: string, seed: number) {
  const profile = loadProfile(profileId);
  const target = profileNumber(profile, 'gen.population.target', '2026-01-01');
  const { world } = createWorld({ ...baseConfig, seed, profile, population: { target } });
  const rng = createRng(seed);
  const territory = generateGeography(world, { placeKinds: catalogs.place_kinds });
  const places = generatePlaces(world, territory, catalogs.place_kinds);
  const orgIds = generateOrganizations(world, places.workplaceIds, catalogs, rng.fork('gen:orgs'), {
    prototype: profileId === PROTOTYPE_PROFILE,
  });
  const pop = generatePopulation(world, territory, places, catalogs, rng);
  const emp = generateEmployment(world, pop.citizenIds, orgIds, catalogs, rng);
  const objs = generateObjects(world, pop.citizenIds, pop.householdIds, catalogs.object_kinds, rng);
  const events: WorldEvent[] = [...pop.events, ...emp.events, ...objs.events];
  sortBackstories(world, events);
  return { world, territory, places, orgIds, pop, events, objectIds: objs.objectIds, profile };
}

export const ageOf = (w: World, id: EntityId): number =>
  ageInYears(w.components.i32['demo.birthMinute']![idNumber(id)]!, w.now, w.config.epoch);
