// Parámetros de la ficha de esparcimiento (spec 032 §8), leídos del perfil de país (spec 029).
import { profileEntry, profileNumber, profileValue } from '@datas-world/engine';
import type { CountryProfile } from '@datas-world/engine';

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
