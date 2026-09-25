// Entrar a un lugar (004 R-004, R-005): un lugar cerrado o lleno no admite la entrada, salvo a quien trabaja
// ahí con turno. Es la regla que usará la acción `enter` del motor de decisiones (017).
import { formatId } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import type { DayInfo } from '../routines/day.ts';
import { dayInfo } from '../routines/day.ts';
import { worksShiftToday } from '../routines/plan.ts';
import type { WorldView } from '../simulation/system.ts';

const DAY = 1440;

const openOn = (days: 'all' | 'mon-fri' | 'mon-sat', d: DayInfo) =>
  days === 'all' || (!d.restDay && (days === 'mon-sat' ? d.weekday <= 5 : d.weekday <= 4));

/** ¿Está abierto el lugar en el minuto `at`? Los cierres después de medianoche cuentan para el día anterior. */
export function isOpen(view: WorldView, placeId: EntityId, at: number): boolean {
  const h = view.places.get(placeId)?.openingHours;
  if (h === undefined || h === null || h === '24h') return true;
  const minute = ((at % DAY) + DAY) % DAY;
  if (minute >= h.open && minute < Math.min(h.close, DAY) && openOn(h.days, dayInfo(view, at))) return true;
  return h.close > DAY && minute < h.close - DAY && openOn(h.days, dayInfo(view, at - DAY));
}

/** ¿Trabaja la persona en ese lugar con turno hoy? (004 R-005). */
export function worksAt(view: WorldView, row: number, placeId: EntityId, at: number): boolean {
  const occ = view.citizens.get(formatId('CIT', row))?.occupation;
  if (occ?.kind !== 'formal') return false;
  const org = view.organizations.get(occ.orgId as EntityId);
  if (!org?.placeIds.includes(placeId)) return false;
  const shift = org.positions.find((p) => p.id === occ.positionId)?.shift;
  return shift !== undefined && worksShiftToday(shift.days, dayInfo(view, at));
}

/** Personas en cada lugar ahora (`loc.place`), por número de lugar. */
export function occupancy(view: WorldView, rows: readonly number[]): Map<number, number> {
  const loc = view.components.i32['loc.place']!;
  const out = new Map<number, number>();
  for (const row of rows) if (loc[row]! > 0) out.set(loc[row]!, (out.get(loc[row]!) ?? 0) + 1);
  return out;
}

/**
 * Motivo por el que la persona no puede entrar al lugar en el minuto `at`, o `null` si puede: cerrado (R-005)
 * o lleno (R-004, con la ocupación dada). Su propia casa siempre admite a sus residentes.
 */
export function enterRefusal(view: WorldView, row: number, place: number, at: number, occ: ReadonlyMap<number, number>): string | null {
  const id = formatId('PLC', place);
  const p = view.places.get(id);
  if (!p || p.status !== 'active') return 'no existe';
  if (p.kind === 'vivienda.unidad') return null;
  if (worksAt(view, row, id, at)) return null;
  if (!isOpen(view, id, at)) return 'cerrado';
  if (p.capacity !== undefined && (occ.get(place) ?? 0) >= p.capacity) return 'lleno';
  return null;
}
