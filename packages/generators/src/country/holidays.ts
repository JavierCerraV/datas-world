// Festivos de Colombia (spec 029 R-005). Aritmética entera, sin `Date`.
// Base legal: Ley 51 de 1983 ("Ley Emiliani", traslado al lunes, desde 1984) y Ley 2578 de 2026
// (Virgen de Chiquinquirá, 9 de julio, trasladable, desde su promulgación el 2026-06-01).
import { civilFromDays, daysFromCivil, formatDate } from '@datas-world/engine';

export interface Holiday {
  date: string; // "AAAA-MM-DD"
  key: string;
  name: string;
}

/** Primer año con la Ley Emiliani vigente. Antes el calendario festivo era otro y no se modela. */
export const FIRST_SUPPORTED_YEAR = 1984;

/** Domingo de Pascua (algoritmo anónimo gregoriano de Meeus/Jones/Butcher), en días desde 1970-01-01. */
export function easterSunday(year: number): number {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return daysFromCivil(year, month, day);
}

/** 0 = lunes … 6 = domingo (misma convención que `toCalendar`). */
const weekday = (days: number) => (((days + 3) % 7) + 7) % 7;
/** Lunes siguiente (o el mismo día, si ya es lunes). */
const nextMonday = (days: number) => days + ((7 - weekday(days)) % 7);

const FIXED: [number, number, string, string][] = [
  [1, 1, 'ano_nuevo', 'Año Nuevo'],
  [5, 1, 'dia_trabajo', 'Día del Trabajo'],
  [7, 20, 'independencia', 'Día de la Independencia'],
  [8, 7, 'batalla_boyaca', 'Batalla de Boyacá'],
  [12, 8, 'inmaculada', 'Inmaculada Concepción'],
  [12, 25, 'navidad', 'Navidad'],
];

const MOVABLE: [number, number, string, string, number?][] = [
  [1, 6, 'reyes', 'Día de los Reyes Magos'],
  [3, 19, 'san_jose', 'Día de San José'],
  [6, 29, 'san_pedro', 'San Pedro y San Pablo'],
  [7, 9, 'chiquinquira', 'Virgen de Chiquinquirá', 2026], // Ley 2578 de 2026
  [8, 15, 'asuncion', 'Asunción de la Virgen'],
  [10, 12, 'dia_raza', 'Día de la Raza'],
  [11, 1, 'todos_santos', 'Día de Todos los Santos'],
  [11, 11, 'cartagena', 'Independencia de Cartagena'],
];

/** Festivos de un año, en orden de fecha y luego de clave. */
export function colombianHolidays(year: number): Holiday[] {
  if (!Number.isInteger(year) || year < FIRST_SUPPORTED_YEAR) {
    throw new RangeError(`Festivos solo desde ${FIRST_SUPPORTED_YEAR} (Ley 51 de 1983): ${year}`);
  }
  const out: Holiday[] = [];
  const add = (days: number, key: string, name: string) =>
    out.push({ date: formatDate(civilFromDays(days)), key, name });
  for (const [m, d, key, name] of FIXED) add(daysFromCivil(year, m, d), key, name);
  for (const [m, d, key, name, from] of MOVABLE) {
    if (from === undefined || year >= from) add(nextMonday(daysFromCivil(year, m, d)), key, name);
  }
  const easter = easterSunday(year);
  add(easter - 3, 'jueves_santo', 'Jueves Santo');
  add(easter - 2, 'viernes_santo', 'Viernes Santo');
  add(easter + 43, 'ascension', 'Ascensión del Señor'); // jueves +39, trasladado al lunes
  add(easter + 64, 'corpus_christi', 'Corpus Christi'); // jueves +60, trasladado al lunes
  add(easter + 71, 'sagrado_corazon', 'Sagrado Corazón de Jesús'); // viernes +68, trasladado al lunes
  return out.sort((a, b) => (a.date === b.date ? (a.key < b.key ? -1 : 1) : a.date < b.date ? -1 : 1));
}

/** Fechas festivas únicas de varios años, para `WorldConfig.holidays` (spec 002 R-001). */
export function holidayDates(fromYear: number, toYear: number): string[] {
  const set = new Set<string>();
  for (let y = fromYear; y <= toYear; y++) for (const h of colombianHolidays(y)) set.add(h.date);
  return [...set].sort();
}
