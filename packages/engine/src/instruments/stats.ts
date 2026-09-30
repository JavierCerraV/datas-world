// Estadística de una aplicación (spec 045 R-009): descriptiva, grupos con tamaño del efecto, fiabilidad y
// correlación. Sin pruebas de significación (fuera de alcance, 045 §2).

export interface Descriptive {
  n: number;
  mean: number;
  sd: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
/** Varianza muestral (n − 1); 0 con menos de dos valores. */
const variance = (xs: readonly number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
};
/** Cuantil por interpolación lineal (tipo 7), sobre valores ordenados. */
const quantile = (sorted: readonly number[], p: number) => {
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  return sorted[lo]! + (h - lo) * ((sorted[Math.min(lo + 1, sorted.length - 1)] ?? sorted[lo]!) - sorted[lo]!);
};

/** Descriptiva de un conjunto de puntuaciones. Con n = 0 todo vale 0. */
export function describeScores(values: readonly number[]): Descriptive {
  if (!values.length) return { n: 0, mean: 0, sd: 0, min: 0, q1: 0, median: 0, q3: 0, max: 0 };
  const s = [...values].sort((a, b) => a - b);
  return {
    n: s.length,
    mean: r3(mean(s)),
    sd: r3(Math.sqrt(variance(s))),
    min: s[0]!,
    q1: r3(quantile(s, 0.25)),
    median: r3(quantile(s, 0.5)),
    q3: r3(quantile(s, 0.75)),
    max: s[s.length - 1]!,
  };
}

/** *d* de Cohen de `a` frente a `b`, con la desviación típica combinada; `null` si no se puede calcular. */
export function cohenD(a: readonly number[], b: readonly number[]): number | null {
  if (a.length < 2 || b.length < 2) return null;
  const pooled = Math.sqrt(((a.length - 1) * variance(a) + (b.length - 1) * variance(b)) / (a.length + b.length - 2));
  return pooled > 0 ? r3((mean(a) - mean(b)) / pooled) : null;
}

export interface GroupRow extends Descriptive {
  group: string;
  /** Personas del grupo que cumplen el criterio (si se da). */
  meeting: number;
  pct: number;
  /** *d* del grupo frente al resto de la aplicación. */
  d: number | null;
}

/**
 * CA-009: estadística por grupo. `rows` trae la puntuación y el grupo de cada persona; `meets` es el criterio
 * opcional («puntuación ≥ 10»). Grupos en orden de nombre; suman el total.
 */
export function groupStats(rows: readonly { score: number; group: string }[], meets?: (score: number) => boolean): GroupRow[] {
  const groups = [...new Set(rows.map((r) => r.group))].sort();
  return groups.map((g) => {
    const inG = rows.filter((r) => r.group === g).map((r) => r.score);
    const rest = rows.filter((r) => r.group !== g).map((r) => r.score);
    const meeting = meets ? inG.filter(meets).length : 0;
    return { group: g, ...describeScores(inG), meeting, pct: inG.length ? r3((100 * meeting) / inG.length) : 0, d: cohenD(inG, rest) };
  });
}

/** Alfa de Cronbach: `matrix[persona][ítem]`, sin valores ausentes. `null` con menos de 2 ítems o 2 personas. */
export function cronbachAlpha(matrix: readonly (readonly number[])[]): number | null {
  const k = matrix[0]?.length ?? 0;
  if (k < 2 || matrix.length < 2) return null;
  const itemVar = Array.from({ length: k }, (_, j) => variance(matrix.map((row) => row[j]!))).reduce((s, x) => s + x, 0);
  const totalVar = variance(matrix.map((row) => row.reduce((s, x) => s + x, 0)));
  return totalVar > 0 ? r3((k / (k - 1)) * (1 - itemVar / totalVar)) : null;
}

/** Correlación de Pearson; `null` si alguna variable no varía o hay menos de 3 pares. */
export function pearson(x: readonly number[], y: readonly number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i]! - mx) * (y[i]! - my);
    sxx += (x[i]! - mx) ** 2;
    syy += (y[i]! - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? r3(sxy / Math.sqrt(sxx * syy)) : null;
}
