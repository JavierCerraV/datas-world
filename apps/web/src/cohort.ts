// Cohorte de la pantalla Mundo (spec 024 R-026, CA-019): un filtro por edad, ocupación, estrato y ánimo que se calcula
// en el cliente sobre la población que ya entrega la API (022). Solo lectura: no escribe nada en el mundo. La lógica
// es pura y se prueba; el cableado del DOM está en cohort-ui.ts.
import type { CitizenPosition } from './types.ts';

/** Lo que el filtro necesita de cada persona (el resto de `CitizenPosition` no importa). */
export type CohortPerson = Pick<CitizenPosition, 'id' | 'age' | 'mood' | 'occupation' | 'stratum'>;

export interface CohortFilter {
  ageMin: number;
  ageMax: number;
  /** Ocupaciones elegidas; vacío = todas. */
  occupations: readonly string[];
  /** Estratos elegidos; vacío = todos. */
  strata: readonly number[];
  moodMin: number;
  moodMax: number;
}

export const AGE_LIMIT = 120;
export const ALL_COHORT: CohortFilter = Object.freeze({ ageMin: 0, ageMax: AGE_LIMIT, occupations: [], strata: [], moodMin: 0, moodMax: 1 });

/** Grupos de edad del histograma: de 10 en 10 años y «70 o más». */
export const AGE_BINS = ['0–9', '10–19', '20–29', '30–39', '40–49', '50–59', '60–69', '70+'] as const;
export const binOf = (age: number): number => Math.min(AGE_BINS.length - 1, Math.max(0, Math.floor(age / 10)));

export const ageActive = (f: CohortFilter) => f.ageMin > 0 || f.ageMax < AGE_LIMIT;
export const moodActive = (f: CohortFilter) => f.moodMin > 0 || f.moodMax < 1;

/** ¿El filtro deja fuera a alguien? Con el filtro vacío no hay cohorte: se ve a toda la población. */
export function isActive(f: CohortFilter): boolean {
  return ageActive(f) || moodActive(f) || f.occupations.length > 0 || f.strata.length > 0;
}

/** Una persona está en la cohorte si cumple todos los criterios activos; lo que se desconoce no cumple un criterio activo. */
export function inCohort(p: CohortPerson, f: CohortFilter): boolean {
  if (ageActive(f) && (p.age === undefined || p.age < f.ageMin || p.age > f.ageMax)) return false;
  if (moodActive(f) && (p.mood < f.moodMin - 1e-9 || p.mood > f.moodMax + 1e-9)) return false;
  if (f.occupations.length > 0 && !(p.occupation !== undefined && f.occupations.includes(p.occupation))) return false;
  if (f.strata.length > 0 && !(p.stratum != null && f.strata.includes(p.stratum))) return false;
  return true;
}

export interface CohortResult {
  /** `null` si el filtro está vacío (todos cuentan, nada se atenúa). */
  ids: ReadonlySet<string> | null;
  count: number;
  total: number;
  /** Porcentaje entero de la población. */
  pct: number;
}

/** CA-019: el tamaño de la cohorte y quién está en ella. */
export function cohortOf(people: readonly CohortPerson[], f: CohortFilter): CohortResult {
  const total = people.length;
  if (!isActive(f)) return { ids: null, count: total, total, pct: total ? 100 : 0 };
  const ids = new Set(people.filter((p) => inCohort(p, f)).map((p) => p.id));
  return { ids, count: ids.size, total, pct: total ? Math.round((ids.size / total) * 100) : 0 };
}

/** Personas por grupo de edad (todas, estén o no en la cohorte). */
export function ageHistogram(people: readonly CohortPerson[]): number[] {
  const h = AGE_BINS.map(() => 0);
  for (const p of people) if (p.age !== undefined) h[binOf(p.age)]!++;
  return h;
}

/** ¿El grupo del histograma cae dentro del rango de edad elegido? (para pintarlo resaltado). */
export function binInRange(bin: number, f: CohortFilter): boolean {
  const from = bin * 10;
  const to = bin === AGE_BINS.length - 1 ? AGE_LIMIT : from + 9;
  return to >= f.ageMin && from <= f.ageMax;
}

/** Orden de lectura de las ocupaciones (el de la API, 022 R-016); las desconocidas van al final. */
export const OCCUPATION_ORDER: readonly string[] = ['Empleo formal', 'Empleo informal', 'Independiente', 'Estudiante', 'Menor de edad', 'Labores del hogar', 'Pensionado', 'Desempleado', 'Otra inactividad'];
const occRank = (o: string) => { const i = OCCUPATION_ORDER.indexOf(o); return i < 0 ? OCCUPATION_ORDER.length : i; };

/** Conteo por ocupación y por estrato de toda la población, para rotular los botones del filtro. */
export function facets(people: readonly CohortPerson[]): { occupations: [string, number][]; strata: [number, number][] } {
  const occ = new Map<string, number>();
  const str = new Map<number, number>();
  for (const p of people) {
    if (p.occupation !== undefined) occ.set(p.occupation, (occ.get(p.occupation) ?? 0) + 1);
    if (p.stratum != null) str.set(p.stratum, (str.get(p.stratum) ?? 0) + 1);
  }
  return {
    occupations: [...occ.entries()].sort((a, b) => occRank(a[0]) - occRank(b[0]) || (a[0] < b[0] ? -1 : 1)),
    strata: [...str.entries()].sort((a, b) => a[0] - b[0]),
  };
}

/** Añade o quita un valor de una lista, sin repetir y en orden estable. */
export function toggled<T extends string | number>(list: readonly T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Resumen en palabras de la cohorte activa, para la barra del dashboard y el título del panel. */
export function describe(f: CohortFilter, r: CohortResult): string {
  if (!isActive(f)) return `Toda la población · ${r.total}`;
  const parts: string[] = [];
  if (ageActive(f)) parts.push(`${f.ageMin}–${f.ageMax >= AGE_LIMIT ? '+' : f.ageMax} años`);
  if (f.occupations.length) parts.push(f.occupations.join(' o '));
  if (f.strata.length) parts.push(`estrato ${f.strata.join(', ')}`);
  if (moodActive(f)) parts.push(`ánimo ${f.moodMin.toFixed(2)}–${f.moodMax.toFixed(2)}`);
  return `${parts.join(' · ')} · ${r.count} ${r.count === 1 ? 'persona' : 'personas'}`;
}
