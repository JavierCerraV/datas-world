// Temperamento de los ciudadanos (spec 009 v1.0; ADR-007): descriptores Big Five (fuente de generación y
// descripción) y parámetros de aprendizaje `tmp.*` derivados por una tabla de mapeo configurable (catálogos
// `personality_traits` y `temperament_params`, ADR-006). Nada de esto produce conducta: solo lo leen los
// mecanismos de aprendizaje (009 R-003, R-006).
import { FORBIDDEN_TERMS, defineColumn, idNumber, isMechanism } from '@datas-world/engine';
import type { EntityId, Rng, World } from '@datas-world/engine';
import type { Catalog } from '../catalogs/schema.ts';

export interface PersonalityParams {
  traitSd: number; // gen.personality.traitSd
  extremeP: number; // gen.personality.extremeP
}

interface TraitAttrs {
  column: string;
  correlations?: Record<string, number>;
}

/** Atributos de una entrada de `temperament_params` (009 §3). */
export interface TemperamentAttrs {
  column: string;
  modula: string[];
  base: number;
  /** Pesos por columna de descriptor (`pers.*`). */
  mapping: Record<string, number>;
  residualSd: number;
  scale: [number, number];
  status: string;
  basis?: string;
}

const MIN = 0.03;
const MAX = 0.97;
const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));
const colOf = (c: Catalog, key: string) =>
  (c.entries.find((e) => e.key === key)!.attrs as unknown as TraitAttrs).column;
const tempAttrs = (c: Catalog) => c.entries.map((e) => ({ key: e.key, name: e.name, a: e.attrs as unknown as TemperamentAttrs }));

/**
 * 009 INV-003 y CA-A: toda entrada declara mecanismos registrados en `modula`, ningún texto nombra una conducta
 * o un patrón clínico, y el mapeo solo usa descriptores del catálogo de rasgos. Lanza con todos los problemas.
 */
export function checkTemperamentCatalog(temperament: Catalog, traits: Catalog): void {
  const descriptors = new Set(traits.entries.map((e) => (e.attrs as unknown as TraitAttrs).column));
  const problems: string[] = [];
  for (const { key, name, a } of tempAttrs(temperament)) {
    if (!a.modula?.length) problems.push(`${key}: sin mecanismo en modula`);
    for (const m of a.modula ?? []) if (!isMechanism(m)) problems.push(`${key}: mecanismo no registrado ${m}`);
    const text = `${key} ${name} ${a.column}`.toLowerCase();
    for (const t of FORBIDDEN_TERMS) if (text.includes(t)) problems.push(`${key}: nombra una conducta o un patrón clínico (${t})`);
    for (const d of Object.keys(a.mapping ?? {})) if (!descriptors.has(d)) problems.push(`${key}: el mapeo usa ${d}, que no es un descriptor`);
  }
  if (problems.length) throw new Error(`temperament_params inválido: ${problems.join('; ')}`);
}

/** Define las columnas de descriptores y de temperamento si aún no existen. Idempotente. */
export function definePersonalityColumns(world: World, traits: Catalog, temperament: Catalog): void {
  checkTemperamentCatalog(temperament, traits);
  const has = (name: string) => name in world.components.f32;
  for (const e of traits.entries) {
    const col = (e.attrs as unknown as TraitAttrs).column;
    if (!has(col)) defineColumn(world.components, 'f32', col, 0.5);
  }
  for (const { a } of tempAttrs(temperament)) if (!has(a.column)) defineColumn(world.components, 'f32', a.column, 0.5);
}

export interface PersonalityResult {
  /** Clave del descriptor que se volvió extremo (009 R-001, paso 2), si lo hubo. */
  extremeTrait?: string;
}

/**
 * Descriptores Big Five de un ciudadano (009 R-001, como la v0.3). `rng` es el flujo `gen:personality`; cada
 * persona usa `rng.fork(citizenId)`, así que no depende de cuántas personas haya (CA-D).
 */
export function generatePersonality(world: World, citizenId: EntityId, traits: Catalog, params: PersonalityParams, rng: Rng): PersonalityResult {
  const row = idNumber(citizenId);
  if (!world.citizens.has(citizenId)) throw new Error(`No existe el ciudadano ${citizenId}`);
  const r = rng.fork(citizenId);
  const keys = traits.entries.map((e) => e.key);

  // 1. Normales estándar, una por descriptor y en el orden del catálogo.
  const z = new Map<string, number>();
  for (const k of keys) z.set(k, r.normal(0, 1));
  // 2. Correlaciones por mezcla lineal que conserva la varianza: z_a = ρ·z_b + √(1−ρ²)·z_a.
  for (const e of traits.entries) {
    for (const [other, rho] of Object.entries((e.attrs as unknown as TraitAttrs).correlations ?? {})) {
      if (keys.indexOf(other) < 0 || keys.indexOf(other) >= keys.indexOf(e.key)) {
        throw new Error(`${e.key}: la correlación con ${other} debe apuntar a un descriptor anterior del catálogo`);
      }
      z.set(e.key, rho * z.get(other)! + Math.sqrt(1 - rho * rho) * z.get(e.key)!);
    }
  }
  // 3. Escala a [0,1] y recorte, como newAgent del prototipo.
  const value = new Map<string, number>();
  for (const k of keys) value.set(k, clamp(0.5 + params.traitSd * z.get(k)!));
  // 4. Con probabilidad extremeP, un descriptor al azar se vuelve extremo.
  const result: PersonalityResult = {};
  if (r.chance(params.extremeP)) {
    const k = keys[r.int(0, keys.length - 1)]!;
    value.set(k, r.chance(0.5) ? 0.03 + 0.09 * r.next() : 0.88 + 0.09 * r.next());
    result.extremeTrait = k;
  }
  const f32 = world.components.f32;
  for (const k of keys) f32[colOf(traits, k)]![row] = value.get(k)!;
  return result;
}

/**
 * 009 R-002: parámetros de temperamento desde los descriptores ya guardados, con ruido propio:
 * `tmp = clamp(base + Σ w·(descriptor − 0,5) + N(0, residualSd), 0,02, 0,98)`.
 * Flujo `gen:temperament` por persona y por parámetro: añadir una entrada al catálogo no cambia las demás (CA-D).
 */
export function generateTemperament(world: World, citizenId: EntityId, temperament: Catalog, rng: Rng): void {
  const row = idNumber(citizenId);
  const f32 = world.components.f32;
  for (const { key, a } of tempAttrs(temperament)) {
    let v = a.base;
    for (const [col, w] of Object.entries(a.mapping)) v += w * ((f32[col]?.[row] ?? 0.5) - 0.5);
    v += rng.fork(citizenId).fork(key).normal(0, a.residualSd);
    f32[a.column]![row] = Math.min(0.98, Math.max(0.02, v));
  }
}
