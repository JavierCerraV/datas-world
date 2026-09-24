// Personalidad de los ciudadanos (spec 009): rasgos, valores y afrontamiento en columnas (ADR-005).
// Rasgos y valores salen de los catálogos (ADR-006), a la espera de la tabla de expertos.
import { defineColumn, idNumber } from '@datas-world/engine';
import type { EntityId, Rng, World } from '@datas-world/engine';
import type { Catalog } from '../catalogs/schema.ts';

export const COPING_COLUMN = 'pers.coping';
/** Valores de la columna `pers.coping` (009 §3). */
export const COPING = Object.freeze({ problem_focused: 0, avoidant: 1, social_support: 2, rumination: 3 });

export interface PersonalityParams {
  traitSd: number; // gen.personality.traitSd
  extremeP: number; // gen.personality.extremeP
}

interface TraitAttrs {
  column: string;
  correlations?: Record<string, number>;
}

const MIN = 0.03;
const MAX = 0.97;
const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));
const colOf = (c: Catalog, key: string) =>
  (c.entries.find((e) => e.key === key)!.attrs as unknown as TraitAttrs).column;

/** Define las columnas de rasgos, valores y afrontamiento si aún no existen. Idempotente. */
export function definePersonalityColumns(world: World, traits: Catalog, values: Catalog): void {
  const has = (name: string) => name in world.components.f32 || name in world.components.u8;
  for (const e of traits.entries) {
    const col = (e.attrs as unknown as TraitAttrs).column;
    if (!has(col)) defineColumn(world.components, 'f32', col, 0.5);
  }
  for (const e of values.entries) {
    const col = (e.attrs as unknown as TraitAttrs).column;
    if (!has(col)) defineColumn(world.components, 'f32', col, 0);
  }
  if (!has(COPING_COLUMN)) defineColumn(world.components, 'u8', COPING_COLUMN, 0);
}

/**
 * 009 R-003: afrontamiento derivado de los rasgos, sin azar, en orden de prioridad:
 * neuroticismo > 0,65 → rumiación; responsabilidad < 0,35 → evitativo; extraversión > 0,6 → apoyo social;
 * si no, centrado en el problema.
 */
export function copingFor(neuroticism: number, conscientiousness: number, extraversion: number): number {
  if (neuroticism > 0.65) return COPING.rumination;
  if (conscientiousness < 0.35) return COPING.avoidant;
  if (extraversion > 0.6) return COPING.social_support;
  return COPING.problem_focused;
}

export interface PersonalityResult {
  /** Clave del rasgo que se volvió extremo (009 R-001, paso 2), si lo hubo. */
  extremeTrait?: string;
}

/**
 * Genera la personalidad de un ciudadano (009 R-001 a R-003). `rng` es el flujo `gen:personality`; cada
 * persona usa `rng.fork(citizenId)`, así que su personalidad no depende de cuántas personas haya (CA-003).
 */
export function generatePersonality(
  world: World,
  citizenId: EntityId,
  traits: Catalog,
  values: Catalog,
  params: PersonalityParams,
  rng: Rng,
): PersonalityResult {
  const row = idNumber(citizenId);
  if (!world.citizens.has(citizenId)) throw new Error(`No existe el ciudadano ${citizenId}`);
  const r = rng.fork(citizenId);
  const keys = traits.entries.map((e) => e.key);

  // 1. Normales estándar, una por rasgo y en el orden del catálogo.
  const z = new Map<string, number>();
  for (const k of keys) z.set(k, r.normal(0, 1));
  // 2. Correlaciones por mezcla lineal que conserva la varianza: z_a = ρ·z_b + √(1−ρ²)·z_a.
  for (const e of traits.entries) {
    for (const [other, rho] of Object.entries((e.attrs as unknown as TraitAttrs).correlations ?? {})) {
      if (keys.indexOf(other) < 0 || keys.indexOf(other) >= keys.indexOf(e.key)) {
        throw new Error(`${e.key}: la correlación con ${other} debe apuntar a un rasgo anterior del catálogo`);
      }
      z.set(e.key, rho * z.get(other)! + Math.sqrt(1 - rho * rho) * z.get(e.key)!);
    }
  }
  // 3. Escala a [0,1] y recorte, como newAgent del prototipo.
  const value = new Map<string, number>();
  for (const k of keys) value.set(k, clamp(0.5 + params.traitSd * z.get(k)!));
  // 4. Con probabilidad extremeP, un rasgo al azar se vuelve extremo.
  const result: PersonalityResult = {};
  if (r.chance(params.extremeP)) {
    const k = keys[r.int(0, keys.length - 1)]!;
    value.set(k, r.chance(0.5) ? 0.03 + 0.09 * r.next() : 0.88 + 0.09 * r.next());
    result.extremeTrait = k;
  }
  const f32 = world.components.f32;
  for (const k of keys) f32[colOf(traits, k)]![row] = value.get(k)!;
  // 009 R-002: valores U(0,1) independientes.
  for (const e of values.entries) f32[(e.attrs as unknown as TraitAttrs).column]![row] = r.next();
  // 009 R-003: afrontamiento con los valores ya guardados (precisión f32).
  const read = (key: string) => f32[colOf(traits, key)]![row]!;
  world.components.u8[COPING_COLUMN]![row] = copingFor(
    read('big5.neuroticism'),
    read('big5.conscientiousness'),
    read('big5.extraversion'),
  );
  return result;
}

/** Los tres valores más altos de una persona, con desempate por el orden del catálogo (009 §3). */
export function topValues(world: World, citizenId: EntityId, values: Catalog, n = 3): string[] {
  const row = idNumber(citizenId);
  return values.entries
    .map((e, i) => ({ key: e.key, i, v: world.components.f32[(e.attrs as unknown as TraitAttrs).column]![row]! }))
    .sort((a, b) => b.v - a.v || a.i - b.i)
    .slice(0, n)
    .map((x) => x.key);
}
