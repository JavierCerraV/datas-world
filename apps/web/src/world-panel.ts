// Panel del mundo (spec 024 R-011): por día, el ánimo y el estrés medios con su franja de desviación, la mediana del
// dinero y los eventos más frecuentes; las alertas de degeneración (022 R-010) y los enlaces de exportación CSV
// (022 R-011). Gráficas de líneas en SVG con un solo eje, leyenda y etiqueta directa, cursor con tooltip y una tabla.
import { EVENT_ES } from './format.ts';
import { kindOf } from './log.ts';

export interface DayMetrics { day: number; date: string; n: number; mood: number; moodSd: number; stress: number; stressSd: number; money: number; saturated: number }
export interface Alert { metric: string; kind: string; note: string }
export interface Metrics { days: DayMetrics[]; events: Record<string, number[]>; alerts: Alert[] }

interface Series { name: string; values: number[]; band?: number[] }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const W = 520;
const H = 150;
const PAD = { l: 44, r: 96, t: 10, b: 22 };
/** Número compacto para el eje y el tooltip. */
export const short = (x: number): string => (Math.abs(x) >= 1e6 ? `${(x / 1e6).toFixed(1)} M` : Math.abs(x) >= 1e3 ? `${Math.round(x / 1e3)} mil` : Math.abs(x) < 1 ? x.toFixed(2) : String(Math.round(x)));

/** Alturas de las etiquetas directas separadas al menos 12 px (en el orden de las series). */
export function labelYs(ys: readonly number[], gap = 12): number[] {
  const order = ys.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const out = [...ys];
  let prev = -Infinity;
  for (const [v, i] of order) prev = out[i] = Math.max(v, prev + gap);
  return out;
}

/**
 * Una gráfica de líneas: series en el orden fijo de la paleta (`--series-1…`), franja opcional de ± desviación,
 * etiqueta directa al final de cada línea y una capa de columnas invisibles (una por día) para el cursor.
 */
export function lineChart(title: string, dates: readonly string[], series: readonly Series[], range?: [number, number]): string {
  const all = series.flatMap((s) => [...s.values, ...(s.band ? s.values.map((v, i) => v + s.band![i]!) : [])]);
  const lo = range?.[0] ?? Math.min(0, ...all);
  const hi = range?.[1] ?? Math.max(1, ...all);
  const n = Math.max(1, dates.length - 1);
  const x = (i: number) => PAD.l + ((W - PAD.l - PAD.r) * i) / n;
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - (v - lo) / (hi - lo || 1));
  const line = (vs: readonly number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const bands = series.map((s, k) => (s.band ? `<path class="band" style="fill:var(--series-${k + 1})" d="${s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v + s.band![i]!).toFixed(1)}`).join('')}${[...s.values].map((v, i) => [v, i] as const).reverse().map(([v, i]) => `L${x(i).toFixed(1)},${y(v - s.band![i]!).toFixed(1)}`).join('')}Z"/>` : '')).join('');
  const lines = series.map((s, k) => `<path class="series" style="stroke:var(--series-${k + 1})" d="${line(s.values)}"/>`).join('');
  const labels = series.length <= 4 ? labelYs(series.map((s) => y(s.values.at(-1) ?? 0) + 4)).map((ly, k) => `<text class="label" x="${x(series[k]!.values.length - 1) + 6}" y="${ly.toFixed(1)}"><tspan style="fill:var(--series-${k + 1})">●</tspan> ${esc(series[k]!.name)}</text>`).join('') : '';
  const hits = dates.map((d, i) => `<rect class="hit" data-i="${i}" x="${x(i) - (W - PAD.l - PAD.r) / n / 2}" y="${PAD.t}" width="${(W - PAD.l - PAD.r) / n}" height="${H - PAD.t - PAD.b}"/>`).join('');
  const axis = [lo, (lo + hi) / 2, hi].map((v) => `<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${PAD.l - 4}" y="${y(v) + 4}" text-anchor="end">${short(v)}</text>`).join('');
  const ends = dates.length ? `<text class="tick" x="${PAD.l}" y="${H - 6}">${esc(dates[0]!)}</text><text class="tick" x="${W - PAD.r}" y="${H - 6}" text-anchor="end">${esc(dates.at(-1)!)}</text>` : '';
  const legend = series.length > 1 ? `<p class="legend">${series.map((s, k) => `<span><i style="background:var(--series-${k + 1})"></i>${esc(s.name)}</span>`).join('')}</p>` : '';
  const data = esc(JSON.stringify({ dates, series: series.map((s) => ({ name: s.name, values: s.values })) }));
  return `<figure class="chart"><figcaption>${esc(title)}</figcaption>${legend}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}" data-chart="${data}">${axis}${ends}${bands}${lines}${labels}<line class="cursor" x1="0" x2="0" y1="${PAD.t}" y2="${H - PAD.b}" visibility="hidden"/>${hits}</svg><div class="tip" hidden></div></figure>`;
}

/** Los tipos de evento más frecuentes del periodo (como mucho 5, en orden de total). */
export function topEvents(events: Record<string, number[]>, k = 5): [string, number[]][] {
  return Object.entries(events).sort((a, b) => b[1].reduce((s, x) => s + x, 0) - a[1].reduce((s, x) => s + x, 0) || (a[0] < b[0] ? -1 : 1)).slice(0, k);
}

/** CA-008: el panel completo: alertas, tres gráficas, tabla de los últimos días y exportación. */
export function renderWorldPanel(m: Metrics): string {
  const dates = m.days.map((d) => d.date);
  const alerts = m.alerts.length
    ? `<ul class="alerts">${m.alerts.map((a) => `<li><span aria-hidden="true">⚠</span> <strong>Alerta</strong>: ${esc(a.note)}</li>`).join('')}</ul>`
    : '<p class="muted">Sin alertas de degeneración.</p>';
  if (!m.days.length) return `${alerts}<p class="muted">Aún no hay trayectoria: se guarda un punto por día de vida del mundo.</p>${exportLinks()}`;
  const charts = lineChart('Ánimo y estrés medios (franja: ± desviación entre personas)', dates, [
    { name: 'Ánimo', values: m.days.map((d) => d.mood), band: m.days.map((d) => d.moodSd) },
    { name: 'Estrés', values: m.days.map((d) => d.stress), band: m.days.map((d) => d.stressSd) },
  ], [0, 1])
    + lineChart('Dinero de las personas (mediana)', dates, [{ name: 'Dinero', values: m.days.map((d) => d.money) }])
    + lineChart('Eventos por día (los más frecuentes)', dates, topEvents(m.events).map(([t, v]) => ({ name: EVENT_ES[t] ?? kindOf(t)[0], values: v })));
  const table = `<details><summary>Ver como tabla (últimos 14 días)</summary><table class="report"><thead><tr><th>Día</th><th>Ánimo</th><th>Estrés</th><th>Dinero</th></tr></thead><tbody>${m.days.slice(-14).reverse().map((d) => `<tr><td class="mono">${esc(d.date)}</td><td>${d.mood.toFixed(2)} ± ${d.moodSd.toFixed(2)}</td><td>${d.stress.toFixed(2)} ± ${d.stressSd.toFixed(2)}</td><td>${short(d.money)}</td></tr>`).join('')}</tbody></table></details>`;
  return `${alerts}${charts}${table}${exportLinks()}`;
}

const exportLinks = () => '<p class="export">Descargar para analizar fuera: <a href="/api/export/trajectory.csv" download>trayectorias (CSV)</a> · <a href="/api/export/events.csv" download>eventos (CSV)</a></p>';

/** Cursor y tooltip: al pasar sobre una columna, la línea vertical y los valores de ese día. */
export function bindChartHover(root: HTMLElement): void {
  root.addEventListener('pointerover', (ev) => {
    const hit = (ev.target as Element).closest?.('rect.hit');
    if (!hit) return;
    const svg = hit.closest('svg')!;
    const fig = svg.closest('figure')!;
    const data = JSON.parse(svg.getAttribute('data-chart')!) as { dates: string[]; series: { name: string; values: number[] }[] };
    const i = Number(hit.getAttribute('data-i'));
    const cursor = svg.querySelector<SVGLineElement>('line.cursor')!;
    const cx = Number(hit.getAttribute('x')) + Number(hit.getAttribute('width')) / 2;
    cursor.setAttribute('x1', String(cx));
    cursor.setAttribute('x2', String(cx));
    cursor.setAttribute('visibility', 'visible');
    const tip = fig.querySelector<HTMLElement>('.tip')!;
    tip.innerHTML = `<strong>${esc(data.dates[i] ?? '')}</strong>${data.series.map((s, k) => `<span><i style="background:var(--series-${k + 1})"></i>${esc(s.name)}: ${short(s.values[i] ?? 0)}</span>`).join('')}`;
    tip.hidden = false;
  });
  root.addEventListener('pointerleave', () => {
    for (const c of root.querySelectorAll('line.cursor')) c.setAttribute('visibility', 'hidden');
    for (const t of root.querySelectorAll<HTMLElement>('.tip')) t.hidden = true;
  }, true);
}
