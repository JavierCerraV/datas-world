// Carga de catálogos desde packages/generators/catalogs/*.json (ADR-006).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalize, hashString } from '@datas-world/engine';
import type { CatalogRef } from '@datas-world/engine';
import { catalogSchema } from './schema.ts';
import type { Catalog, CatalogEntry } from './schema.ts';

export const CATALOGS_DIR = join(import.meta.dirname, '..', '..', 'catalogs');

/** Catálogos del mundo y del laboratorio, en orden canónico. */
export const CATALOG_NAMES = [
  'appearance',
  'birthplaces',
  'chat_claims',
  'chat_relations',
  'chat_scripts',
  'chat_stances',
  'chat_tones',
  'childhood_events',
  'development_episodes',
  'education_levels',
  'family_names',
  'given_names',
  'health_conditions',
  'historical_events',
  'leisure_activities',
  'life_domains',
  'object_kinds',
  'occupations',
  'org_sectors',
  'personality_traits',
  'place_kinds',
  'rumor_topics',
  'stimulus_classes',
  'temperament_params',
  'territory_levels',
  'trades_informal',
] as const;
export type CatalogName = (typeof CATALOG_NAMES)[number];

/** Valida un catálogo ya leído. Lanza con todos los problemas que encuentre Zod. */
export function parseCatalog(data: unknown, label = 'catálogo'): Catalog {
  const r = catalogSchema.safeParse(data);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`).join('; ');
    throw new Error(`${label} inválido: ${issues}`);
  }
  return r.data;
}

export function loadCatalog(name: CatalogName, dir = CATALOGS_DIR): Catalog {
  const catalog = parseCatalog(JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')), `${name}.json`);
  if (catalog.name !== name) throw new Error(`${name}.json declara el nombre ${catalog.name}`);
  return catalog;
}

export type Catalogs = Record<CatalogName, Catalog>;

export function loadCatalogs(dir = CATALOGS_DIR): Catalogs {
  return Object.fromEntries(CATALOG_NAMES.map((n) => [n, loadCatalog(n, dir)])) as Catalogs;
}

/** Referencia que se guarda en `WorldConfig.catalogs` (ADR-006 §4). */
export const catalogRef = (c: Catalog): CatalogRef => ({ version: c.version, hash: hashString(canonicalize(c)) });

export function catalogRefs(cs: Catalogs): Record<string, CatalogRef> {
  return Object.fromEntries(CATALOG_NAMES.map((n) => [n, catalogRef(cs[n])]));
}

/** Busca una entrada por clave; lanza si no existe (un tipo desconocido es un error, no un caso especial). */
export function catalogEntry(c: Catalog, key: string): CatalogEntry {
  const e = c.entries.find((x) => x.key === key);
  if (!e) throw new Error(`«${key}» no está en el catálogo ${c.name}`);
  return e;
}

/** Entradas que se pueden instanciar en un hito, p. ej. `M1` (compara el número dentro de la misma letra). */
export function entriesSince(c: Catalog, milestone: string): CatalogEntry[] {
  const [kind, n] = [milestone[0], Number(milestone.slice(1))];
  return c.entries.filter((e) => e.since[0] === kind && Number(e.since.slice(1)) <= n);
}
