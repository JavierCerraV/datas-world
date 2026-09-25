// Columnas de la economía (spec 015 §3, R-005).
import { defineColumn } from '../components.ts';
import type { ColumnType } from '../components.ts';
import type { World } from '../world.ts';

/**
 * - `econ.debt` (i32): lo que la persona debe en total (suma de `balance` de sus deudas).
 * - `econ.debtPressure` (u8): 1 si la deuda pasó de `credit.pressureEnter` y aún no bajó de `credit.pressureExit`
 *   (histéresis, R-005); la leen las necesidades como estresor (010).
 * - `econ.consulted` (u8): 1 si ya pagó la consulta de su enfermedad aguda actual (031).
 */
export const ECONOMY_COLUMNS: readonly (readonly [ColumnType, string])[] = Object.freeze([
  ['i32', 'econ.debt'],
  ['u8', 'econ.debtPressure'],
  ['u8', 'econ.consulted'],
]);

export function defineEconomyColumns(world: World): void {
  const c = world.components;
  for (const [type, name] of ECONOMY_COLUMNS) if (!(name in c[type])) defineColumn(c, type, name, 0);
}
