// Pantalla Datos (spec 024 R-023, R-027): «datos al …», el periodo y Exportar CSV; los indicadores; la pirámide y la
// ocupación; las distribuciones del ánimo, el estrés y el dinero; hogares por tamaño y empleadores; la red de vínculos
// en 3D; y las series por día con las alertas (R-011). Cada gráfica tiene «Ver como tabla». Solo lee de la API.
import { hbarsSvg, histogramSvg, miniTable, pyramidSvg, unitLabels } from './dash-charts.ts';
import type { Demographics } from './dossier-types.ts';
import { skeleton } from './loading.ts';
import { EDGE_LABEL, mountNetwork } from './network3d.ts';
import type { EdgeKind, Network } from './network3d.ts';
import { bindChartHover, renderWorldPanel } from './world-panel.ts';
import type { Metrics } from './world-panel.ts';

export { niceMax, pyramidSvg } from './dash-charts.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const num = (x: number) => x.toLocaleString('es-CO');
const dec = (x: number, d = 2) => x.toFixed(d).replace('.', ',');
const perMil = (x: number) => `${String(x).replace('.', ',')} ‰`;
const cop = (x: number) => `$${Math.round(x).toLocaleString('es-CO')}`;
export const PERIODS: readonly ['month' | 'year' | 'all', string][] = [['month', 'Último mes'], ['year', 'Último año'], ['all', 'Desde la fundación']];
const PERIOD_OF: Record<string, string> = { month: 'último mes', year: 'último año', all: 'desde la fundación' };

/** CA-015: personas por ocupación (se mantiene el nombre de la v0.5). */
export const occupationSvg = (o: Demographics['occupations'], total: number) =>
  hbarsSvg(o.map((r) => ({ label: r.name, count: r.count })), total, 'Personas por ocupación, de mayor a menor');

/** Una tarjeta con su título, su nota y su conmutador «Ver como tabla». */
const chartCard = (key: string, title: string, note: string, chart: string, table: string, asTable: boolean, extra = '') =>
  `<section class="card chart-card"><div class="card-head"><h2>${title}</h2><button class="link" type="button" data-table="${key}" aria-pressed="${asTable}">${asTable ? 'Ver como gráfica' : 'Ver como tabla'}</button></div>`
  + `${note ? `<p class="sub">${note}</p>` : ''}${extra}<div class="chart-box">${asTable ? table : chart}</div></section>`;

/** CA-015 y CA-020: la parte de la demografía (sin la red ni las series, que llegan aparte). */
export function renderDashboard(g: Demographics, tables: { pyramid: boolean; occ: boolean } | ReadonlySet<string>): string {
  const on = (k: string) => (tables instanceof Set ? tables.has(k) : Boolean((tables as Record<string, boolean>)[k]));
  const kpi = (label: string, value: string, note: string) => `<div class="kpi"><span>${esc(label)}</span><b class="mono">${value}</b><small>${esc(note)}</small></div>`;
  const per = PERIOD_OF[g.period] ?? '';
  const kpis = `<div class="kpis">${kpi('Personas', num(g.population), 'vivas en el mundo')}`
    + `${kpi(`Nacidos · ${per}`, num(g.births.count), `tasa bruta ${perMil(g.births.perThousand)}`)}`
    + `${kpi(`Fallecidos · ${per}`, num(g.deaths.count), `tasa bruta ${perMil(g.deaths.perThousand)}`)}`
    + `${kpi('Hogares', num(g.households.count), `${String(g.households.meanSize).replace('.', ',')} personas por hogar`)}`
    + `${kpi('Organizaciones', num(g.organizations), 'empresas, comercios y entidades')}`
    + (g.moodMean !== undefined ? kpi('Ánimo medio', dec(g.moodMean), 'de 0 a 1') : '')
    + (g.employedPct !== undefined ? kpi('Con empleo', `${Math.round(g.employedPct * 100)} %`, 'de 18 a 64 años') : '')
    + `</div>`;
  const pyrTable = `<table class="dtable"><thead><tr><th>Edad</th><th>Mujeres</th><th>Hombres</th><th>Total</th></tr></thead><tbody>${[...g.pyramid].reverse().map((r) => `<tr><td>${esc(r.group)}</td><td class="mono">${r.F}</td><td class="mono">${r.M}</td><td class="mono">${r.F + r.M}</td></tr>`).join('')}</tbody></table>`;
  const pyr = chartCard('pyramid', 'Personas por edad y sexo', `Grupos de 10 años; edad al ${esc(g.date.slice(0, 10))}.`, pyramidSvg(g.pyramid), pyrTable, on('pyramid'),
    `<p class="legend"><span><i class="sw-f"></i>Mujeres · ${g.women}</span><span><i class="sw-m"></i>Hombres · ${g.men}</span></p>`);
  const occ = chartCard('occ', 'Personas por ocupación', `Situación actual de las ${g.population} personas.`, occupationSvg(g.occupations, g.population),
    miniTable(['Ocupación', 'Personas'], g.occupations.map((r) => [r.name, r.count])), on('occ'));
  let dist = '';
  if (g.mood && g.stress && g.money) {
    const rows = (xs: readonly number[]) => xs.map((c, i) => [`${unitLabels[i]}–${(i === 9 ? '1,0' : unitLabels[i + 1])}`, c] as [string, number]);
    dist = `<div class="grid-3">`
      + chartCard('mood', 'Distribución del ánimo', `Personas por tramo de 0,1. Media ${g.moodMean !== undefined ? dec(g.moodMean) : '—'}.`, histogramSvg(g.mood, unitLabels, 'Distribución del ánimo', 'bar good'), miniTable(['Ánimo', 'Personas'], rows(g.mood)), on('mood'))
      + chartCard('stress', 'Distribución del estrés', 'Personas por tramo de 0,1.', histogramSvg(g.stress, unitLabels, 'Distribución del estrés', 'bar bad'), miniTable(['Estrés', 'Personas'], rows(g.stress)), on('stress'))
      + chartCard('money', 'Distribución del dinero', `Mediana ${cop(g.money.median)} · Gini ${dec(g.money.gini)} (0 igualdad, 1 desigualdad).`,
        histogramSvg(g.money.bins.map((b) => b.count), g.money.bins.map((b) => b.label.replace(' mil', 'k').replace(' – ', '–')), 'Distribución del dinero por tramos'),
        miniTable(['Tramo', 'Personas'], g.money.bins.map((b) => [b.label, b.count])), on('money'))
      + `</div>`;
  }
  return `${kpis}<div class="grid-2 dash">${pyr}${occ}</div>${dist}`;
}

/** El lado derecho de la fila de la red: hogares por tamaño y empleadores. */
function sideCharts(g: Demographics, tables: ReadonlySet<string>): string {
  if (!g.householdSizes || !g.employers) return '';
  const hs = g.householdSizes.map((h) => ({ label: `${h.size} ${h.size === '1' ? 'persona' : 'personas'}`, count: h.count }));
  return chartCard('hh', 'Hogares por tamaño', '', hbarsSvg(hs, g.households.count, 'Hogares por número de miembros', 130), miniTable(['Tamaño', 'Hogares'], hs.map((h) => [h.label, h.count])), tables.has('hh'))
    + chartCard('emp', 'Empleo formal por organización', 'Las 10 que más emplean.', hbarsSvg(g.employers.map((e) => ({ label: e.name, count: e.count })), 0, 'Empleo formal por organización', 200),
      miniTable(['Organización', 'Personas'], g.employers.map((e) => [e.name, e.count])), tables.has('emp'));
}

/** Cablea la pantalla Datos: se piden los datos al abrirla y al cambiar de periodo. */
export function setupDashboard(o: { fetch: (p: 'month' | 'year' | 'all') => Promise<Demographics>; metrics: () => Promise<Metrics>; network: () => Promise<Network>; open: (id: string) => void }): { show: () => void } {
  const root = document.querySelector<HTMLElement>('#view-datos')!;
  let period: 'month' | 'year' | 'all' = 'year';
  const tables = new Set<string>();
  let data: Demographics | null = null;
  let net: ReturnType<typeof mountNetwork> | null = null;
  const kinds = new Set<EdgeKind>(['pareja', 'familia', 'amistad', 'companeros', 'otros']);
  root.innerHTML = `<header class="bar"><div class="titles"><h1>Información del mundo</h1><span class="crumb" id="dash-date">Data's World</span></div><span class="grow"></span>`
    + `<div class="seg" role="group" aria-label="Periodo" id="dash-period">${PERIODS.map(([k, l]) => `<button type="button" data-period="${k}" aria-pressed="${k === period}">${l}</button>`).join('')}</div>`
    + `<a class="btn" href="/api/export/events.csv" download>Exportar CSV</a></header>`
    + `<div class="dash-scroll" id="dash-body"><div id="dash-top"></div><div class="grid-net" id="dash-netrow"><section class="card net-card"><div class="card-head"><h2>Red de vínculos en 3D <span class="h-note">arrastra para girar · rueda para acercar · clic abre el expediente</span></h2>`
    + `<div class="net-ctl"><button class="btn sq" type="button" data-net="in" aria-label="Acercar">+</button><button class="btn sq" type="button" data-net="out" aria-label="Alejar">−</button><button class="btn" type="button" data-net="spin" aria-pressed="true">Girar</button><button class="btn" type="button" data-net="reset">Restablecer</button></div></div>`
    + `<div class="net-filters" role="group" aria-label="Tipos de vínculo">${(Object.keys(EDGE_LABEL) as EdgeKind[]).map((k) => `<label class="check"><input type="checkbox" data-kind="${k}" checked> ${EDGE_LABEL[k]}</label>`).join('')}</div>`
    + `<p class="legend" id="net-legend"></p><div class="net-stage"><canvas id="net" aria-label="Red de vínculos en 3D. Cada punto es una persona; el color, su barrio."></canvas><div class="net-tip" id="net-tip" hidden></div><div id="net-wait">${skeleton('la red de vínculos', 4)}</div></div></section><div class="col" id="dash-side"></div></div>`
    + `<div id="dash-series"></div><p class="lockline"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 018 0v4"></path></svg>Con la capa de investigación y clínica llegan <b>Estudio y participantes</b> y <b>Seleccionar muestra</b> (specs 028 y 034); usarán estos mismos filtros.</p></div>`;
  const top = root.querySelector<HTMLElement>('#dash-top')!;
  const side = root.querySelector<HTMLElement>('#dash-side')!;
  bindChartHover(root.querySelector<HTMLElement>('#dash-series')!);
  const paint = () => {
    if (!data) return;
    root.querySelector('#dash-date')!.textContent = `Data's World · datos al ${data.date}`;
    top.innerHTML = renderDashboard(data, tables);
    side.innerHTML = sideCharts(data, tables);
  };
  const load = async () => {
    top.innerHTML = `<div class="grid-2">${`<section class="card">${skeleton('los datos del mundo', 6)}</section>`.repeat(2)}</div>`;
    data = await o.fetch(period);
    paint();
    if (!net) {
      const n = await o.network().catch(() => null);
      if (n) {
        const districts = [...new Set(n.nodes.map((x) => x.district ?? ''))].filter(Boolean).sort();
        root.querySelector('#net-legend')!.innerHTML = districts.map((d, i) => `<span><i style="background:var(${['--series-1', '--series-2', '--series-3', '--series-5', '--series-4'][i % 5]})"></i>${esc(d)}</span>`).join('') + `<span class="sub">${n.nodes.length} personas · ${n.edges.length} vínculos</span>`;
        root.querySelector('#net-wait')!.remove();
        net = mountNetwork(root.querySelector<HTMLCanvasElement>('#net')!, root.querySelector<HTMLElement>('#net-tip')!, n, districts, o.open);
      }
    }
    const m = await o.metrics().catch(() => null);
    root.querySelector('#dash-series')!.innerHTML = m ? `<section class="card"><h2>El mundo en el tiempo <span class="h-note">por día, con las alertas de degeneración (022 R-010)</span></h2><div class="world-body">${renderWorldPanel(m)}</div></section>` : '';
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
      const k = tb.dataset.table!;
      if (tables.has(k)) tables.delete(k);
      else tables.add(k);
      return paint();
    }
    const nb = t.closest<HTMLElement>('[data-net]');
    if (nb && net) {
      const a = nb.dataset.net;
      if (a === 'in') net.zoom(1.2);
      else if (a === 'out') net.zoom(1 / 1.2);
      else if (a === 'reset') net.reset();
      else if (a === 'spin') nb.setAttribute('aria-pressed', String(net.toggleSpin()));
    }
  });
  root.addEventListener('change', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLInputElement>('[data-kind]');
    if (!c || !net) return;
    if (c.checked) kinds.add(c.dataset.kind as EdgeKind);
    else kinds.delete(c.dataset.kind as EdgeKind);
    net.setKinds(new Set(kinds));
  });
  return { show: () => void load() };
}
