// API pública de los generadores (M1).
export { DEFAULT_EPOCH, HOLIDAY_YEARS, generateWorld } from './generate.ts';
export type { GeneratedWorld, WorldOptions } from './generate.ts';
export { amenityPlan, resolvePlots } from './amenities/plan.ts';
export type { AmenityPlan, AmenityRule, ResolvedPlots } from './amenities/plan.ts';
export { REFERENCE_CITY, generateRegional } from './amenities/regional.ts';
export type { RegionalResult } from './amenities/regional.ts';
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
  checkTemperamentCatalog,
  definePersonalityColumns,
  generatePersonality,
  generateTemperament,
} from './personality/generate.ts';
export type { PersonalityParams, PersonalityResult, TemperamentAttrs } from './personality/generate.ts';

export { generatePopulation } from './population/generate.ts';
export type { PopulationResult } from './population/generate.ts';
export { composeHousehold, pickTemplate } from './population/households.ts';
export { sortBackstories } from './population/backstory.ts';

export { employmentProbability, generateEmployment } from './employment/generate.ts';
export type { EmploymentResult } from './employment/generate.ts';
export { generateObjects } from './objects/generate.ts';
export type { ObjectsResult } from './objects/generate.ts';
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
export { seriesAt } from './country/series.ts';

export { leisureParams, leisureTable } from './leisure/params.ts';
export type { LeisureParams } from './leisure/params.ts';

export { generateHistory } from './history/generate.ts';
export type { HistoryResult } from './history/generate.ts';
export { HISTORY_COLUMNS, lineageOf } from './history/genealogy.ts';
export {
  DEFAULT_PROFILE,
  PROFILES_DIR,
  PROTOTYPE_PROFILE,
  loadProfile,
  parseProfile,
  pendingEntries,
} from './country/profile.ts';
