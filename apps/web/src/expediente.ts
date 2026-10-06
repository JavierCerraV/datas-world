// Expediente de vida a pantalla completa (spec 024 R-027): el encabezado con el retrato, el patrimonio y las acciones;
// seis pestañas (Resumen, Historia de vida, Memoria, Creencias, Charlas y Red); y en el Resumen el estado de hoy, el
// mazo de conducta, por qué decidió lo último y el camino de vida. Lee la ficha, el expediente, la historia de vida
// y el informe de la API; no decide nada.
import { criticalNeeds, dec, esc, meter, sexAge } from './card-compact.ts';
import { LifeData } from './card-life.ts';
import { showChatHistory } from './chat-history.ts';
import type { Dossier } from './dossier-types.ts';
import { deckHtml, decisionHtml, roadHtml } from './exp-cards.ts';
import { MORE_EVENTS, card, tabEmociones, tabEstado, tabHistoria, tabResumen } from './exp-tabs.ts';
import type { ExpData, HistFilter } from './exp-tabs.ts';
import { tabAprendizaje, tabCharlas, tabCreenciasExp, tabEconomia, tabMemoria, tabSalud, tabVinculos } from './exp-tabs2.ts';
import { ACTIVITY_ES, NEED_ES, money } from './format.ts';
import { avatar, icon } from './icons.ts';
import type { CitizenDetail } from './types.ts';
import { bindWhy } from './why.ts';

/** R-027: las seis pestañas del expediente. */
export const EXP_TABS: readonly [string, string][] = [
  ['resumen', 'Resumen'],
  ['historia', 'Historia de vida'],
  ['memoria', 'Memoria'],
  ['creencias', 'Creencias'],
  ['charlas', 'Charlas'],
  ['vinculos', 'Red'],
];

/** Las direcciones de antes (once pestañas) llevan a la pestaña donde vive ahora cada una. */
const TAB_ALIAS: Record<string, string> = { estado: 'resumen', aprendizaje: 'resumen', emociones: 'historia', salud: 'historia', economia: 'historia' };
export const tabId = (t?: string): string => {
  const id = TAB_ALIAS[t ?? ''] ?? t ?? 'resumen';
  return EXP_TABS.some(([k]) => k === id) ? id : 'resumen';
};

/** Resumen (R-027): estado de hoy, mazo de conducta, por qué decidió lo último y camino de vida; debajo, lo de antes. */
export function resumenBody(x: ExpData, life: Parameters<typeof tabAprendizaje>[1]): string {
  const d = x.d;
  const estado = card('Estado hoy', meter('Ánimo', d.state.mood, 'ok') + meter('Estrés', d.state.stress, 'bad') + Object.entries(d.needs).map(([k, v]) => meter(NEED_ES[k] ?? k, v)).join(''));
  return `<div class="rs-grid"><div class="col"><div class="grid-2">${estado}${card('Mazo de conducta', deckHtml(d.responses))}</div>`
    + `${card('Por qué decidió esto', decisionHtml(x))}${tabResumen(x)}`
    + `<details class="fold"><summary>Estado y necesidades</summary>${tabEstado(x)}</details>`
    + `<details class="fold"><summary>Aprendizaje</summary>${tabAprendizaje(x, life)}</details></div>`
    + `<div class="col">${card('Camino de vida', roadHtml(x.dos, d.age))}</div></div>`;
}

/** Historia de vida (R-027): la historia con sus causas y, debajo, las emociones, la salud y la economía. */
export function historiaBody(x: ExpData, hist: HistFilter): string {
  return `${tabHistoria(x, hist)}<div class="stack">${tabEmociones(x)}${tabSalud(x)}${tabEconomia(x)}</div>`;
}

/** Ventana inicial de eventos del expediente (022 R-015). */
export const DEFAULT_LIMIT = 150;
/** Carga ligera (024 R-027): solo estas pestañas piden la historia de vida y el informe. */
export const needsLife = (tab: string): boolean => tab === 'historia' || tab === 'memoria' || tab === 'vinculos';
/** Carga ligera (024 R-027): el expediente no se vuelve a pedir mientras el mundo no avance una hora. */
export const dossierStale = (fetchedAt: string | null, now: string): boolean => fetchedAt === null || fetchedAt.slice(0, 13) !== now.slice(0, 13);

export interface ExpDeps {
  fetchPerson: (id: string) => Promise<CitizenDetail>;
  fetchDossier: (id: string, limit?: number) => Promise<Dossier>;
  /** Fecha y hora del mundo que se ve (`2026-01-07 10:15`). */
  today: () => string;
  /** Lo que hace ahora, con el lugar. */
  doing: (id: string) => string;
  auth: () => string | null;
  onStartChat: (id: string, mode: 'in_world' | 'sandbox', test: boolean) => void;
  setTab: (id: string, tab: string) => void;
}

/** La franja de identidad bajo la cabecera. */
export function identityStrip(d: CitizenDetail, dos: Dossier | null, dateText = ''): string {
  const i = dos?.identity;
  const born = i ? ` (n. ${i.birthDate}${i.birthplace ? `, ${i.birthplace}` : ''})` : '';
  const parts = [sexAge(d) + born, i?.education, d.occupation?.orgName ? String(d.occupation.orgName) : null, d.household ? `Hogar ${d.household.id}` : null].filter(Boolean) as string[];
  const crit = criticalNeeds(d);
  const wealth = `<span class="chip" title="Dinero que tiene hoy"><span class="ci">${icon('coin', 18, 'var(--dw-gold)')}</span>${d.money === null ? 'sin datos' : esc(money(d.money))} <small>patrimonio</small></span>`
    + `<span class="chip locked" title="El salario aún no lo expone la API"><span class="ci">${icon('lock', 16, 'var(--dw-white)')}</span>Salario <small>Pronto</small></span>`;
  return `<div class="idstrip"><div class="hero-av">${avatar(d.id)}<span class="hero-shield">${icon('shield', 34, 'var(--dw-gold)')}</span></div>`
    + `<div class="hero-main"><h1>${esc(d.name)}</h1><p class="sub">${esc(parts.join(' · '))}</p><div class="tags"><span class="tag">${esc(d.id)}</span><span class="tag gold" id="exp-date">${esc(dateText)}</span></div></div>`
    + `<dl class="chips"><div><dt>Ahora</dt><dd>${esc(d.moving ? 'En camino' : (ACTIVITY_ES[d.activity] ?? d.activity).replace(/^./, (c) => c.toUpperCase()))}</dd></div>`
    + `<div><dt>Ánimo</dt><dd class="mono">${dec(d.state.mood)}</dd></div><div><dt>Estrés</dt><dd class="mono">${dec(d.state.stress)}</dd></div>`
    + `<div class="${crit.length ? 'alert' : ''}"><dt>Alertas</dt><dd>${crit.length ? `${crit.length} · ${esc(crit.map((c) => c.label.toLowerCase()).join(', '))}` : 'ninguna'}</dd></div></dl>`
    + `<div class="hero-money">${wealth}</div>`
    + `<div class="hero-act"><a class="btn" href="#/mundo/${esc(d.id)}">‹ Mundo</a><a class="btn accent" href="#/charla/${esc(d.id)}">Charlar</a><button class="btn" id="exp-json" type="button">Exportar JSON</button></div></div>`;
}

export function setupExpediente(dp: ExpDeps): { show: (id: string, tab?: string) => void; hide: () => void } {
  const root = document.querySelector<HTMLElement>('#view-exp')!;
  const life = new LifeData();
  let id: string | null = null;
  let tab = 'resumen';
  let hist: HistFilter = 'todos';
  let limit = DEFAULT_LIMIT;
  let fetchedAt: string | null = null;
  let detail: CitizenDetail | null = null;
  let dossier: Dossier | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastBody = '';
  bindWhy(root);

  const data = (): ExpData | null => (detail && dossier ? { d: detail, dos: dossier, report: life.report, today: dp.today(), doing: dp.doing(detail.id) } : null);

  const body = (x: ExpData): string => {
    switch (tab) {
      case 'historia': return historiaBody(x, hist);
      case 'vinculos': return tabVinculos(x, life.life);
      case 'memoria': return tabMemoria(life.life);
      case 'creencias': return tabCreenciasExp(x);
      case 'charlas': return tabCharlas(x);
      default: return resumenBody(x, life.life);
    }
  };

  const render = (full: boolean) => {
    if (!detail) return;
    if (full || !root.querySelector('#exp-body')) {
      root.innerHTML = `<div class="exp-scroll"><div id="exp-strip"></div><div class="tabs2" role="tablist" aria-label="Secciones del expediente">${EXP_TABS.map(([k, l]) => `<button role="tab" type="button" data-etab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div><div id="exp-body" role="tabpanel"></div></div>`;
      lastBody = '';
    }
    const strip = identityStrip(detail, dossier, `datos al ${dp.today()} · en vivo`);
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

  const load = async (force: boolean) => {
    const want = id;
    if (!want) return;
    const stale = force || !dossier || dossier.id !== want || dossierStale(fetchedAt, dp.today());
    const [d, dos] = await Promise.all([dp.fetchPerson(want), stale ? dp.fetchDossier(want, limit) : Promise.resolve(dossier!)]);
    if (id !== want) return;
    detail = d;
    if (stale) {
      dossier = dos;
      fetchedAt = dp.today();
    }
    if (needsLife(tab)) life.load(want, () => render(false));
    render(force);
  };

  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const tb = t.closest<HTMLElement>('[data-etab]');
    if (tb && id) {
      tab = tb.dataset.etab!;
      dp.setTab(id, tab);
      return;
    }
    if (t.closest('[data-more-events]')) {
      limit += MORE_EVENTS;
      void load(true);
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
      const next = tabId(t);
      const tabChanged = next !== tab;
      tab = next;
      if (changed) {
        id = pid;
        detail = null;
        dossier = null;
        fetchedAt = null;
        limit = DEFAULT_LIMIT;
        hist = 'todos';
        life.reset();
        root.innerHTML = '<p class="empty pad">Cargando el expediente…</p>';
        void load(true);
      } else if (tabChanged || !root.querySelector('#exp-body')) {
        if (id && needsLife(tab)) life.load(id, () => render(false));
        render(true);
      }
      clearInterval(timer);
      // En vivo: la ficha cada 5 s; el expediente solo cuando el mundo avanza una hora (R-027).
      timer = setInterval(() => void load(false), 5000);
    },
    hide: () => clearInterval(timer),
  };
}
