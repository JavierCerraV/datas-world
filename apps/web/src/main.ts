// Visor mínimo (spec 024): mapa, personas, día y noche, inspector, registro de eventos y controles. Solo lee de la
// API (022); no tiene lógica de simulación (INV-002).
import { api, control, stream } from './api.ts';
import { showChatHistory } from './chat-history.ts';
import { showLife } from './life.ts';
import { bindWhy, whyToggle } from './why.ts';
import { setupChat } from './chat-ui.ts';
import { eventEs, inspectorTabs } from './format.ts';
import type { Section } from './format.ts';
import { TS, interpolate, nightAlpha, spread, timeOf } from './logic.ts';
import { drawMap, drawPerson } from './render.ts';
import { placeAt, setupPeoplePanel } from './panels.ts';
import { onTheWay, routeCache } from './streets.ts';
import { setupMapInput } from './input.ts';
import { setupTimeline, urlsFor } from './timeline.ts';
import type { Moment } from './timeline.ts';
import { setupWorldPanel } from './world-panel.ts';
import type { CitizenDetail, CitizenPosition, WorldView } from './types.ts';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const canvas = $<HTMLCanvasElement>('#map');
const g = canvas.getContext('2d')!;
const SPEEDS = [0, 1 / 60, 1, 10, 100, 1000]; // 1/60 = tiempo real (002 R-003)

let world: WorldView;
let mapLayer: HTMLCanvasElement;
let scale = 3;
let cam = { x: 0, y: 0 }; // esquina superior izquierda, en px del mapa
let prev = new Map<string, CitizenPosition>();
let next: CitizenPosition[] = [];
let updatedAt = 0;
let drawn: { id: string; x: number; y: number }[] = [];
let selected: string | null = null;
let clock = { date: '', status: '' };
let speed = 1;
let credentials: string | null = sessionStorageGet('dw-auth');

function sessionStorageGet(k: string): string | null {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}

let nowMin = 0; // minuto del mundo de la última actualización
let route: ReturnType<typeof routeCache> | null = null; // 024 R-009
let people: ReturnType<typeof setupPeoplePanel> | null = null; // 024 R-008
let moment: Moment = { mode: 'live' }; // 024 R-010: el presente o un día pasado
let timeline: ReturnType<typeof setupTimeline> | null = null;

async function refreshPeople(): Promise<void> {
  // 024 R-009: quien va de camino se dibuja por la calle, no en línea recta (en un día pasado, a medianoche).
  const minute = moment.mode === 'past' ? moment.day * 1440 : nowMin;
  const list = (await api.at<CitizenPosition[]>(urlsFor(moment).citizens)).map((c) => (c.trip && route ? { ...c, ...onTheWay(route, c.trip, minute) } : c));
  prev = new Map(next.map((c) => [c.id, c]));
  next = list;
  updatedAt = performance.now();
  $('#pop').textContent = `${list.length} personas`;
  if (selected) void openInspector(selected, false);
  else people?.refresh();
}

function resize(): void {
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.floor(r.width);
  canvas.height = Math.floor(r.height);
  g.imageSmoothingEnabled = false;
}

let frames = 0;
let fpsAt = performance.now();
function frame(t: number): void {
  const w = canvas.width;
  const h = canvas.height;
  g.fillStyle = '#5B8440';
  g.fillRect(0, 0, w, h);
  g.imageSmoothingEnabled = false;
  g.drawImage(mapLayer, -cam.x * scale, -cam.y * scale, mapLayer.width * scale, mapLayer.height * scale);
  drawn = spread(interpolate(prev, next, (t - updatedAt) / 1000));
  for (const p of drawn) drawPerson(g, p.id, (p.x * TS - cam.x) * scale, (p.y * TS - cam.y) * scale, Math.max(1, Math.floor(scale / 2)), p.id === selected);
  const { hour, minute } = timeOf(clock.date);
  const a = nightAlpha(hour, minute);
  if (a > 0) {
    g.fillStyle = `rgba(16,24,64,${a})`;
    g.fillRect(0, 0, w, h);
  }
  frames++;
  if (t - fpsAt > 1000) {
    $('#fps').textContent = `${Math.round((frames * 1000) / (t - fpsAt))} fps`;
    frames = 0;
    fpsAt = t;
  }
  requestAnimationFrame(frame);
}

function renderSections(sections: Section[]): string {
  return sections
    .filter((s) => s.rows.length)
    .map((s) => `<h3>${s.title}</h3><dl>${s.rows.map((r) => `<dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd>`).join('')}</dl>`)
    .join('');
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

let tab: 'estado' | 'historia' | 'funcional' | 'vida' | 'charlas' = 'estado';
let detail: CitizenDetail | null = null;
let chatsShownFor: string | null = null;
let lifeShownFor: string | null = null;
function renderInspector(): void {
  if (!detail) return;
  const t = inspectorTabs(detail);
  $('#insp-name').textContent = detail.name;
  for (const b of document.querySelectorAll<HTMLButtonElement>('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  // Las charlas no cambian con cada tick: se cargan al entrar en la pestaña o al cambiar de persona.
  if (tab === 'charlas') {
    if (chatsShownFor !== detail.id) void showChatHistory($('#insp-body'), detail.id, () => credentials, askAuth);
    chatsShownFor = detail.id;
    return;
  }
  chatsShownFor = null;
  // La historia de vida (041 R-009) tampoco cambia con los ticks: se carga una vez por persona.
  if (tab === 'vida') {
    if (lifeShownFor !== detail.id) void showLife($('#insp-body'), detail.id);
    lifeShownFor = detail.id;
    return;
  }
  lifeShownFor = null;
  $('#insp-body').innerHTML =
    tab === 'estado'
      ? renderSections(t.estado)
      : tab === 'funcional'
        ? renderSections(t.funcional)
        : t.historia.length
          ? `<ol class="hist">${t.historia.map((h) => `<li>${esc(h.line)}${h.causes.length ? `<small>por: ${h.causes.map(esc).join(' · ')}</small>` : ''}${whyToggle(h.id)}</li>`).join('')}</ol>`
          : '<p>Sin hechos recientes.</p>';
}

async function openInspector(id: string, focus = true): Promise<void> {
  selected = id;
  detail = await api.at<CitizenDetail>(urlsFor(moment).citizen(id));
  $('#inspector').hidden = false;
  $('#people').hidden = true;
  renderInspector();
  if (focus) $<HTMLButtonElement>('#insp-close').focus();
}

function closeInspector(): void {
  selected = null;
  detail = null;
  $('#inspector').hidden = true;
  $('#people').hidden = false;
  people?.refresh();
}

/** La persona dibujada más cerca de un punto del mapa (en tiles). */
function pick(mx: number, my: number): string | null {
  let best: { id: string; d: number } | null = null;
  for (const p of drawn) {
    const d = Math.hypot(p.x - mx, p.y - 0.4 - my);
    if (d < 0.9 && (!best || d < best.d)) best = { id: p.id, d };
  }
  return best?.id ?? null;
}

function addLog(line: string): void {
  const li = document.createElement('li');
  li.textContent = line;
  const ul = $('#log');
  ul.prepend(li);
  while (ul.children.length > 60) ul.lastChild!.remove();
}

/** Pide usuario y contraseña de los controles (y de la charla); devuelve false si se cancela. */
function askAuth(): boolean {
  const user = prompt('Usuario de los controles');
  const pass = user ? prompt('Contraseña') : null;
  if (!user || !pass) return false;
  credentials = btoa(`${user}:${pass}`);
  try {
    sessionStorage.setItem('dw-auth', credentials);
  } catch {
    /* sin almacenamiento: se pedirá otra vez */
  }
  return true;
}

async function send(cmd: 'pause' | 'resume' | 'speed' | 'step', arg?: number): Promise<void> {
  let code = await control(cmd, arg, credentials);
  if (code === 401) {
    if (!askAuth()) return;
    code = await control(cmd, arg, credentials);
  }
  $('#msg').textContent = code === 200 ? 'Orden enviada' : code === 503 ? 'Controles desactivados (define DATAS_WORLD_USER y DATAS_WORLD_PASSWORD)' : `No se pudo (${code})`;
}

function setSpeed(delta: number): void {
  const i = Math.max(0, Math.min(SPEEDS.length - 1, SPEEDS.indexOf(speed) + delta));
  speed = SPEEDS[i]!;
  void send('speed', speed);
}

function setScale(s: number, cx = canvas.width / 2, cy = canvas.height / 2): void {
  const ns = Math.max(1, Math.min(6, s));
  cam = { x: cam.x + cx / scale - cx / ns, y: cam.y + cy / scale - cy / ns };
  scale = ns;
  $('#zoom').textContent = `×${scale}`;
}

async function start(): Promise<void> {
  world = await api.world();
  if (!world.geo) throw new Error('El mundo no tiene mapa');
  mapLayer = drawMap(world);
  route = routeCache(world.geo);
  nowMin = world.now;
  people = setupPeoplePanel({ list: () => next, openPerson: (id) => void openInspector(id), fetchPlace: (id) => api.place(id) });
  timeline = setupTimeline({
    fetchDays: api.days,
    onChange: (m) => {
      moment = m;
      void refreshPeople();
    },
  });
  await timeline.refresh();
  $('#title').textContent = world.name;
  clock = { date: world.date, status: world.status };
  $('#date').textContent = world.date;
  resize();
  scale = Math.max(1, Math.min(6, Math.floor(Math.min(canvas.width / mapLayer.width, canvas.height / mapLayer.height)) || 1));
  $('#zoom').textContent = `×${scale}`;
  const h = await api.health();
  speed = h.speed;
  for (const e of (await api.events(30)).reverse()) addLog(eventEs(e));
  await refreshPeople();
  stream({
    tick: (t) => {
      // Un día nuevo trae una instantánea más para la línea temporal.
      if (Math.floor(t.now / 1440) !== Math.floor(nowMin / 1440)) void timeline?.refresh();
      clock = t;
      nowMin = t.now;
      $('#date').textContent = `${t.date}${t.status === 'paused' ? ' · en pausa' : ''}`;
      // Mirando el pasado, el mapa no se mueve con los ticks.
      if (moment.mode === 'live') void refreshPeople();
    },
    event: (e) => {
      if (e.type !== 'DAY_STARTED' && e.type !== 'TRIP_TAKEN') addLog(eventEs(e));
      if (e.type === 'SPEED_CHANGED') speed = (e.payload.to as number) ?? speed;
    },
    status: (ok) => ($('#live').textContent = ok ? '● en vivo' : '○ reconectando…'),
  });
  requestAnimationFrame(frame);
}

// Interacción: arrastrar mueve la cámara; la rueda y los botones cambian el zoom; un clic abre a la persona o, si no
// hay nadie, la ficha del lugar (024 R-008).
setupMapInput({
  canvas,
  pan: (dx, dy) => (cam = { x: cam.x - dx / scale, y: cam.y - dy / scale }),
  zoom: (step, cx, cy) => setScale(scale + step, cx, cy),
  click: (x, y) => {
    const mx = x / scale / TS + cam.x / TS;
    const my = y / scale / TS + cam.y / TS;
    const id = pick(mx, my);
    if (id) return void openInspector(id);
    const p = placeAt(world.places, mx, my);
    if (!p) return;
    closeInspector();
    void people?.showPlace(p.id);
  },
});
window.addEventListener('resize', resize);
window.addEventListener('keydown', (e) => {
  // Los atajos no actúan al escribir ni con la charla abierta (043 R-017).
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) || $<HTMLDialogElement>('#chat').open) return;
  const step = 24 / scale;
  if (e.key === ' ') {
    e.preventDefault();
    void send(clock.status === 'paused' ? 'resume' : 'pause');
  } else if (e.key === '+') setSpeed(1);
  else if (e.key === '-') setSpeed(-1);
  else if (e.key === 'ArrowLeft') cam = { ...cam, x: cam.x - step };
  else if (e.key === 'ArrowRight') cam = { ...cam, x: cam.x + step };
  else if (e.key === 'ArrowUp') cam = { ...cam, y: cam.y - step };
  else if (e.key === 'ArrowDown') cam = { ...cam, y: cam.y + step };
  else if (e.key === 'Escape') closeInspector();
});
$('#btn-pause').addEventListener('click', () => void send(clock.status === 'paused' ? 'resume' : 'pause'));
$('#btn-step').addEventListener('click', () => void send('step'));
$('#btn-slower').addEventListener('click', () => setSpeed(-1));
$('#btn-faster').addEventListener('click', () => setSpeed(1));
$('#btn-zin').addEventListener('click', () => setScale(scale + 1));
$('#btn-zout').addEventListener('click', () => setScale(scale - 1));
$('#insp-close').addEventListener('click', closeInspector);
bindWhy($('#insp-body')); // 019: «¿por qué?» de cada evento de la historia
for (const b of document.querySelectorAll<HTMLButtonElement>('.tabs button'))
  b.addEventListener('click', () => {
    tab = b.dataset.tab as typeof tab;
    chatsShownFor = null; // pulsar la pestaña vuelve a cargar las charlas
    renderInspector();
  });

setupChat({ citizen: () => (detail ? { id: detail.id, name: detail.name } : null), auth: () => credentials, askAuth });
setupWorldPanel({ button: $('#btn-world') as HTMLButtonElement, dialog: $('#world') as HTMLDialogElement, body: $('#world-body'), close: $('#world-close') as HTMLButtonElement, fetch: api.metrics });

start().catch((err: unknown) => {
  $('#msg').textContent = `No se pudo conectar con la API: ${String(err)}. ¿Está corriendo \`pnpm dev\`?`;
});
