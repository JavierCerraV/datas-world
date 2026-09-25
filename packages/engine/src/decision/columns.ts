// Columnas y tipos del motor de decisiones (spec 017 §3) y de las actividades de esparcimiento (032).
import { ACTIVITY } from '../activity.ts';
import type { ActivityKind } from '../activity.ts';
import { defineColumn } from '../components.ts';
import type { ColumnType } from '../components.ts';
import type { World } from '../world.ts';

/**
 * Decisión en curso: la persona se compromete con lo elegido hasta `act.until` (minuto del mundo).
 * - `act.choice`: código de la actividad elegida + 1 (0 = ninguna; `idle` es el código 0);
 * - `act.place`: número del lugar elegido (0 = el de la actividad, 016).
 */
export const DECISION_COLUMNS: readonly (readonly [ColumnType, string])[] = Object.freeze([
  ['u8', 'act.choice'],
  ['i32', 'act.place'],
  ['i32', 'act.until'],
]);

export function defineDecisionColumns(world: World): void {
  const c = world.components;
  for (const [type, name] of DECISION_COLUMNS) if (!(name in c[type])) defineColumn(c, type, name, 0);
}

/**
 * Actividad de esparcimiento tal como la usa el motor (032 §3): la construye el generador desde el catálogo
 * `leisure_activities` y el perfil (`leisureTable`) y se pasa al crear el sistema, sin E/S en el motor.
 */
export interface LeisureActivity {
  name: string;
  /** Tipos de lugar donde se hace; vacío = en casa o al aire libre cerca de casa. */
  placeKinds: readonly string[];
  /** También se puede hacer en casa. */
  atHome: boolean;
  /** Coste por vez en la unidad mínima de la moneda (la mensualidad del gimnasio, repartida). */
  cost: number;
  hours: number;
  group: 'solo' | 'con_otros' | 'ambos';
  physical: number;
}
export type LeisureTable = Readonly<Record<string, LeisureActivity>>;

/** Actividad del día a día (011 §3) con que se registra una afición: deporte, vida social u ocio. */
export function activityOf(key: string, a: LeisureActivity): ActivityKind {
  if (key.startsWith('deporte.') && a.physical >= 1) return 'exercise';
  return a.group === 'con_otros' ? 'socialize' : 'leisure';
}

export const ACTIVITY_NAME = Object.fromEntries(Object.entries(ACTIVITY).map(([k, v]) => [v, k])) as Record<number, ActivityKind>;
