// Generación completa de un mundo de M1 (specs 007 R-001 y 030 R-001): configuración con perfil, catálogos y
// festivos, y después geografía → lugares → organizaciones → población → empleo → objetos → historia.
import {
  ENGINE_VERSION,
  createRng,
  createWorld,
  idNumber,
  defineDecisionColumns,
  defineWorkColumns,
  initLearnedStates,
  initMobility,
  initRules,
  initNeeds,
  initRoutines,
  parseEpoch,
  profileNumber,
  profileValue,
} from '@datas-world/engine';
import type { EntityId, World, WorldConfig, WorldEvent } from '@datas-world/engine';
import { amenityPlan, resolvePlots } from './amenities/plan.ts';
import type { AmenityPlan, ResolvedPlots } from './amenities/plan.ts';
import { generateRegional } from './amenities/regional.ts';
import type { RegionalResult } from './amenities/regional.ts';
import { catalogRefs, loadCatalogs } from './catalogs/load.ts';
import type { Catalogs } from './catalogs/load.ts';
import { holidayDates } from './country/holidays.ts';
import { DEFAULT_PROFILE, PROTOTYPE_PROFILE, loadProfile } from './country/profile.ts';
import { generateEconomy } from './economy/generate.ts';
import { LIFE_CAPABILITIES } from './life.ts';
import { generateEmployment } from './employment/generate.ts';
import { generateGeography } from './geography/generate.ts';
import type { Territory } from './geography/generate.ts';
import { COMMERCIAL_LOT, MAP_TEMPLATES, plots } from './geography/template.ts';
import { computePhysical, generateConditions } from './health/conditions.ts';
import { generateHabits, learnedHabits } from './health/habits.ts';
import { generateInsurance } from './health/insurance.ts';
import { healthParams } from './health/params.ts';
import { generateDevelopment } from './development/generate.ts';
import { seedMemories } from './memories/generate.ts';
import { generateHistory } from './history/generate.ts';
import { buildOntology } from './stimuli/ontology.ts';
import { generateLeisure } from './leisure/generate.ts';
import { leisureParams } from './leisure/params.ts';
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
  /** Mundo estático, solo con el reloj (como los de M1): sin la vida diaria de M2. */
  static?: boolean;
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
  /** Dotación urbana (033), si la plantilla tiene parcelas comerciales; el perfil prototipo no la tiene. */
  amenities?: { plan: AmenityPlan; resolved: ResolvedPlots; regional: RegionalResult };
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
    // Con vida diaria (M2) salvo que se pida un mundo estático (como los de M1).
    initialCapabilities: opts.static ? ['clock'] : [...LIFE_CAPABILITIES],
    holidays: holidayDates(year, year + HOLIDAY_YEARS - 1),
    profile,
    catalogs: catalogRefs(catalogs),
  };
  const { world, events: created } = createWorld(config);
  const rng = createRng(config.seed);
  const template = String(profileValue(profile, 'gen.map.template', epoch.slice(0, 10)));
  if (!MAP_TEMPLATES[template]) throw new Error(`Plantilla de mapa desconocida en el perfil: ${template}`);
  const territory = generateGeography(world, { template, placeKinds: catalogs.place_kinds });
  // 033: con parcelas comerciales en la plantilla, la dotación decide qué lugares hay y cuáles son regionales.
  let amenities: GeneratedWorld['amenities'];
  let plotList = plots(territory.template);
  if (plotList.some((p) => p.kind === COMMERCIAL_LOT)) {
    const plan = amenityPlan(catalogs.place_kinds, config.population.target);
    const resolved = resolvePlots(territory.template, plan, catalogs.place_kinds);
    plotList = resolved.plots;
    amenities = { plan, resolved, regional: { cityId: territory.departmentId, placeIds: [] } };
  }
  const places = generatePlaces(world, territory, catalogs.place_kinds, plotList);
  if (amenities) amenities.regional = generateRegional(world, territory, amenities.plan, catalogs.place_kinds);
  const orgIds = generateOrganizations(world, places.workplaceIds, catalogs, rng.fork('gen:orgs'), {
    prototype: profileId === PROTOTYPE_PROFILE,
  });
  const pop = generatePopulation(world, territory, places, catalogs, rng);
  // 010: estado interno inicial (necesidades, estrés, ánimo) según la personalidad; lo usa la vida diaria de M2.
  initNeeds(world, rng);
  // 031: la ficha de salud va en dos fases; la primera antes del empleo (la discapacidad limita el trabajo).
  const health = healthParams(profile, epoch.slice(0, 10), catalogs.health_conditions.entries.map((e) => e.key));
  if (health) generateHabits(world, pop.citizenIds, health, rng);
  const emp = generateEmployment(world, pop.citizenIds, orgIds, catalogs, rng);
  const objs = generateObjects(world, pop.citizenIds, pop.householdIds, catalogs.object_kinds, rng);
  const prior = [...pop.events, ...emp.events, ...objs.events];
  const hist = generateHistory(world, territory, places, orgIds, pop.citizenIds, prior, catalogs, rng);
  // 041: la historia de aprendizaje de cada persona, de 0 años al presente, con la 030 ya generada. Salvo en los
  // mundos estáticos (M1), que no tienen motor funcional.
  const dev = opts.static ? { events: [] } : generateDevelopment(world, pop.citizenIds, [...prior, ...hist.events], catalogs, buildOntology(catalogs), rng);
  // 013: los recuerdos y capítulos con que cada persona llega al día 0, desde su desarrollo y su historia.
  const mem = opts.static ? { events: [] } : seedMemories(world, pop.citizenIds, [...prior, ...hist.events, ...dev.events], catalogs, buildOntology(catalogs));
  // 031 fase 1b (041 R-008): tabaco, alcohol, actividad física y peso desde lo aprendido.
  if (health) learnedHabits(world, pop.citizenIds, health, rng);
  // Segunda fase: condiciones (con el antecedente de padres y antepasados), afiliación y salud física.
  const healthEvents: WorldEvent[] = [];
  if (health) {
    healthEvents.push(...generateConditions(world, pop.citizenIds, hist.ancestorIds, catalogs.health_conditions, health, rng));
    healthEvents.push(...generateInsurance(world, pop.citizenIds, prior, health, rng));
    computePhysical(world, pop.citizenIds, catalogs.health_conditions);
  }
  // 032: ficha de esparcimiento, con la salud, el empleo (ingresos, tiempo) y la oferta de lugares ya definidos.
  const leisure = leisureParams(profile, epoch.slice(0, 10));
  if (leisure) healthEvents.push(...generateLeisure(world, pop.citizenIds, catalogs.leisure_activities, leisure, rng));
  // 011: horarios de rutina, con el turno (empleo) y las horas de sueño (ficha de salud) ya asignados.
  initRoutines(world, rng);
  // 016: todos empiezan en su vivienda; 017: sin decisiones en curso.
  initMobility(world);
  defineDecisionColumns(world);
  defineWorkColumns(world); // 006: retrasos al trabajo (bloque G de M2)
  // 040 R-011: descuento y variabilidad aprendidos (desde el temperamento) y fuerza inicial de cada afición.
  initLearnedStates(world);
  // 038 R-010: reglas de la rutina (con su arista en la red relacional), con el aporte del número fijo de la 040.
  initRules(world);
  // 015: tenencia, arriendo, ahorro del hogar, caja de las organizaciones y resto del país (con el empleo ya hecho).
  generateEconomy(world, pop.householdIds, orgIds, rng);
  const events = [...created, ...prior, ...hist.events, ...dev.events, ...mem.events, ...healthEvents].sort((a, b) => idNumber(a.id) - idNumber(b.id));
  sortBackstories(world, events);
  return {
    world,
    events,
    territory,
    places,
    orgIds,
    pop,
    objectIds: objs.objectIds,
    hist,
    ...(amenities ? { amenities } : {}),
  };
}
