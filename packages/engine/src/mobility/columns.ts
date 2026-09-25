// Columnas de la movilidad (spec 016 §3): dónde está cada persona y su viaje en curso.
import { defineColumn } from '../components.ts';
import type { ColumnType } from '../components.ts';
import { formatId, idNumber } from '../ids.ts';
import type { WorldView } from '../simulation/system.ts';
import type { World } from '../world.ts';

/** Modos de viaje; el código en `trip.mode` es la posición + 1 (0 = sin viaje). */
export const MODES = Object.freeze(['walk', 'bike', 'moto', 'car', 'bus'] as const);
export type Mode = (typeof MODES)[number];
export const modeCode = (m: Mode): number => MODES.indexOf(m) + 1;

/**
 * - `loc.place`: número del lugar donde está (0 = en tránsito, 004 R-003).
 * - `trip.from`, `trip.to`: números de los lugares del viaje en curso (0 = sin viaje).
 * - `trip.departAt`, `trip.arriveAt`: minutos del mundo; `trip.mode`: código del modo.
 */
export const MOBILITY_COLUMNS: readonly (readonly [ColumnType, string])[] = Object.freeze([
  ['i32', 'loc.place'],
  ['i32', 'trip.from'],
  ['i32', 'trip.to'],
  ['i32', 'trip.departAt'],
  ['i32', 'trip.arriveAt'],
  ['u8', 'trip.mode'],
]);

export function defineMobilityColumns(world: World): void {
  const c = world.components;
  for (const [type, name] of MOBILITY_COLUMNS) if (!(name in c[type])) defineColumn(c, type, name, 0);
}

/** Vivienda del hogar de la persona (número del lugar), o 0 si no tiene. */
export function homeOf(view: Pick<WorldView, 'citizens' | 'households'>, row: number): number {
  const householdId = view.citizens.get(formatId('CIT', row))?.householdId;
  const dwelling = householdId ? view.households.get(householdId)?.dwellingId : undefined;
  return dwelling ? idNumber(dwelling) : 0;
}

/** Estado inicial: todos en su vivienda y sin viaje (el mundo empieza a medianoche). */
export function initMobility(world: World): void {
  defineMobilityColumns(world);
  const active = world.components.u8.active!;
  const loc = world.components.i32['loc.place']!;
  for (let row = 1; row <= world.counters.CIT; row++) if (active[row] === 1) loc[row] = homeOf(world, row);
}
