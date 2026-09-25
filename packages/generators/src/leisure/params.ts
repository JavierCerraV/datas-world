// Parámetros de la ficha de esparcimiento (spec 032 §8), leídos del perfil de país (spec 029).
import { profileEntry, profileNumber, profileValue } from '@datas-world/engine';
import type { CountryProfile, LeisureActivity, LeisureTable } from '@datas-world/engine';
import type { Catalog } from '../catalogs/schema.ts';

type Rec = Record<string, number>;

export interface LeisureParams {
  popularity: Rec;
  costByLevel: Rec;
  budgetShare: Rec;
  freeHoursWeek: Rec;
  incomeProxy: Rec;
  regionalFrequency: number;
  count: { min: number; max: number };
  minimumWage: number;
  travelCost: number;
}

/** `null` si el perfil no tiene ficha de esparcimiento (perfil prototipo). */
export function leisureParams(p: CountryProfile, date: string): LeisureParams | null {
  if (!profileEntry(p, 'leisure.popularity', date)) return null;
  const rec = (k: string) => profileValue(p, k, date) as Rec;
  const count = rec('gen.leisure.count');
  return {
    popularity: rec('leisure.popularity'),
    costByLevel: rec('leisure.costByLevel'),
    budgetShare: rec('leisure.budgetShare'),
    freeHoursWeek: rec('leisure.freeHoursWeek'),
    incomeProxy: rec('leisure.incomeProxy'),
    regionalFrequency: profileNumber(p, 'leisure.regionalFrequency', date),
    count: { min: count.min!, max: count.max! },
    minimumWage: profileNumber(p, 'labor.minimumWageMonthly', date),
    travelCost: profileEntry(p, 'amenity.travel.cost', date) ? profileNumber(p, 'amenity.travel.cost', date) : 0,
  };
}

/** Atributos de una actividad del catálogo `leisure_activities`. */
export interface ActivityAttrs {
  placeKinds: string[];
  /** También se hace en casa o al aire libre, sin lugar del mundo. */
  home?: boolean;
  cost: 'nulo' | 'bajo' | 'medio' | 'alto';
  /** `month`: el coste es una mensualidad (gimnasio), no por vez. */
  costPer?: 'time' | 'month';
  group: 'solo' | 'con_otros' | 'ambos';
  ageRange: [number, number];
  physical: number;
  freq: number;
  hours: number;
  sex?: Rec;
  ageCurve?: Rec;
  traits?: Rec;
  values?: Rec;
}

/**
 * Tabla de actividades para el motor de decisiones (017, 032 R-006): dónde, cuánto cuesta cada vez (la mensualidad
 * del gimnasio, repartida entre las veces del mes), cuánto dura, con quién y la exigencia física. Sin perfil de
 * esparcimiento (prototipo), vacía.
 */
export function leisureTable(catalog: Catalog, profile: CountryProfile, date: string): LeisureTable {
  const P = leisureParams(profile, date);
  if (!P) return {};
  const table: Record<string, LeisureActivity> = {};
  for (const e of catalog.entries) {
    const a = e.attrs as unknown as ActivityAttrs | undefined;
    if (!a) continue;
    const level = P.costByLevel[a.cost] ?? 0;
    table[e.key] = {
      name: e.name,
      placeKinds: a.placeKinds,
      atHome: a.home === true,
      cost: Math.round(a.costPer === 'month' ? level / a.freq : level),
      hours: a.hours,
      group: a.group,
      physical: a.physical,
    };
  }
  return table;
}
