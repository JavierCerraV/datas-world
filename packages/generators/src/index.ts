// API pública de los generadores (M1).
export {
  CATALOGS_DIR,
  CATALOG_NAMES,
  catalogEntry,
  catalogRef,
  catalogRefs,
  entriesSince,
  loadCatalog,
  loadCatalogs,
  parseCatalog,
} from './catalogs/load.ts';
export type { CatalogName, Catalogs } from './catalogs/load.ts';
export type { Catalog, CatalogEntry } from './catalogs/schema.ts';

export { DEFAULT_DEPARTMENT, SAFETY_BY_STRATUM, districtAt, generateGeography } from './geography/generate.ts';
export type { GeographyOptions, Territory } from './geography/generate.ts';
export { MAP_TEMPLATES, PROTOTYPE_64X40, isRoadTile, plots } from './geography/template.ts';

export { DWELLING_CAPACITY, generatePlaces } from './places/generate.ts';

export { generateOrganizations, worldDate } from './organizations/generate.ts';

export {
  COPING,
  COPING_COLUMN,
  copingFor,
  definePersonalityColumns,
  generatePersonality,
  topValues,
} from './personality/generate.ts';
export type { PersonalityParams, PersonalityResult } from './personality/generate.ts';

export { generatePopulation } from './population/generate.ts';
export type { PopulationResult } from './population/generate.ts';
export { composeHousehold, pickTemplate } from './population/households.ts';
export type { HouseholdSpec, MemberSpec } from './population/households.ts';
export { TEMPLATES, populationParams } from './population/params.ts';
export type { PopulationParams, Template } from './population/params.ts';
export {
  COMPLETION_AGE,
  PEOPLE_COLUMNS,
  birthMinuteFor,
  definePeopleColumns,
  maxLevelForAge,
} from './population/people.ts';
export type { OrganizationsOptions } from './organizations/generate.ts';
export type { PlacedPlot, PlacesResult } from './places/generate.ts';
export type { DistrictTemplate, MapTemplate, PlotTemplate } from './geography/template.ts';

export { FIRST_SUPPORTED_YEAR, colombianHolidays, easterSunday, holidayDates } from './country/holidays.ts';
export type { Holiday } from './country/holidays.ts';
export {
  DEFAULT_PROFILE,
  PROFILES_DIR,
  PROTOTYPE_PROFILE,
  loadProfile,
  parseProfile,
  pendingEntries,
} from './country/profile.ts';
