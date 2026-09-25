// Parámetros de población leídos del perfil de país (spec 029): el generador no distingue entre
// "Colombia" y "prototipo"; solo lee claves `gen.*`, `pension.*`.
import { profileNumber, profileValue } from '@datas-world/engine';
import type { CountryProfile } from '@datas-world/engine';

export const TEMPLATES = ['single', 'couple', 'couple_kids', 'extended', 'single_parent', 'roommates'] as const;
export type Template = (typeof TEMPLATES)[number];
export type Range = [number, number];

export interface PopulationParams {
  target: number;
  weights: Record<Template, number>;
  age: Record<'single' | 'couple' | 'coupleKids' | 'singleParent' | 'grandparent' | 'roommates', Range>;
  kids: { coupleKids: Range; singleParent: Range; extraP: number };
  kidAgeModel: 'uniform' | 'birthAge';
  /** birthAge: edad del progenitor al tener al hijo. */
  parentAgeAtBirth: Range;
  /** birthAge: edad del hijo adulto al tener al nieto (hogar extendido). */
  grandchildParentAge: Range;
  /** uniform: hijo U(0, min(17, edad − gap)); gap en parejas y en monoparentales o extendidos. */
  kidGap: Range;
  adultChildGap: Range;
  roommateCount: Range;
  partnerAgeDelta: Range;
  p: { sameSexCouple: number; femaleSingleParent: number; femaleGrandparent: number };
  savings: Record<'s2' | 's3' | 's4', Range> & { elderlyBonus: Range; elderlyAge: number };
  education: Record<'s2' | 's3' | 's4', number[]>;
  pension: { age: { F: number; M: number }; coverage: number };
  personality: { traitSd: number; extremeP: number };
  /** Proporción urbana por año (029): la probabilidad de haber nacido en el campo es 1 − urbanización. */
  urbanization: Record<string, number>;
}

const range = (p: CountryProfile, key: string, date: string): Range => {
  const v = profileValue(p, key, date);
  if (!Array.isArray(v) || v.length !== 2) throw new Error(`«${key}» debe ser [mín, máx]`);
  return [v[0]!, v[1]!];
};
const list = (p: CountryProfile, key: string, date: string): number[] => {
  const v = profileValue(p, key, date);
  if (!Array.isArray(v) || v.length === 0) throw new Error(`«${key}» debe ser una lista de números`);
  return v;
};
const optRange = (p: CountryProfile, key: string, date: string, fallback: Range): Range => {
  try {
    return range(p, key, date);
  } catch {
    return fallback;
  }
};

export function populationParams(p: CountryProfile, date: string): PopulationParams {
  const n = (k: string) => profileNumber(p, k, date);
  const w = profileValue(p, 'gen.household.templateWeights', date) as Record<string, number>;
  const model = profileValue(p, 'gen.household.kidAgeModel', date);
  if (model !== 'uniform' && model !== 'birthAge') throw new Error(`kidAgeModel desconocido: ${String(model)}`);
  const pa = profileValue(p, 'pension.age', date) as Record<string, number>;
  return {
    target: n('gen.population.target'),
    weights: Object.fromEntries(TEMPLATES.map((t) => [t, w[t] ?? 0])) as Record<Template, number>,
    age: {
      single: range(p, 'gen.household.age.single', date),
      couple: range(p, 'gen.household.age.couple', date),
      coupleKids: range(p, 'gen.household.age.coupleKids', date),
      singleParent: range(p, 'gen.household.age.singleParent', date),
      grandparent: range(p, 'gen.household.age.grandparent', date),
      roommates: range(p, 'gen.household.age.roommates', date),
    },
    kids: {
      coupleKids: range(p, 'gen.household.kids.coupleKids', date),
      singleParent: range(p, 'gen.household.kids.singleParent', date),
      extraP: n('gen.household.kids.extraP'),
    },
    kidAgeModel: model,
    parentAgeAtBirth: optRange(p, 'gen.household.parentAgeAtBirth', date, [20, 38]),
    grandchildParentAge: optRange(p, 'gen.household.grandchildParentAge', date, [18, 40]),
    kidGap: optRange(p, 'gen.household.kidGap', date, [20, 19]),
    adultChildGap: range(p, 'gen.household.adultChildGap', date),
    roommateCount: range(p, 'gen.household.roommateCount', date),
    partnerAgeDelta: range(p, 'gen.household.partnerAgeDelta', date),
    p: {
      sameSexCouple: n('gen.household.p.sameSexCouple'),
      femaleSingleParent: n('gen.household.p.femaleSingleParent'),
      femaleGrandparent: n('gen.household.p.femaleGrandparent'),
    },
    savings: {
      s2: range(p, 'gen.savings.s2', date),
      s3: range(p, 'gen.savings.s3', date),
      s4: range(p, 'gen.savings.s4', date),
      elderlyBonus: range(p, 'gen.savings.elderlyBonus', date),
      elderlyAge: n('gen.savings.elderlyAge'),
    },
    education: {
      s2: list(p, 'gen.education.s2', date),
      s3: list(p, 'gen.education.s3', date),
      s4: list(p, 'gen.education.s4', date),
    },
    pension: { age: { F: pa.F!, M: pa.M! }, coverage: n('pension.coverage') },
    personality: { traitSd: n('gen.personality.traitSd'), extremeP: n('gen.personality.extremeP') },
    urbanization: profileValue(p, 'demo.urbanization.byYear', date) as Record<string, number>,
  };
}
