// Calendario gregoriano sin zonas horarias (spec 002 R-001). Solo aritmética entera: nada de Date.

/** Minutos enteros desde `WorldConfig.epoch`. */
export type WorldMinute = number;

export const MINUTES_PER_DAY = 1440;

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}
export interface CivilDateTime extends CivilDate {
  hour: number;
  minute: number;
}

export interface CalendarView extends CivilDateTime {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = lunes
  isWeekend: boolean;
  isHoliday: boolean;
}

const floorDiv = (a: number, b: number) => Math.floor(a / b);

/** Días desde 1970-01-01 (algoritmo de H. Hinnant, "days_from_civil"). */
export function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = floorDiv(y, 400);
  const yoe = y - era * 400;
  const doy = floorDiv(153 * (month + (month > 2 ? -3 : 9)) + 2, 5) + day - 1;
  const doe = yoe * 365 + floorDiv(yoe, 4) - floorDiv(yoe, 100) + doy;
  return era * 146097 + doe - 719468;
}

export function civilFromDays(z: number): CivilDate {
  const zz = z + 719468;
  const era = floorDiv(zz, 146097);
  const doe = zz - era * 146097;
  const yoe = floorDiv(doe - floorDiv(doe, 1460) + floorDiv(doe, 36524) - floorDiv(doe, 146096), 365);
  const doy = doe - (365 * yoe + floorDiv(yoe, 4) - floorDiv(yoe, 100));
  const mp = floorDiv(5 * doy + 2, 153);
  const day = doy - floorDiv(153 * mp + 2, 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
export const formatDate = (d: CivilDate): string => `${pad(d.year, 4)}-${pad(d.month)}-${pad(d.day)}`;

/** Valida una fecha "AAAA-MM-DD" y devuelve sus días desde 1970-01-01. */
export function parseDate(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new RangeError(`Fecha inválida (se espera AAAA-MM-DD): ${s}`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const days = daysFromCivil(year, month, day);
  const back = civilFromDays(days);
  if (month < 1 || month > 12 || back.month !== month || back.day !== day) throw new RangeError(`Fecha inexistente: ${s}`);
  return days;
}

/** "AAAA-MM-DDTHH:MM" → fecha y hora civil. */
export function parseEpoch(iso: string): CivilDateTime {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(iso);
  if (!m) throw new RangeError(`Epoch inválido (se espera AAAA-MM-DDTHH:MM): ${iso}`);
  const { year, month, day } = civilFromDays(parseDate(m[1]!));
  const [hour, minute] = [Number(m[2]), Number(m[3])];
  if (hour > 23 || minute > 59) throw new RangeError(`Hora inválida en el epoch: ${iso}`);
  return { year, month, day, hour, minute };
}

/** Vista de calendario derivada (nunca se almacena). */
export function toCalendar(now: WorldMinute, epoch: string, holidays: readonly string[] = []): CalendarView {
  const e = parseEpoch(epoch);
  const total = daysFromCivil(e.year, e.month, e.day) * MINUTES_PER_DAY + e.hour * 60 + e.minute + now;
  const days = floorDiv(total, MINUTES_PER_DAY);
  const minuteOfDay = total - days * MINUTES_PER_DAY;
  const date = civilFromDays(days);
  const weekday = (((days + 3) % 7) + 7) % 7; // 1970-01-01 fue jueves (3)
  return {
    ...date,
    hour: floorDiv(minuteOfDay, 60),
    minute: minuteOfDay % 60,
    weekday: weekday as CalendarView['weekday'],
    isWeekend: weekday >= 5,
    isHoliday: holidays.includes(formatDate(date)),
  };
}
