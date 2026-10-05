// Visor de Data's World (spec 024 v0.6): barra superior con pestañas para Mundo, Expediente, Dashboard y Charla. Une los módulos; solo lee de la API (022) y envía órdenes de control. No tiene lógica de simulación
// (INV-002).
import { api, stream } from './api.ts';
import { askAuth, auth, send } from './auth.ts';
import { clockOf } from './camera.ts';
import { setupChat } from './chat-ui.ts';
import { setupDashboard } from './dashboard.ts';
import { setupExpediente } from './expediente.ts';
import { setupInspector } from './inspector.ts';
import { setupLog } from './logview.ts';
import { setupMap } from './mapview.ts';
import { renderNow, setupLayers } from './overlays.ts';
import { doingOf, populationIntro } from './panels.ts';
import { drawMap } from './render.ts';
import { MoveBook, stepView } from './replay.ts';
import { setupRouter, tabHref } from './router.ts';
import type { Route } from './router.ts';
import { routeCache } from './streets.ts';
import { setupTimeline, urlsFor } from './timeline.ts';
import type { Moment } from './timeline.ts';
import { SPEEDS, setupTopbar } from './topbar.ts';
import type { CitizenDetail, CitizenPosition, Stats, WorldView } from './types.ts';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
let msgTimer: ReturnType<typeof setTimeout> | undefined;
const message = (text: string) => {
  $('#msg').textContent = text;
  clearTimeout(msgTimer);
  if (text) msgTimer = setTimeout(() => ($('#msg').textContent = ''), 6000);
};

// Tema claro u oscuro: el del sistema, salvo que se elija otro (se recuerda en este navegador).
try {
  const t = localStorage.getItem('dw.theme');
  if (t) document.documentElement.dataset.theme = t;
} catch {
  // Sin almacenamiento local, el del sistema.
}
$('#theme').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  try {
    localStorage.setItem('dw.theme', document.documentElement.dataset.theme);
  } catch {
    // No importa.
  }
});

let world: WorldView | null = null;
let people: CitizenPosition[] = [];
const book = new MoveBook();
const pastBook = new MoveBook(); // en un día pasado no hay viajes: todos en su sitio
let latest = 0; // último minuto guardado
let view: number | null = null; // minuto de la vista (024 R-013)
let status = 'running';
let speed = 1;
let stats: Stats | null = null;
let orgs: number | undefined;
let moment: Moment = { mode: 'live' };
const selected = { person: null as string | null, place: null as string | null };
let tabPerson: string | null = null; // la última persona abierta: a ella llevan las pestañas Expediente y Charla

/** Las pestañas Expediente y Charla abren a la última persona elegida; sin ninguna, se muestran desactivadas. */
function refreshTabs(): void {
  for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-nav="expediente"], [data-nav="charla"]')) {
    const href = tabHref(a.dataset.nav as 'expediente' | 'charla', tabPerson);
    a.href = href ?? '#/mundo';
    if (href) a.removeAttribute('aria-disabled');
    else a.setAttribute('aria-disabled', 'true');
  }
}

const names = (id: string) => world?.names?.[id] ?? world?.places.find((p) => p.id === id)?.name;
const minuteNow = () => (moment.mode === 'past' ? moment.day * 1440 : view ?? latest);
const worldDate = () => (world ? (({ iso, time }) => `${iso} ${time}`)(clockOf(world.epoch, minuteNow())) : '');

async function loadPeople(): Promise<void> {
  people = await api.at<CitizenPosition[]>(urlsFor(moment).citizens);
}

async function loadStats(): Promise<void> {
  if (moment.mode !== 'live') return;
  const [s, g] = await Promise.all([api.stats(), api.demographics('year').catch(() => null)]);
  stats = s;
  if (g) {
    orgs = g.organizations;
    renderNow(g.now);
  }
  topbar.setStats(stats, latest, orgs);
}

const topbar = setupTopbar({ message, status: () => status });
const layers = setupLayers();
const log = setupLog({ openPerson: (id) => router.go({ view: 'mundo', person: id }) });

// Se crea en `start`, cuando ya se conoce el mapa.
let map: ReturnType<typeof setupMap> | null = null;
const doing = (c: CitizenPosition) => doingOf(c, map?.where(c.id), names);
const doingId = (id: string) => {
  const c = people.find((x) => x.id === id);
  return c ? doing(c) : '';
};
const fetchPerson = (id: string) => api.at<CitizenDetail>(urlsFor(moment).citizen(id));

const inspector = setupInspector({
  people: () => people,
  doing,
  intro: () => populationIntro(stats?.population ?? people.length, stats?.households ?? 0, stats?.districts ?? 0),
  fetchPerson,
  fetchDossier: api.dossier,
  fetchPlace: (id) => api.place(id),
  onSelect: (person, place) => {
    selected.person = person;
    selected.place = place;
    if (person) tabPerson = person;
    refreshTabs();
    if (!person) map?.setFollow(false);
    const want = person ? `#/mundo/${person}` : '#/mundo';
    if (router.current().view === 'mundo' && location.hash !== want) history.replaceState(null, '', want);
  },
  toggleFollow: () => map?.setFollow(!map.following()),
  following: () => map?.following() ?? false,
});

const expediente = setupExpediente({
  fetchPerson,
  fetchDossier: api.dossier,
  today: worldDate,
  doing: doingId,
  auth,
  askAuth,
  onStartChat: (id, mode, test) => {
    chatPrefs = { mode, test };
    router.go({ view: 'charla', person: id });
  },
  setTab: (id, tab) => router.go({ view: 'expediente', person: id, tab }),
});

let chatPrefs: { mode: 'in_world' | 'sandbox'; test: boolean } | undefined;
const chat = setupChat({
  auth,
  askAuth,
  fetchPerson,
  fetchDossier: api.dossier,
  worldMinute: minuteNow,
  clock: (m) => (world ? clockOf(world.epoch, m).time : ''),
});

const dashboard = setupDashboard({ fetch: api.demographics, metrics: api.metrics });

const router = setupRouter((r: Route, prev) => {
  if (r.view !== 'datos' && r.person) tabPerson = r.person;
  refreshTabs();
  if (prev?.view === 'charla' && r.view !== 'charla') chat.leave();
  if (prev?.view === 'expediente' && r.view !== 'expediente') expediente.hide();
  if (r.view === 'mundo') {
    if (r.person && r.person !== selected.person) inspector.select(r.person);
    else if (!r.person && prev?.view === 'mundo' && selected.person) inspector.showPopulation();
  } else if (r.view === 'expediente') expediente.show(r.person, r.tab);
  else if (r.view === 'charla') {
    chat.show(r.person, chatPrefs);
    chatPrefs = undefined;
  } else if (r.view === 'datos') dashboard.show();
});

const timeline = setupTimeline({
  fetchDays: api.days,
  onChange: (m) => {
    moment = m;
    void loadPeople().then(() => inspector.refresh());
    if (selected.person) inspector.select(selected.person);
  },
});
$('#tl-open').addEventListener('click', () => {
  const row = $('#tlrow');
  row.hidden = !row.hidden;
  $('#tl-open').setAttribute('aria-expanded', String(!row.hidden));
  $('#tl-open').textContent = row.hidden ? 'Abrir línea de tiempo' : 'Cerrar línea de tiempo';
});

let shownMinute = -1;
async function start(): Promise<void> {
  const w = await api.world();
  world = w;
  if (!w.geo) throw new Error('El mundo no tiene mapa');
  $('#crumb').textContent = w.name;
  latest = w.now;
  status = w.status;
  const [health, moves, events] = await Promise.all([api.health(), api.moves(w.now - 180), api.events(200)]);
  speed = health.speed;
  book.add(moves);
  log.add(events);
  await Promise.all([loadPeople(), loadStats(), timeline.refresh()]);
  topbar.setWorld(status, speed);
  if (!selected.person) inspector.showPopulation();
  map = setupMap({
    world: w,
    layer: drawMap(w),
    route: routeCache(w.geo),
    book: () => (moment.mode === 'past' ? pastBook : book),
    people: () => people,
    tick: (dt) => {
      view = stepView(view, latest, speed, dt, status === 'paused');
      const m = Math.floor(minuteNow());
      if (m !== shownMinute) {
        shownMinute = m;
        topbar.setClock(w.epoch, m);
        log.setToday(clockOf(w.epoch, m).iso);
      }
      return minuteNow();
    },
    selected: () => selected,
    doing,
    onPerson: (id) => router.go({ view: 'mundo', person: id }),
    onPlace: (id) => inspector.showPlace(id),
    layers: layers.get,
    bonds: () => (inspector.detail()?.bonds ?? []).map((b) => b.id),
  });
  stream({
    tick: (t) => {
      const newDay = Math.floor(t.now / 1440) !== Math.floor(latest / 1440);
      latest = t.now;
      status = t.status;
      topbar.setWorld(status, speed);
      if (t.moves) book.add(t.moves);
      book.prune((view ?? latest) - 1440);
      if (newDay) void timeline.refresh();
      if (moment.mode === 'live') void loadPeople().then(() => inspector.refresh());
      void loadStats();
    },
    event: (e) => {
      log.add([e]);
      if (e.type === 'SPEED_CHANGED') {
        speed = (e.payload.to as number) ?? speed;
        topbar.setWorld(status, speed);
      }
    },
    status: (ok) => ($('#live').textContent = ok ? '● en vivo' : '○ reconectando…'),
  });
  // La población y la ficha se repintan cada segundo aunque no llegue un tick (el reloj de la vista avanza).
  setInterval(() => inspector.refresh(), 1000);
}

// Teclado (024 R-005), solo en la pantalla Mundo: espacio pausa, + y − velocidad, flechas mueven la cámara, Esc
// vuelve a la población.
window.addEventListener('keydown', (e) => {
  if (router.current().view !== 'mundo') return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) || document.querySelector('dialog[open]')) return;
  const i = SPEEDS.findIndex(([v]) => Math.abs(v - speed) < 1e-9);
  if (e.key === ' ') {
    e.preventDefault();
    void send(status === 'paused' ? 'resume' : 'pause').then((m) => message(m ?? ''));
  } else if (e.key === '+' && i < SPEEDS.length - 1) void send('speed', SPEEDS[i + 1]![0]).then((m) => message(m ?? ''));
  else if (e.key === '-' && i > 0) void send('speed', SPEEDS[i - 1]![0]).then((m) => message(m ?? ''));
  else if (e.key === 'ArrowLeft') map?.pan(-40, 0);
  else if (e.key === 'ArrowRight') map?.pan(40, 0);
  else if (e.key === 'ArrowUp') map?.pan(0, -40);
  else if (e.key === 'ArrowDown') map?.pan(0, 40);
  else if (e.key === 'Escape') router.go({ view: 'mundo' });
});

start().catch((err: unknown) => message(`No se pudo conectar con la API: ${String(err)}. ¿Está corriendo \`pnpm dev\`?`));
