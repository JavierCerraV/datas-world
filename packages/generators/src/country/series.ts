// Series anuales del perfil de país (spec 029): `{ "1938": 0.31, "1951": 0.39, … }`.

/**
 * Valor de una serie en un año: interpolación lineal entre los dos puntos que lo rodean; antes del primer
 * punto y después del último se mantiene el valor extremo (no se extrapola: no se inventan cifras).
 */
export function seriesAt(series: Readonly<Record<string, number>>, year: number): number {
  const points = Object.entries(series)
    .map(([y, v]) => [Number(y), v] as const)
    .sort((a, b) => a[0] - b[0]);
  if (points.length === 0) throw new Error('Serie vacía');
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (year <= first[0]) return first[1];
  if (year >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [y1, v1] = points[i]!;
    const [y0, v0] = points[i - 1]!;
    if (year <= y1) return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
  }
  return last[1];
}
