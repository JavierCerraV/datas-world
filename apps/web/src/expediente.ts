// Expediente de vida a pantalla completa (spec 024 R-022, Visor A+): migas de pan, «datos al … · en vivo», Exportar
// JSON, Charlar y Reducir; la franja de identidad con lo que hace ahora, su ánimo, su estrés y sus alertas; y las
// pestañas. Lee la ficha, el expediente, la historia de vida y el informe de la API; no decide nada.
import { criticalNeeds, dec, esc, sexAge } from './card-compact.ts';
import { LifeData } from './card-life.ts';
import { showChatHistory } from './chat-history.ts';
import type { Dossier } from './dossier-types.ts';
import { tabEmociones, tabEstado, tabHistoria, tabResumen } from './exp-tabs.ts';
import type { ExpData, HistFilter } from './exp-tabs.ts';
import { tabAprendizaje, tabCharlas, tabCreenciasExp, tabEconomia, tabMemoria, tabSalud, tabVinculos } from './exp-tabs2.ts';
import { ACTIVITY_ES } from './format.ts';
import type { CitizenDetail } from './types.ts';
import { bindWhy } from './why.ts';

export const EXP_TABS: readonly [string, string][] = [
  ['resumen', 'Resumen'],
  ['estado', 'Estado y necesidades'],
  ['emociones', 'Emociones'],
  ['historia', 'Historia'],
  ['vinculos', 'Vínculos'],
  ['memoria', 'Memoria'],
  ['creencias', 'Creencias'],
  ['aprendizaje', 'Aprendizaje'],
  ['salud', 'Salud'],
  ['economia', 'Economía y objetos'],
  ['charlas', 'Charlas'],
];

export interface ExpDeps {
  fetchPerson: (id: string) => Promise<CitizenDetail>;
  fetchDossier: (id: string) => Promise<Dossier>;
  /** Fecha y hora del mundo que se ve (`2026-01-07 10:15`). */
  today: () => string;
  /** Lo que hace ahora, con el lugar. */
  doing: (id: string) => string;
  auth: () => string | null;
  onStartChat: (id: string, mode: 'in_world' | 'sandbox', test: boolean) => void;
  setTab: (id: string, tab: string) => void;
}

/** La franja de identidad bajo la cabecera. */
export function identityStrip(d: CitizenDetail, dos: Dossier | null): string {
  const i = dos?.identity;
  const born = i ? ` (n. ${i.birthDate}${i.birthplace ? `, ${i.birthplace}` : ''})` : '';
  const parts = [sexAge(d) + born, i?.education, d.occupation?.orgName ? String(d.occupation.orgName) : null, d.household ? `Hogar ${d.household.id}` : null].filter(Boolean) as string[];
  const crit = criticalNeeds(d);
  return `<div class="idstrip"><div><h1>${esc(d.name)}</h1><p class="sub">${esc(parts.join(' · '))}</p></div><span class="grow"></span>`
    + `<dl class="chips"><div><dt>Ahora</dt><dd>${esc(d.moving ? 'En camino' : (ACTIVITY_ES[d.activity] ?? d.activity).replace(/^./, (c) => c.toUpperCase()))}</dd></div>`
    + `<div><dt>Ánimo</dt><dd class="mono">${dec(d.state.mood)}</dd></div><div><dt>Estrés</dt><dd class="mono">${dec(d.state.stress)}</dd></div>`
    + `<div class="${crit.length ? 'alert' : ''}"><dt>Alertas</dt><dd>${crit.length ? `${crit.length} · ${esc(crit.map((c) => c.label.toLowerCase()).join(', '))}` : 'ninguna'}</dd></div></dl></div>`;
}

export function setupExpediente(dp: ExpDeps): { show: (id: string, tab?: string) => void; hide: () => void } {
  const root = document.querySelector<HTMLElement>('#view-exp')!;
  const life = new LifeData();
  let id: string | null = null;
  let tab = 'resumen';
  let hist: HistFilter = 'todos';
  let detail: CitizenDetail | null = null;
  let dossier: Dossier | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastBody = '';
  bindWhy(root);

  const data = (): ExpData | null => (detail && dossier ? { d: detail, dos: dossier, report: life.report, today: dp.today(), doing: dp.doing(detail.id) } : null);

  const body = (x: ExpData): string => {
    switch (tab) {
      case 'estado': return tabEstado(x);
      case 'emociones': return tabEmociones(x);
      case 'historia': return tabHistoria(x, hist);
      case 'vinculos': return tabVinculos(x, life.life);
      case 'memoria': return tabMemoria(life.life);
      case 'creencias': return tabCreenciasExp(x);
      case 'aprendizaje': return tabAprendizaje(x, life.life);
      case 'salud': return tabSalud(x);
      case 'economia': return tabEconomia(x);
      case 'charlas': return tabCharlas(x);
      default: return tabResumen(x);
    }
  };

  const render = (full: boolean) => {
    if (!detail) return;
    if (full || !root.querySelector('#exp-body')) {
      root.innerHTML = `<header class="bar"><nav class="crumbs" aria-label="Ruta"><a href="#/mundo">Mundo</a><span>/</span><a href="#/mundo">Personas</a><span>/</span><b>Expediente ${esc(detail.id)}</b></nav>`
        + `<span class="sub" id="exp-date"></span><span class="grow"></span>`
        + `<button class="btn" id="exp-json" type="button">Exportar JSON</button><a class="btn primary" href="#/charla/${esc(detail.id)}">Charlar</a><a class="btn" href="#/mundo/${esc(detail.id)}">Reducir</a></header>`
        + `<div class="exp-scroll"><div id="exp-strip"></div><div class="tabs2" role="tablist" aria-label="Secciones del expediente">${EXP_TABS.map(([k, l]) => `<button role="tab" type="button" data-etab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div><div id="exp-body" role="tabpanel"></div></div>`;
      lastBody = '';
    }
    root.querySelector('#exp-date')!.textContent = `datos al ${dp.today()} · en vivo`;
    const strip = identityStrip(detail, dossier);
    const s = root.querySelector('#exp-strip')!;
    if (s.innerHTML !== strip) s.innerHTML = strip;
    const x = data();
    const el = root.querySelector<HTMLElement>('#exp-body')!;
    const html = x ? body(x) : '<p class="empty">Cargando el expediente…</p>';
    if (html === lastBody) return;
    // La pestaña Charlas tiene un formulario: no se repinta sola (se perdería lo elegido).
    if (!full && lastBody && tab === 'charlas') return;
    // Se repinta la pestaña solo si cambió y no hay nada desplegado que se perdería.
    if (!full && lastBody && el.querySelector('details[open]:not([data-why])')) return;
    el.innerHTML = html;
    lastBody = html;
    if (tab === 'charlas' && x) void showChatHistory(el.querySelector('#exp-chats')!, x.d.id, dp.auth);
  };

  const load = async (full: boolean) => {
    const want = id;
    if (!want) return;
    const [d, dos] = await Promise.all([dp.fetchPerson(want), dossier?.id === want && !full ? Promise.resolve(dossier) : dp.fetchDossier(want)]);
    if (id !== want) return;
    detail = d;
    dossier = dos;
    life.load(want, () => render(false));
    render(full);
  };

  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const tb = t.closest<HTMLElement>('[data-etab]');
    if (tb && id) {
      tab = tb.dataset.etab!;
      dp.setTab(id, tab);
      return;
    }
    const hb = t.closest<HTMLElement>('[data-hist]');
    if (hb) {
      hist = hb.dataset.hist as HistFilter;
      return render(true);
    }
    const p = t.closest<HTMLElement>('[data-person]');
    if (p) return void (location.hash = `#/expediente/${p.dataset.person}`);
    if (t.closest('#exp-json') && detail) {
      const blob = new Blob([JSON.stringify({ ficha: detail, expediente: dossier, vida: life.life, informe: life.report }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `expediente-${detail.id}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
  });
  root.addEventListener('submit', (e) => {
    const f = e.target as HTMLFormElement;
    if (f.id !== 'exp-chat-start' || !id) return;
    e.preventDefault();
    const mode = (f.querySelector<HTMLInputElement>('input[name="exp-mode"]:checked')?.value ?? 'in_world') as 'in_world' | 'sandbox';
    dp.onStartChat(id, mode, f.querySelector<HTMLInputElement>('#exp-test')!.checked);
  });

  return {
    show: (pid, t) => {
      const changed = pid !== id;
      const tabChanged = (t ?? 'resumen') !== tab;
      tab = EXP_TABS.some(([k]) => k === t) ? t! : 'resumen';
      if (changed) {
        id = pid;
        detail = null;
        dossier = null;
        hist = 'todos';
        life.reset();
        root.innerHTML = '<p class="empty pad">Cargando el expediente…</p>';
        void load(true);
      } else if (tabChanged || !root.querySelector('#exp-body')) {
        render(true);
      }
      clearInterval(timer);
      // En vivo: la ficha cada 5 s y el expediente completo cada 30 s.
      let n = 0;
      timer = setInterval(() => void load(++n % 6 === 0), 5000);
    },
    hide: () => clearInterval(timer),
  };
}
