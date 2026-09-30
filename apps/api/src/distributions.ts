// Distribuciones del mundo para el dashboard (spec 022 R-017, 024 R-027): histogramas del ánimo y del estrés, el
// dinero por tramos con su mediana y su índice de Gini, los hogares por tamaño y el empleo formal por organización.
// Funciones puras sobre el estado guardado.
import { idNumber } from '@datas-world/engine';
import type { Citizen, Household, World } from '@datas-world/engine';

/** Cuántos valores caen en cada uno de `bins` tramos iguales de [lo, hi] (el último incluye hi). */
export function histogram(values: readonly number[], bins = 10, lo = 0, hi = 1): number[] {
  const out = new Array<number>(bins).fill(0);
  for (const v of values) {
    const k = Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * bins)));
    out[k]!++;
  }
  return out;
}

/** Índice de Gini de valores no negativos (las deudas cuentan como 0), en [0,1]. */
export function gini(values: readonly number[]): number {
  const xs = values.map((v) => Math.max(0, v)).sort((a, b) => a - b);
  const n = xs.length;
  const total = xs.reduce((s, v) => s + v, 0);
  if (n === 0 || total === 0) return 0;
  let acc = 0;
  xs.forEach((v, i) => (acc += (2 * (i + 1) - n - 1) * v));
  return Math.round((acc / (n * total)) * 1000) / 1000;
}

export function median(values: readonly number[]): number {
  const xs = [...values].sort((a, b) => a - b);
  if (!xs.length) return 0;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m]! : Math.round((xs[m - 1]! + xs[m]!) / 2);
}

/** Tramos del dinero (en la unidad de la moneda del mundo, COP): de las deudas a más de 20 millones. */
export const MONEY_EDGES = [0, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000] as const;
export const MONEY_LABELS = ['Deuda', '< 500 mil', '500 mil – 1 M', '1 – 2 M', '2 – 5 M', '5 – 10 M', '10 – 20 M', '> 20 M'] as const;

export function moneyBins(values: readonly number[]): { label: string; count: number }[] {
  const out = MONEY_LABELS.map((label) => ({ label, count: 0 }));
  for (const v of values) {
    if (v < 0) {
      out[0]!.count++;
      continue;
    }
    let k = MONEY_EDGES.findIndex((e, i) => i > 0 && v < e);
    if (k < 0) k = MONEY_EDGES.length;
    out[k]!.count++;
  }
  return out;
}

/** 022 R-017 (CA-014): las distribuciones de la población viva. */
export function distributionsOf(w: World, people: readonly Citizen[], households: readonly Household[]) {
  const f = w.components.f32;
  const col = (name: string) => people.map((c) => f[name]?.[idNumber(c.id)] ?? 0);
  const money = people.map((c) => w.components.i32.money?.[idNumber(c.id)] ?? 0);
  const sizes = new Map<number, number>();
  for (const h of households) {
    const n = Math.min(6, h.memberIds.filter((m) => w.citizens.get(m)?.status === 'active' && !w.citizens.get(m)?.ancestor).length);
    if (n > 0) sizes.set(n, (sizes.get(n) ?? 0) + 1);
  }
  const byOrg = new Map<string, number>();
  for (const c of people) if (c.occupation?.kind === 'formal') byOrg.set(c.occupation.orgId, (byOrg.get(c.occupation.orgId) ?? 0) + 1);
  return {
    mood: histogram(col('state.mood')),
    stress: histogram(col('state.stress')),
    money: { bins: moneyBins(money), median: median(money), gini: gini(money) },
    householdSizes: [1, 2, 3, 4, 5, 6].map((n) => ({ size: n === 6 ? '6 o más' : String(n), count: sizes.get(n) ?? 0 })),
    employers: [...byOrg]
      .map(([id, n]) => ({ id, name: w.organizations.get(id as never)?.name ?? id, count: n }))
      .sort((a, b) => b.count - a.count || (a.id < b.id ? -1 : 1))
      .slice(0, 10),
  };
}
