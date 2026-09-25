// Parámetros de la ficha de salud (spec 031 §8), leídos del perfil de país (spec 029).
import { profileEntry, profileNumber, profileValue } from '@datas-world/engine';
import type { CountryProfile } from '@datas-world/engine';

type Rec = Record<string, number>;

export interface HealthParams {
  insuranceShare: Rec;
  bmiAdult: Rec;
  bmiChildren: Rec;
  activityMeets: number;
  tobaccoCurrent: number;
  tobaccoBySex: Rec;
  alcoholLastMonth: number;
  alcoholLevels: Rec;
  disabilityByAge: Rec;
  disabilityDomains: Rec;
  disabilityEmploymentFactor: number;
  subsidizedP: Rec;
  controlledP: number;
  /** Prevalencia base por edad (escalones "desde la edad") de cada condición del catálogo. */
  conditionPrevalence: Record<string, Rec>;
}

/** `null` si el perfil no tiene ficha de salud (perfil prototipo: paridad sin ella). */
export function healthParams(p: CountryProfile, date: string, conditionKeys: readonly string[]): HealthParams | null {
  if (!profileEntry(p, 'health.insurance.share', date)) return null;
  const rec = (k: string) => profileValue(p, k, date) as Rec;
  const n = (k: string) => profileNumber(p, k, date);
  return {
    insuranceShare: rec('health.insurance.share'),
    bmiAdult: rec('health.bmi.adult'),
    bmiChildren: rec('gen.health.bmiChildren'),
    activityMeets: n('health.activity.meetsGuideline'),
    tobaccoCurrent: n('health.tobacco.current'),
    tobaccoBySex: rec('gen.health.tobaccoBySex'),
    alcoholLastMonth: n('health.alcohol.lastMonth'),
    alcoholLevels: rec('gen.health.alcoholLevels'),
    disabilityByAge: rec('gen.health.disabilityByAge'),
    disabilityDomains: rec('gen.health.disabilityDomains'),
    disabilityEmploymentFactor: n('gen.health.disabilityEmploymentFactor'),
    subsidizedP: rec('gen.health.subsidizedP'),
    controlledP: n('gen.health.controlledP'),
    conditionPrevalence: Object.fromEntries(conditionKeys.map((k) => [k, rec(`gen.health.condition.${k}`)])),
  };
}

/** Valor de una tabla por escalones "desde la edad": el del mayor umbral ≤ `age` (0 si no llega a ninguno). */
export function stepAt(table: Rec, age: number): number {
  let v = 0;
  let best = -1;
  for (const [k, x] of Object.entries(table)) {
    const a = Number(k);
    if (a <= age && a > best) {
      best = a;
      v = x;
    }
  }
  return v;
}

/** Bits de `health.disability` por dominio (031 §3). */
export const DISABILITY_BITS: Readonly<Record<string, number>> = Object.freeze({
  ver: 1,
  oir: 2,
  caminar: 4,
  manos: 8,
  entender: 16,
  autocuidado: 32,
  comunicarse: 64,
});

/** Régimen de `health.insurance` (031 §3). */
export const INSURANCE = Object.freeze({ none: 0, contributor: 1, beneficiary: 2, subsidized: 3, special: 4 });
export const INSURANCE_NAMES = ['sin afiliación', 'contributivo (cotizante)', 'contributivo (beneficiario)', 'subsidiado', 'especial o de excepción'] as const;
