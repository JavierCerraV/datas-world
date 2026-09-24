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
