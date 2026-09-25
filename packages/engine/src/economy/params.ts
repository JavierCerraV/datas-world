// Parámetros de la spec 015, leídos del perfil de país (029) y memorizados por perfil y fecha.
// Sin `economy.deductions` en el perfil (perfil prototipo), no hay economía: `economyParams` devuelve null.
import { profileEntry, profileNumber, profileValue } from '../profile.ts';
import type { CountryProfile } from '../profile.ts';
import type { DeepReadonly } from '../simulation/system.ts';

type Rec = Record<string, number>;

export interface EconomyParams {
  minimumWage: number;
  transportAllowance: number;
  /** `health`, `pension`: descuentos del empleado (Ley 100). */
  deductions: Rec;
  /** `meanSmmlv`, `independentFactor`, `sd`, `badDayP`, `badDayFactor`, `workDays`. */
  informal: Rec;
  /** `smmlv`: pensión en salarios mínimos. */
  pension: Rec;
  /** `perPersonMonthly` y un factor por estrato (`"1"`…`"6"`). */
  food: Rec;
  /** `baseMonthly`, `sizeExp`, `contribution5`, `contribution6`. */
  utilities: Rec;
  /** Subsidio por estrato (`stratum.utilitySubsidy`). */
  subsidy: Rec;
  /** `copayLow`, `copayMid`, `copayHigh`, `uninsured`, `medsMonthly`. */
  health: Rec;
  /** Crédito: banco, gota a gota y umbrales de presión (R-004, R-005). */
  credit: Rec;
  /** Organizaciones: demanda externa y financiación pública (R-007). */
  orgs: Rec;
  /** Días del mes: `rent`, `utilities`, `meds`, `bankDue`. */
  days: Rec;
  /** `share`: otros gastos del hogar como fracción de su ingreso esperado. */
  other: Rec;
}

const memo = new WeakMap<object, Map<string, EconomyParams | null>>();

export function economyParams(profile: CountryProfile | DeepReadonly<CountryProfile>, date: string): EconomyParams | null {
  const byDate = memo.get(profile) ?? new Map<string, EconomyParams | null>();
  memo.set(profile, byDate);
  if (byDate.has(date)) return byDate.get(date)!;
  const p = profile as CountryProfile;
  const rec = (k: string) => profileValue(p, k, date) as Rec;
  const params: EconomyParams | null = profileEntry(p, 'economy.deductions', date)
    ? {
        minimumWage: profileNumber(p, 'labor.minimumWageMonthly', date),
        transportAllowance: profileNumber(p, 'labor.transportAllowance', date),
        deductions: rec('economy.deductions'),
        informal: rec('economy.informal'),
        pension: rec('economy.pension'),
        food: rec('economy.food'),
        utilities: rec('economy.utilities'),
        subsidy: rec('stratum.utilitySubsidy'),
        health: rec('economy.health'),
        credit: rec('economy.credit'),
        orgs: rec('economy.orgs'),
        days: rec('economy.days'),
        other: rec('economy.other'),
      }
    : null;
  byDate.set(date, params);
  return params;
}
