// Tipo de día (spec 011 R-003): laborable, sábado, domingo o festivo (029), y si hay colegio (calendario A).
import { civilFromDays, daysFromCivil, toCalendar } from '../calendar.ts';
import type { WorldMinute } from '../calendar.ts';
import { profileValue } from '../profile.ts';
import type { CountryProfile } from '../profile.ts';
import type { WorldView } from '../simulation/system.ts';

export interface DayInfo {
  /** 0 = lunes … 6 = domingo. */
  weekday: number;
  /** Domingo o festivo: sin trabajo salvo turno de todos los días, sin colegio. */
  restDay: boolean;
  saturday: boolean;
  schoolDay: boolean;
}

type Rec = Record<string, number>;

const cache = new WeakMap<object, Map<string, { school: Rec; meals: Rec }>>();

/** Parámetros de rutina del perfil (029): jornada escolar, vacaciones y comidas. Memorizados por perfil y fecha. */
export function routineParams(view: WorldView): { school: Rec; meals: Rec } {
  const p = view.config.profile as CountryProfile;
  const date = view.config.epoch.slice(0, 10);
  let byDate = cache.get(p);
  if (!byDate) cache.set(p, (byDate = new Map()));
  let out = byDate.get(date);
  if (!out) {
    out = { school: profileValue(p, 'routine.school', date) as Rec, meals: profileValue(p, 'routine.meals', date) as Rec };
    byDate.set(date, out);
  }
  return out;
}

const isoOf = (days: number) => {
  const c = civilFromDays(days);
  return `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`;
};

/** Semana Santa (lunes a viernes): la del Jueves y Viernes Santo, dos festivos seguidos jueves-viernes en marzo o abril. */
function holyWeek(holidays: readonly string[], year: number): [string, string] | undefined {
  for (const d of holidays) {
    if (!d.startsWith(`${year}-03`) && !d.startsWith(`${year}-04`)) continue;
    const [y, m, dd] = d.split('-').map(Number) as [number, number, number];
    const n = daysFromCivil(y, m, dd);
    const thursday = (((n + 3) % 7) + 7) % 7 === 3; // 1970-01-01 fue jueves; 0 = lunes
    if (thursday && holidays.includes(isoOf(n + 1))) return [isoOf(n - 3), isoOf(n + 1)];
  }
  return undefined;
}

export function dayInfo(view: WorldView, now: WorldMinute): DayInfo {
  const cal = toCalendar(now, view.config.epoch, view.config.holidays);
  const restDay = cal.weekday === 6 || cal.isHoliday;
  const saturday = cal.weekday === 5 && !cal.isHoliday;
  const { school } = routineParams(view);
  const mmdd = cal.month * 100 + cal.day;
  const vacation =
    mmdd >= school.decFrom! || mmdd <= school.janTo! || (mmdd >= school.midFrom! && mmdd <= school.midTo!);
  const date = isoOf(daysFromCivil(cal.year, cal.month, cal.day));
  const holy = holyWeek(view.config.holidays, cal.year);
  const holyVacation = holy !== undefined && date >= holy[0] && date <= holy[1];
  return { weekday: cal.weekday, restDay, saturday, schoolDay: cal.weekday <= 4 && !cal.isHoliday && !vacation && !holyVacation };
}
