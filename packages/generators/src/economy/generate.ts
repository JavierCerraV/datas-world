// Estado económico inicial (spec 015 §3, R-003, R-007): tenencia de la vivienda (ECV 2024), cuota mensual de la
// vivienda por estrato, ahorro del hogar, caja de las organizaciones y la cuenta del resto del país. Sin
// `economy.tenure` en el perfil (perfil prototipo), no hace nada: el mundo queda sin economía.
import { defineEconomyColumns, monthlyWage, profileEntry, profileValue } from '@datas-world/engine';
import type { EntityId, Rng, World } from '@datas-world/engine';
import { worldDate } from '../organizations/generate.ts';

type Rec = Record<string, number>;
const TENURES = ['arriendo', 'propia', 'pagando', 'usufructo'] as const;

export interface EconomyResult {
  /** Hogares por tenencia. */
  tenure: Record<(typeof TENURES)[number], number>;
}

export function generateEconomy(world: World, householdIds: readonly EntityId[], orgIds: readonly EntityId[], rng: Rng): EconomyResult | null {
  const profile = world.config.profile;
  const date = worldDate(world);
  if (!profile || !profileEntry(profile, 'economy.tenure', date)) return null;
  const shares = profileValue(profile, 'economy.tenure', date) as Rec;
  const rent = profileValue(profile, 'economy.rent', date) as Rec;
  const orgs = profileValue(profile, 'economy.orgs', date) as Rec;
  const result: EconomyResult = { tenure: { arriendo: 0, propia: 0, pagando: 0, usufructo: 0 } };

  world.accounts = { restOfCountry: 0 };
  defineEconomyColumns(world);

  for (const hid of householdIds) {
    const h = world.households.get(hid)!;
    const stratum = world.places.get(world.places.get(h.dwellingId)!.districtId!)!.stratum!;
    const r = rng.fork('gen:economy').fork(hid);
    // Tenencia por las proporciones de la ECV (en el orden de TENURES).
    let x = r.next();
    let tenure: (typeof TENURES)[number] = 'usufructo';
    for (const t of TENURES) {
      if (x < (shares[t] ?? 0)) {
        tenure = t;
        break;
      }
      x -= shares[t] ?? 0;
    }
    h.tenure = tenure;
    result.tenure[tenure] += 1;
    // Arriendo (o cuota del crédito) del estrato × U(0,8, 1,25), redondeado a $10 000.
    if (tenure === 'arriendo' || tenure === 'pagando')
      h.rent = Math.round(((rent[String(stratum)] ?? rent['3']!) * (0.8 + 0.45 * r.next())) / 10_000) * 10_000;
    // Ahorro del hogar por estrato, en miles de pesos.
    const key = `gen.savings.household.s${Math.min(4, Math.max(2, stratum))}`;
    const [lo, hi] = profileValue(profile, key, date) as [number, number];
    h.savings = r.int(lo, hi) * 1000;
  }

  // Caja de cada organización: `initialPayrollMonths` meses de nómina (R-007).
  for (const oid of orgIds) {
    const o = world.organizations.get(oid)!;
    const payroll = o.positions.filter((p) => p.holderId).reduce((s, p) => s + monthlyWage(p), 0);
    o.cash = Math.round(payroll * orgs.initialPayrollMonths!);
  }
  return result;
}
