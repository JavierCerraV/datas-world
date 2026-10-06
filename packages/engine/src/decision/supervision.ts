// Supervisión de menores (spec 011 v0.3, R-007 y R-008): un menor de `MINOR_SUPERVISED_AGE` años solo elige tiempo
// libre en su vivienda o donde ya está un adulto de su hogar; de esa edad a los 17 sale de día, hasta
// `MINOR_CURFEW` y como mucho `MINOR_OUTING_MAX_H` horas seguidas. El menor no mueve al adulto (regla de oro 4): solo
// elige dónde el adulto ya está. Funciones puras sobre la vista.
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import { formatId, idNumber } from '../ids.ts';
import type { WorldView } from '../simulation/system.ts';

/** [M] Menores de esta edad no están solos fuera de casa. */
export const MINOR_SUPERVISED_AGE = 12;
/** Mayoría de edad: quien la tiene puede acompañar. */
export const ADULT_AGE = 18;
/** [M] Hora (minuto del día) hasta la que un menor de 12 a 17 años puede estar fuera de casa. */
export const MINOR_CURFEW = 20 * 60;
/** [M] Horas seguidas como máximo fuera de casa de un menor de 12 a 17 años. */
export const MINOR_OUTING_MAX_H = 2;

const YEAR = 365.25 * 1440;
const DAY = 1440;

export type AgeBand = 'child' | 'teen' | 'adult';

/** Edad en años de la fila. */
export const ageOf = (view: WorldView, row: number, now: number): number => (now - (view.components.i32['demo.birthMinute']?.[row] ?? 0)) / YEAR;

/** Tramo de supervisión de una edad: niño (< 12), adolescente (12 a 17) o adulto. */
export const bandOf = (age: number): AgeBand => (age < MINOR_SUPERVISED_AGE ? 'child' : age < ADULT_AGE ? 'teen' : 'adult');

/** ¿Hay un adulto del hogar de `row` en `place`, quieto (no de viaje)? Es quien puede acompañar a un menor. */
export function guardianAt(view: WorldView, row: number, place: number, now: number): boolean {
  const person = view.citizens.get(formatId('CIT', row));
  const household = person?.householdId ? view.households.get(person.householdId) : undefined;
  if (!household || !place) return false;
  for (const member of household.memberIds) {
    const m = idNumber(member);
    if (m === row || view.citizens.get(member)?.status !== 'active') continue;
    if (ageOf(view, m, now) < ADULT_AGE) continue;
    if ((view.components.i32['trip.to']?.[m] ?? 0) > 0) continue;
    if ((view.components.i32['loc.place']?.[m] ?? 0) === place) return true;
  }
  return false;
}

/**
 * ¿Es un niño que está fuera de casa sin un adulto de su hogar? (R-007) No cuenta quien está en el colegio, en el
 * trabajo, durmiendo o de viaje. Es quien debe volver a casa aunque tenga algo comprometido.
 */
export function isStranded(view: WorldView, row: number, now: number, here: number, home: number): boolean {
  if (bandOf(ageOf(view, row, now)) !== 'child' || !home || !here || here === home) return false;
  if ((view.components.i32['trip.to']?.[row] ?? 0) > 0) return false;
  const act = view.components.u8[ACTIVITY_COLUMN]?.[row] ?? 0;
  if (act === ACTIVITY.study || act === ACTIVITY.work || act === ACTIVITY.sleep) return false;
  return !guardianAt(view, row, here, now);
}

/**
 * Cuánto puede quedarse un adolescente fuera de casa si sale a `now + out`: no más de `MINOR_OUTING_MAX_H` ni más allá
 * del toque de queda (descontando el regreso). Un valor ≤ 0 significa que ya no puede salir.
 */
export function teenStayLimit(now: number, out: number, back: number): number {
  const curfew = Math.floor(now / DAY) * DAY + MINOR_CURFEW;
  return Math.min(MINOR_OUTING_MAX_H * 60, curfew - (now + out) - back);
}
