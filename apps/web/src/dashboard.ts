// Dashboard del mundo (spec 024 R-023, Visor A+): «datos al …», el periodo y Exportar CSV; los indicadores (personas,
// nacidos y fallecidos del periodo con su tasa por mil, hogares y organizaciones); la pirámide por edad y sexo y las
// personas por ocupación, cada una con «Ver como tabla» y su valor al pasar el cursor; y debajo las series por día y
// las alertas del panel del mundo (R-011). Las gráficas son SVG puro y se prueban (CA-015).
import type { Demographics } from './dossier-types.ts';
import { bindChartHover, renderWorldPanel } from './world-panel.ts';
import type { Metrics } from './world-panel.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const num = (x: number) => x.toLocaleString('es-CO');
const perMil = (x: number) => `${String(x).replace('.', ',')} ‰`;
export const PERIODS: readonly ['month' | 'year' | 'all', string][] = [['month', 'Último mes'], ['year', 'Último año'], ['all', 'Desde la fundación']];
const PERIOD_OF: Record<string, string> = { month: 'último mes', year: 'último año', all: 'desde la fundación' };

/** Tope redondo del eje: el siguiente múltiplo de 10 (así la marca del medio es entera). */
export const niceMax = (m: number) => Math.max(10, Math.ceil(m / 10) * 10);

/** CA-015: la pirámide por edad y sexo: mujeres a la izquierda y hombres a la derecha, del grupo mayor arriba. */
export function pyramidSvg(p: Demographics['pyramid']): string {
  const W = 600;
  const mid = 300;
  const gap = 30;
  const half = mid - gap - 20;
  const max = niceMax(Math.max(1, ...p.flatMap((g) => [g.F, g.M])));
  const rowH = 32;
  const rows = [...p].reverse();
  const w = (n: number) => (half * n) / max;
  const bar = (x0: number, width: number, y: number, left: boolean, title: string) => {
    if (width <= 0) return '';
    const x = left ? x0 - width : x0;
    return `<rect class="bar" x="${x.toFixed(1)}" y="${y}" width="${width.toFixed(1)}" height="${rowH - 6}" rx="3"><title>${esc(title)}</title></rect>`;
  };
  const f = rows.map((g, i) => bar(mid - gap, w(g.F), 30 + i * rowH, true, `${g.group} · mujeres: ${g.F}`)).join('');
  const m = rows.map((g, i) => bar(mid + gap, w(g.M), 30 + i * rowH, false, `${g.group} · hombres: ${g.M}`)).join('');
  const labels = rows.map((g, i) => `<text x="${mid}" y="${30 + i * rowH + 17}" text-anchor="middle" class="axis-lbl">${esc(g.group)}</text>`).join('');
  const bottom = 30 + rows.length * rowH;
  const ticks = [0, max / 2, max].flatMap((v) => [
    `<text x="${(mid - gap - w(v)).toFixed(1)}" y="${bottom + 16}" text-anchor="middle" class="tick">${v}</text>`,
    `<text x="${(mid + gap + w(v)).toFixed(1)}" y="${bottom + 16}" text-anchor="middle" class="tick">${v}</text>`,
    `<path class="grid" d="M${(mid - gap - w(v)).toFixed(1)} 24 V${bottom}M${(mid + gap + w(v)).toFixed(1)} 24 V${bottom}"/>`,
  ]).join('');
  return `<svg class="dchart pyramid" viewBox="0 0 ${W} ${bottom + 24}" role="img" aria-label="Pirámide de población por grupos de 10 años">`
    + `${ticks}<text x="${mid - gap - half / 2}" y="14" text-anchor="middle" class="axis-lbl">Mujeres</text><text x="${mid + gap + half / 2}" y="14" text-anchor="middle" class="axis-lbl">Hombres</text>`
    + `<g class="f">${f}</g><g class="m">${m}</g>${labels}</svg>`;
}

/** CA-015: personas por ocupación, de mayor a menor, con el valor al final de cada barra. */
export function occupationSvg(o: Demographics['occupations'], total: number): string {
  const W = 560;
  const x0 = 160;
  const rowH = 30;
  const max = Math.max(1, ...o.map((r) => r.count));
  const len = (n: number) => ((W - x0 - 50) * n) / max;
  const rows = o.map((r, i) => {
    const y = 10 + i * rowH;
    const pct = total ? Math.round((r.count / total) * 100) : 0;
    return `<text x="${x0 - 10}" y="${y + 16}" text-anchor="end" class="axis-lbl">${esc(r.name)}</text>`
      + (r.count ? `<rect class="bar" x="${x0}" y="${y}" width="${len(r.count).toFixed(1)}" height="${rowH - 8}" rx="3"><title>${esc(r.name)}: ${r.count} (${pct} %)</title></rect>` : '')
      + `<text x="${(x0 + len(r.count) + 8).toFixed(1)}" y="${y + 16}" class="val">${r.count}</text>`;
  }).join('');
  const h = 14 + o.length * rowH;
  return `<svg class="dchart occ" viewBox="0 0 ${W} ${h}" role="img" aria-label="Personas por ocupación, de mayor a menor"><path class="axis" d="M${x0} 4 V${h - 4}"/>${rows}</svg>`;
}

const pyramidTable = (p: Demographics['pyramid']) => `<table class="dtable"><thead><tr><th>Edad</th><th>Mujeres</th><th>Hombres</th><th>Total</th></tr></thead><tbody>${[...p].reverse().map((g) => `<tr><td>${esc(g.group)}</td><td class="mono">${g.F}</td><td class="mono">${g.M}</td><td class="mono">${g.F + g.M}</td></tr>`).join('')}</tbody></table>`;
const occTable = (o: Demographics['occupations'], total: number) => `<table class="dtable"><thead><tr><th>Ocupación</th><th>Personas</th><th>%</th></tr></thead><tbody>${o.map((r) => `<tr><td>${esc(r.name)}</td><td class="mono">${r.count}</td><td class="mono">${total ? Math.round((r.count / total) * 100) : 0}</td></tr>`).join('')}</tbody></table>`;

/** CA-015: el dashboard completo (sin las series, que se añaden al llegar las métricas). */
export function renderDashboard(g: Demographics, tables: { pyramid: boolean; occ: boolean }): string {
  const kpi = (label: string, value: string, note: string) => `<div class="kpi"><span>${esc(label)}</span><b class="mono">${value}</b><small>${esc(note)}</small></div>`;
  const per = PERIOD_OF[g.period] ?? '';
  const kpis = `<div class="kpis">${kpi('Personas', num(g.population), 'vivas en el mundo')}${kpi(`Nacidos · ${per}`, num(g.births.count), `tasa bruta ${perMil(g.births.perThousand)}`)}${kpi(`Fallecidos · ${per}`, num(g.deaths.count), `tasa bruta ${perMil(g.deaths.perThousand)}`)}${kpi('Hogares', num(g.households.count), `${String(g.households.meanSize).replace('.', ',')} personas por hogar`)}${kpi('Organizaciones', num(g.organizations), 'empresas, comercios y entidades')}</div>`;
  const toggle = (k: string, on: boolean) => `<button class="link" type="button" data-table="${k}" aria-pressed="${on}">${on ? 'Ver como gráfica' : 'Ver como tabla'}</button>`;
  const pyr = `<section class="card"><div class="card-head"><h2>Personas por edad y sexo</h2>${toggle('pyramid', tables.pyramid)}</div>`
    + `<p class="legend"><span><i class="sw-f"></i>Mujeres · ${g.women}</span><span><i class="sw-m"></i>Hombres · ${g.men}</span></p>`
    + `${tables.pyramid ? pyramidTable(g.pyramid) : pyramidSvg(g.pyramid)}<p class="note">Grupos de 10 años; edad al ${esc(g.date.slice(0, 10))}. Pasa el cursor por una barra para ver su valor.</p></section>`;
  const occ = `<section class="card"><div class="card-head"><h2>Personas por ocupación</h2>${toggle('occ', tables.occ)}</div><p class="sub">Situación actual de las ${g.population} personas</p>`
    + `${tables.occ ? occTable(g.occupations, g.population) : occupationSvg(g.occupations, g.population)}</section>`;
  return `${kpis}<div class="grid-2 dash">${pyr}${occ}</div><div id="dash-series"></div>`
    + `<p class="lockline"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 018 0v4"></path></svg>Con la capa de investigación y clínica llegan <b>Estudio y participantes</b> y <b>Seleccionar muestra</b> (specs 028 y 034); usarán estos mismos filtros.</p>`;
}

/** Cablea la pantalla Datos: se piden los datos al abrirla y al cambiar de periodo. */
export function setupDashboard(o: { fetch: (p: 'month' | 'year' | 'all') => Promise<Demographics>; metrics: () => Promise<Metrics> }): { show: () => void } {
  const root = document.querySelector<HTMLElement>('#view-datos')!;
  let period: 'month' | 'year' | 'all' = 'year';
  const tables = { pyramid: false, occ: false };
  let data: Demographics | null = null;
  let series = '';
  root.innerHTML = `<header class="bar"><div class="titles"><h1>Información del mundo</h1><span class="crumb" id="dash-date">Data's World</span></div><span class="grow"></span>`
    + `<div class="seg" role="group" aria-label="Periodo" id="dash-period">${PERIODS.map(([k, l]) => `<button type="button" data-period="${k}" aria-pressed="${k === period}">${l}</button>`).join('')}</div>`
    + `<a class="btn" href="/api/export/events.csv" download>Exportar CSV</a></header><div class="dash-scroll" id="dash-body"><p class="empty">Cargando…</p></div>`;
  const body = root.querySelector<HTMLElement>('#dash-body')!;
  bindChartHover(body);
  const paint = () => {
    if (!data) return;
    root.querySelector('#dash-date')!.textContent = `Data's World · datos al ${data.date}`;
    body.innerHTML = renderDashboard(data, tables);
    body.querySelector('#dash-series')!.innerHTML = series;
  };
  const load = async () => {
    data = await o.fetch(period);
    paint();
    const m = await o.metrics().catch(() => null);
    series = m ? `<section class="card"><h2>El mundo en el tiempo <span class="h-note">por día, con las alertas de degeneración (022 R-010)</span></h2><div class="world-body">${renderWorldPanel(m)}</div></section>` : '';
    const el = body.querySelector('#dash-series');
    if (el) el.innerHTML = series;
  };
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const p = t.closest<HTMLElement>('[data-period]');
    if (p) {
      period = p.dataset.period as typeof period;
      for (const b of root.querySelectorAll('[data-period]')) b.setAttribute('aria-pressed', String(b === p));
      void load();
      return;
    }
    const tb = t.closest<HTMLElement>('[data-table]');
    if (tb) {
      const k = tb.dataset.table as 'pyramid' | 'occ';
      tables[k] = !tables[k];
      paint();
    }
  });
  return { show: () => void load() };
}
