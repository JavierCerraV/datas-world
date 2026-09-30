// Visor de Data's World (spec 024 v0.4), como el prototipo: barra superior, mapa en vivo con los trayectos
// reproducidos, registro de eventos e inspector. Une los módulos; solo lee de la API (022) y envía órdenes de
// control. No tiene lógica de simulación (INV-002).
import { api, stream } from './api.ts';
import { askAuth, auth, send } from './auth.ts';
import { setupChat } from './chat-ui.ts';
import { clockOf } from './camera.ts';
import { setupInspector } from './inspector.ts';
import { setupLog } from './logview.ts';
import { setupMap } from './mapview.ts';
import { doingOf, populationIntro } from './panels.ts';
import { drawMap } from './render.ts';
import { MoveBook, stepView } from './replay.ts';
import { routeCache } from './streets.ts';
import { setupTimeline, urlsFor } from './timeline.ts';
import type { Moment } from './timeline.ts';
import { SPEEDS, setupTopbar } from './topbar.ts';
import type { CitizenDetail, CitizenPosition, Stats, WorldView } from './types.ts';
import { setupWorldPanel } from './world-panel.ts';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
let msgTimer: ReturnType<typeof setTimeout> | undefined;
const message = (text: string) => {
  $('#msg').textContent = text;
  clearTimeout(msgTimer);
  if (text) msgTimer = setTimeout(() => ($('#msg').textContent = ''), 6000);
};

let world: WorldView;
let people: CitizenPosition[] = [];
const book = new MoveBook();
const pastBook = new MoveBook(); // en un día pasado no hay viajes: todos en su sitio
let latest = 0; // último minuto guardado
let view: number | null = null; // minuto de la vista (024 R-013)
let status = 'running';
let speed = 1;
let stats: Stats | null = null;
let moment: Moment = { mode: 'live' };
const selected = { person: null as string | null, place: null as string | null };

const names = (id: string) => world.names?.[id] ?? world.places.find((p) => p.id === id)?.name;
const minuteNow = () => (moment.mode === 'past' ? moment.day * 1440 : view ?? latest);

async function loadPeople(): Promise<void> {
  people = await api.at<CitizenPosition[]>(urlsFor(moment).citizens);
}

async function loadStats(): Promise<void> {
  if (moment.mode !== 'live') return;
  stats = await api.stats();
  topbar.setStats(stats, latest);
}

const topbar = setupTopbar({ message, status: () => status });
const log = setupLog({ openPerson: (id) => inspector.select(id) });

// Se crean en `start`, cuando ya se conoce el mapa.
let map: ReturnType<typeof setupMap> | null = null;
const doing = (c: CitizenPosition) => doingOf(c, map?.where(c.id), names);
const fetchPerson = (id: string) => api.at<CitizenDetail>(urlsFor(moment).citizen(id));

const inspector = setupInspector({
  people: () => people,
  doing,
  intro: () => populationIntro(stats?.population ?? people.length, stats?.households ?? 0, stats?.districts ?? 0),
  fetchPerson,
  fetchPlace: (id) => api.place(id),
  auth,
  askAuth,
  onSelect: (person, place) => {
    selected.person = person;
    selected.place = place;
    if (!person) map?.setFollow(false);
  },
  onChat: (d) => chat.open(d),
  toggleFollow: () => map?.setFollow(!map.following()),
  following: () => map?.following() ?? false,
});

const chat = setupChat({
  auth,
  askAuth,
  fetchPerson,
  onClose: () => {
    if (selected.person) inspector.select(selected.person);
  },
});

setupWorldPanel({ button: $('#btn-world') as HTMLButtonElement, dialog: $('#world') as HTMLDialogElement, body: $('#world-body'), close: $('#world-close') as HTMLButtonElement, fetch: api.metrics });

const timeline = setupTimeline({
  fetchDays: api.days,
  onChange: (m) => {
    moment = m;
    void loadPeople().then(() => inspector.refresh());
    if (selected.person) inspector.select(selected.person);
  },
});

let shownMinute = -1;
async function start(): Promise<void> {
  world = await api.world();
  if (!world.geo) throw new Error('El mundo no tiene mapa');
  $('#title').textContent = world.name;
  latest = world.now;
  status = world.status;
  const [health, moves, events] = await Promise.all([api.health(), api.moves(world.now - 180), api.events(200)]);
  speed = health.speed;
  book.add(moves);
  log.add(events);
  await Promise.all([loadPeople(), loadStats(), timeline.refresh()]);
  topbar.setWorld(status, speed);
  inspector.showPopulation();
  map = setupMap({
    world,
    layer: drawMap(world),
    route: routeCache(world.geo),
    book: () => (moment.mode === 'past' ? pastBook : book),
    people: () => people,
    tick: (dt) => {
      view = stepView(view, latest, speed, dt, status === 'paused');
      const m = Math.floor(minuteNow());
      if (m !== shownMinute) {
        shownMinute = m;
        topbar.setClock(world.epoch, m);
        log.setToday(clockOf(world.epoch, m).iso);
      }
      return minuteNow();
    },
    selected: () => selected,
    doing,
    onPerson: (id) => inspector.select(id),
    onPlace: (id) => inspector.showPlace(id),
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

// Teclado (024 R-005): espacio pausa, + y − velocidad, flechas mueven la cámara, Esc vuelve a la población.
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) || chat.isOpen() || document.querySelector('dialog[open]')) return;
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
  else if (e.key === 'Escape') inspector.showPopulation();
});

start().catch((err: unknown) => message(`No se pudo conectar con la API: ${String(err)}. ¿Está corriendo \`pnpm dev\`?`));
