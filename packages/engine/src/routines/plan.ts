// Plan del día de una persona (spec 011 R-001 a R-004): la actividad por defecto en cada minuto, por capas:
// sueño → aseo y comidas → obligación (trabajo, colegio, búsqueda de empleo, oficios, diligencias) → libre.
import type { ActivityKind } from '../activity.ts';
import { formatId } from '../ids.ts';
import type { WorldView } from '../simulation/system.ts';
import { shiftOf } from './columns.ts';
import type { DayInfo } from './day.ts';
import { routineParams } from './day.ts';

export interface Planned {
  activity: ActivityKind;
  /** [0,1]: 0 = obligatorio (turno, colegio), 1 = libre (011 §3). */
  flexibility: number;
}

const inRange = (m: number, a: number, b: number) => (a <= b ? m >= a && m < b : m >= a || m < b);

/** ¿Trabaja hoy en su turno formal? `mon-fri`, `mon-sat` o `all` (006), sin domingos ni festivos salvo `all`. */
export function worksShiftToday(days: string, day: DayInfo): boolean {
  if (days === 'all') return true;
  if (day.restDay) return false;
  return days === 'mon-sat' ? day.weekday <= 5 : day.weekday <= 4;
}

/** ¿Es para esta persona un día con obligación de madrugar (trabajo o colegio)? Decide la hora de levantarse. */
export function isEarlyDay(view: WorldView, row: number, day: DayInfo): boolean {
  const shift = shiftOf(view, row);
  if (shift) return worksShiftToday(shift.days, day);
  const occ = view.citizens.get(formatId('CIT', row))?.occupation;
  if (occ && occ.kind !== 'none' && occ.kind !== 'formal') return !day.restDay && day.weekday <= 5;
  return (view.components.u8['demo.student']?.[row] ?? 0) === 1 && day.schoolDay;
}

export function planAt(view: WorldView, row: number, day: DayInfo, minute: number): Planned {
  const i = view.components.i32;
  const u = view.components.u8;
  const { school, meals } = routineParams(view);
  const wake = isEarlyDay(view, row, day) ? i['routine.wakeW']![row]! : i['routine.wakeE']![row]!;
  const bed = i['routine.bed']![row]!;
  if (inRange(minute, bed, wake)) return { activity: 'sleep', flexibility: 0.3 };

  // Aseo y comidas (R-002): desayuno al levantarse, almuerzo entre las 12 y las 14, comida en la noche.
  if (inRange(minute, wake, wake + meals.washLen!)) return { activity: 'wash', flexibility: 0.5 };
  const breakfast = wake + meals.washLen!;
  if (inRange(minute, breakfast, breakfast + meals.breakfastLen!)) return { activity: 'eat', flexibility: 0.3 };
  const shift = shiftOf(view, row);
  const working = shift !== undefined && worksShiftToday(shift.days, day);
  const lunchStart = working && shift.lunch > 0 ? meals.lunchStart! : u['demo.student']?.[row] === 1 && day.schoolDay ? school.end! + 15 : meals.lunchStart! + 30;
  const lunchLen = working && shift.lunch > 0 ? shift.lunch : meals.lunchLen!;
  if (inRange(minute, lunchStart, lunchStart + lunchLen)) return { activity: 'eat', flexibility: working ? 0.1 : 0.3 };
  if (inRange(minute, meals.dinnerStart!, meals.dinnerStart! + meals.dinnerLen!)) return { activity: 'eat', flexibility: 0.3 };

  // La obligación del día según la situación (R-001).
  const age = (view.now - (i['demo.birthMinute']?.[row] ?? 0)) / (365.25 * 1440);
  if (working) {
    if (inRange(minute, shift.start, shift.end)) return { activity: 'work', flexibility: 0.1 };
  } else {
    const occ = view.citizens.get(formatId('CIT', row))?.occupation;
    const weekday = !day.restDay && day.weekday <= 4;
    if (u['demo.student']?.[row] === 1) {
      if (day.schoolDay && inRange(minute, school.start!, school.end!)) return { activity: 'study', flexibility: 0.1 };
      if (day.schoolDay && inRange(minute, 14 * 60, 16 * 60)) return { activity: 'study', flexibility: 0.5 };
    } else if (occ && (occ.kind === 'informal' || occ.kind === 'independent')) {
      if (!day.restDay && day.weekday <= 5 && inRange(minute, 7 * 60, 17 * 60)) return { activity: 'work', flexibility: 0.3 };
    } else if (occ?.kind === 'none' && occ.reason === 'unemployed') {
      if (weekday && inRange(minute, 8 * 60, 12 * 60)) return { activity: 'job_search', flexibility: 0.5 };
    } else if (occ?.kind === 'none' && occ.reason === 'home_duties') {
      if (!day.restDay && inRange(minute, 8 * 60, 12 * 60)) return { activity: 'chores', flexibility: 0.5 };
    } else if (occ?.kind === 'none' && occ.reason === 'pensioned') {
      if (weekday && inRange(minute, 9 * 60, 11 * 60)) return { activity: 'errands', flexibility: 0.7 };
    }
  }
  const householdId = view.citizens.get(formatId('CIT', row))?.householdId;
  const household = householdId ? view.households.get(householdId) : undefined;
  if (household?.caregiverIds?.includes(formatId('CIT', row)) && inRange(minute, 14 * 60, 17 * 60))
    return { activity: 'care', flexibility: 0.4 };
  if (age < 5 && inRange(minute, 13 * 60, 15 * 60)) return { activity: 'sleep', flexibility: 0.5 };
  return { activity: 'leisure', flexibility: 1 };
}
