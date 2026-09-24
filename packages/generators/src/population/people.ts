// Datos de cada persona (spec 007): nacimiento, educación, ahorro, pensión, estudiante y apariencia.
// Escribe en las columnas del mundo (ADR-005). Cada persona usa su propio flujo de azar.
import { MINUTES_PER_DAY, daysFromCivil, defineColumn, idNumber, parseEpoch } from '@datas-world/engine';
import type { EntityId, Rng, World } from '@datas-world/engine';
import type { Catalog, CatalogEntry } from '../catalogs/schema.ts';
import type { PopulationParams } from './params.ts';

/** Columnas de la spec 007 (y `household.idx` de la 008), con su tipo y valor inicial. */
export const PEOPLE_COLUMNS: readonly [type: 'i32' | 'u8' | 'f32', name: string, initial: number][] = [
  ['i32', 'demo.birthMinute', 0],
  ['u8', 'demo.education', 0],
  ['u8', 'demo.student', 0],
  ['u8', 'demo.pensioned', 0],
  ['i32', 'money', 0],
  ['f32', 'health.physical', 1],
  ['i32', 'household.idx', 0],
  ['u8', 'look.skin', 1],
  ['u8', 'look.hairStyle', 0],
  ['u8', 'look.hairColor', 0],
  ['u8', 'look.glasses', 0],
  ['u8', 'look.beard', 0],
];

export function definePeopleColumns(world: World): void {
  const c = world.components;
  for (const [type, name, initial] of PEOPLE_COLUMNS) {
    if (!(name in c.f32) && !(name in c.i32) && !(name in c.u8)) defineColumn(c, type, name, initial);
  }
}

/** Edad a la que se termina cada nivel CINE de la columna `demo.education` (0–9). */
export const COMPLETION_AGE = [0, 11, 15, 17, 19, 20, 22, 23, 24, 28] as const;
/** Nivel más alto que se puede haber terminado a una edad. */
export const maxLevelForAge = (age: number): number => {
  let level = 0;
  COMPLETION_AGE.forEach((a, i) => {
    if (i > 0 && age >= a) level = i;
  });
  return level;
};

/** Minuto (relativo al epoch) del día `(y, m, d)`. */
export function minuteOf(epoch: string, y: number, m: number, d: number): number {
  const e = parseEpoch(epoch);
  return (daysFromCivil(y, m, d) - daysFromCivil(e.year, e.month, e.day)) * MINUTES_PER_DAY;
}

/** Nacimiento con exactamente `age` años cumplidos en el epoch: un día al azar del año que corresponde. */
export function birthMinuteFor(r: Rng, epoch: string, age: number): number {
  const e = parseEpoch(epoch);
  const hi = daysFromCivil(e.year - age, e.month, e.day); // cumple `age` justo en el epoch
  const lo = daysFromCivil(e.year - age - 1, e.month, e.day) + 1;
  const day = lo + r.int(0, hi - lo);
  return (day - daysFromCivil(e.year, e.month, e.day)) * MINUTES_PER_DAY;
}

const weighted = <T>(r: Rng, items: readonly T[], weight: (t: T) => number): T => {
  const total = items.reduce((s, t) => s + weight(t), 0);
  let x = r.next() * total;
  for (const t of items) {
    x -= weight(t);
    if (x < 0 && weight(t) > 0) return t;
  }
  return items.filter((t) => weight(t) > 0).at(-1)!;
};

export interface PersonData {
  age: number;
  sex: 'F' | 'M';
  stratum: number;
  householdRow: number;
}

/** 007 R-003 a R-005 y spec 029: nacimiento, educación, ahorro, pensión y estudiante. Devuelve el nivel educativo. */
export function writeDemographics(world: World, id: EntityId, d: PersonData, P: PopulationParams, r: Rng): number {
  const row = idNumber(id);
  const { i32, u8 } = world.components;
  i32['demo.birthMinute']![row] = birthMinuteFor(r.fork('birth'), world.config.epoch, d.age);
  i32['household.idx']![row] = d.householdRow;
  const levels = P.education[`s${d.stratum}` as 's2' | 's3' | 's4'] ?? P.education.s3;
  const chosen = d.age >= 18 ? levels[r.fork('edu').int(0, levels.length - 1)]! : 9;
  const level = Math.min(chosen, maxLevelForAge(d.age));
  u8['demo.education']![row] = level;
  u8['demo.student']![row] = d.age >= 5 && d.age < 18 ? 1 : 0;
  let money = 0;
  if (d.age >= 18) {
    const [lo, hi] = P.savings[`s${d.stratum}` as 's2' | 's3' | 's4'] ?? P.savings.s3;
    const m = r.fork('money');
    money = m.int(lo, hi) * 1000;
    if (d.age >= P.savings.elderlyAge) money += m.int(P.savings.elderlyBonus[0], P.savings.elderlyBonus[1]) * 1000;
  }
  i32['money']![row] = money;
  const pensioned = d.age >= P.pension.age[d.sex] && r.fork('pension').chance(P.pension.coverage);
  u8['demo.pensioned']![row] = pensioned ? 1 : 0;
  return level;
}

interface StyleAttrs {
  code: number;
  weightF: number;
  weightM: number;
  minAge?: number;
  maxAge?: number;
}

/** 007 R-009: apariencia para los sprites. `r` es el flujo `gen:appearance` de la persona. */
export function writeAppearance(
  world: World,
  id: EntityId,
  age: number,
  sex: 'F' | 'M',
  appearance: Catalog,
  r: Rng,
): void {
  const row = idNumber(id);
  const u8 = world.components.u8;
  const of = (prefix: string) => appearance.entries.filter((e) => e.key.startsWith(prefix));
  const attrs = (e: CatalogEntry) => e.attrs as Record<string, number>;
  const skins = of('skin.');
  u8['look.skin']![row] = skins.indexOf(weighted(r, skins, (e) => attrs(e).weight!)) + 1;
  const styles = of('hair_style.').filter((e) => {
    const a = e.attrs as unknown as StyleAttrs;
    return (a.minAge === undefined || age >= a.minAge) && (a.maxAge === undefined || age <= a.maxAge);
  });
  const style = weighted(r, styles, (e) => (sex === 'F' ? attrs(e).weightF! : attrs(e).weightM!));
  u8['look.hairStyle']![row] = attrs(style).code!;
  u8['look.hairColor']![row] = attrs(weighted(r, of('hair_color.'), (e) => attrs(e).weight!)).code!;
  const g = attrs(appearance.entries.find((e) => e.key === 'accessory.glasses')!);
  u8['look.glasses']![row] = r.chance(Math.min(g.max!, g.base! + g.perYearAfter30! * Math.max(0, age - 30))) ? 1 : 0;
  const b = attrs(appearance.entries.find((e) => e.key === 'accessory.beard')!);
  u8['look.beard']![row] = sex === 'M' && age >= b.minAge! && r.chance(b.pAdultMale!) ? 1 : 0;
}
