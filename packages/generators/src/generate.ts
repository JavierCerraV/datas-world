// Generación completa de un mundo de M1 (specs 007 R-001 y 030 R-001): configuración con perfil, catálogos y
// festivos, y después geografía → lugares → organizaciones → población → empleo → objetos → historia.
import { ENGINE_VERSION, createRng, createWorld, idNumber, parseEpoch, profileNumber } from '@datas-world/engine';
import type { EntityId, World, WorldConfig, WorldEvent } from '@datas-world/engine';
import { catalogRefs, loadCatalogs } from './catalogs/load.ts';
import type { Catalogs } from './catalogs/load.ts';
import { holidayDates } from './country/holidays.ts';
import { DEFAULT_PROFILE, PROTOTYPE_PROFILE, loadProfile } from './country/profile.ts';
import { generateEmployment } from './employment/generate.ts';
import { generateGeography } from './geography/generate.ts';
import type { Territory } from './geography/generate.ts';
import { generateHistory } from './history/generate.ts';
import type { HistoryResult } from './history/generate.ts';
import { generateObjects } from './objects/generate.ts';
import { generateOrganizations } from './organizations/generate.ts';
import { generatePlaces } from './places/generate.ts';
import type { PlacesResult } from './places/generate.ts';
import { sortBackstories } from './population/backstory.ts';
import { generatePopulation } from './population/generate.ts';
import type { PopulationResult } from './population/generate.ts';

/** Presente del mundo (030 §3): la vida detallada empieza el 1 de enero de 2026. */
export const DEFAULT_EPOCH = '2026-01-01T00:00';
/** Años de festivos que se guardan en la configuración a partir del año del epoch. */
export const HOLIDAY_YEARS = 10;

export interface WorldOptions {
  seed: number;
  profileId?: string;
  /** Si no se da, `gen.population.target` del perfil. */
  population?: number;
  name?: string;
  epoch?: string;
  tickMinutes?: number;
  catalogs?: Catalogs;
}

export interface GeneratedWorld {
  world: World;
  /** Todos los eventos de la creación (`WORLD_CREATED` y el pasado), en orden de id, listos para guardar. */
  events: WorldEvent[];
  territory: Territory;
  places: PlacesResult;
  orgIds: EntityId[];
  pop: PopulationResult;
  objectIds: EntityId[];
  hist: HistoryResult;
}

export function generateWorld(opts: WorldOptions): GeneratedWorld {
  const profileId = opts.profileId ?? DEFAULT_PROFILE;
  const profile = loadProfile(profileId);
  const catalogs = opts.catalogs ?? loadCatalogs();
  const epoch = opts.epoch ?? DEFAULT_EPOCH;
  const year = parseEpoch(epoch).year;
  const config: WorldConfig = {
    name: opts.name ?? "Data's World",
    seed: opts.seed,
    epoch,
    tickMinutes: opts.tickMinutes ?? 5,
    currency: { code: 'COP', minorUnit: 1 },
    population: { target: opts.population ?? profileNumber(profile, 'gen.population.target', epoch.slice(0, 10)) },
    engineVersion: ENGINE_VERSION,
    params: {},
    initialCapabilities: ['clock'],
    holidays: holidayDates(year, year + HOLIDAY_YEARS - 1),
    profile,
    catalogs: catalogRefs(catalogs),
  };
  const { world, events: created } = createWorld(config);
  const rng = createRng(config.seed);
  const territory = generateGeography(world, { placeKinds: catalogs.place_kinds });
  const places = generatePlaces(world, territory, catalogs.place_kinds);
  const orgIds = generateOrganizations(world, places.workplaceIds, catalogs, rng.fork('gen:orgs'), {
    prototype: profileId === PROTOTYPE_PROFILE,
  });
  const pop = generatePopulation(world, territory, places, catalogs, rng);
  const emp = generateEmployment(world, pop.citizenIds, orgIds, catalogs, rng);
  const objs = generateObjects(world, pop.citizenIds, pop.householdIds, catalogs.object_kinds, rng);
  const prior = [...pop.events, ...emp.events, ...objs.events];
  const hist = generateHistory(world, territory, places, orgIds, pop.citizenIds, prior, catalogs, rng);
  const events = [...created, ...prior, ...hist.events].sort((a, b) => idNumber(a.id) - idNumber(b.id));
  sortBackstories(world, events);
  return { world, events, territory, places, orgIds, pop, objectIds: objs.objectIds, hist };
}
