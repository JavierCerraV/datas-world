// Visor mínimo (spec 024): mapa, personas, día y noche, inspector, registro de eventos y controles. Solo lee de la
// API (022); no tiene lógica de simulación (INV-002).
import { api, control, stream } from './api.ts';
import { showChatHistory } from './chat-history.ts';
import { setupChat } from './chat-ui.ts';
import { eventEs, inspectorTabs } from './format.ts';
import type { Section } from './format.ts';
import { TS, interpolate, nightAlpha, spread, timeOf } from './logic.ts';
import { drawMap, drawPerson } from './render.ts';
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

async function refreshPeople(): Promise<void> {
  const list = await api.citizens();
  prev = new Map(next.map((c) => [c.id, c]));
  next = list;
  updatedAt = performance.now();
  $('#pop').textContent = `${list.length} personas`;
  if (selected) void openInspector(selected, false);
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

let tab: 'estado' | 'historia' | 'funcional' | 'charlas' = 'estado';
let detail: CitizenDetail | null = null;
let chatsShownFor: string | null = null;
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
  $('#insp-body').innerHTML =
    tab === 'estado'
      ? renderSections(t.estado)
      : tab === 'funcional'
        ? renderSections(t.funcional)
        : t.historia.length
          ? `<ol class="hist">${t.historia.map((h) => `<li>${esc(h.line)}${h.causes.length ? `<small>por: ${h.causes.map(esc).join(' · ')}</small>` : ''}</li>`).join('')}</ol>`
          : '<p>Sin hechos recientes.</p>';
}

async function openInspector(id: string, focus = true): Promise<void> {
  selected = id;
  detail = await api.citizen(id);
  $('#inspector').hidden = false;
  renderInspector();
  if (focus) $<HTMLButtonElement>('#insp-close').focus();
}

function closeInspector(): void {
  selected = null;
  detail = null;
  $('#inspector').hidden = true;
}

function pick(clientX: number, clientY: number): string | null {
  const r = canvas.getBoundingClientRect();
  const mx = (clientX - r.left) / scale / TS + cam.x / TS;
  const my = (clientY - r.top) / scale / TS + cam.y / TS;
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
      clock = t;
      $('#date').textContent = `${t.date}${t.status === 'paused' ? ' · en pausa' : ''}`;
      void refreshPeople();
    },
    event: (e) => {
      if (e.type !== 'DAY_STARTED' && e.type !== 'TRIP_TAKEN') addLog(eventEs(e));
      if (e.type === 'SPEED_CHANGED') speed = (e.payload.to as number) ?? speed;
    },
    status: (ok) => ($('#live').textContent = ok ? '● en vivo' : '○ reconectando…'),
  });
  requestAnimationFrame(frame);
}

// Interacción: arrastrar mueve la cámara; la rueda y los botones cambian el zoom; clic abre el inspector.
let drag: { x: number; y: number; moved: boolean } | null = null;
canvas.addEventListener('pointerdown', (e) => (drag = { x: e.clientX, y: e.clientY, moved: false }));
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
  if (drag.moved) {
    cam = { x: cam.x - dx / scale, y: cam.y - dy / scale };
    drag = { x: e.clientX, y: e.clientY, moved: true };
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (drag && !drag.moved) {
    const id = pick(e.clientX, e.clientY);
    if (id) void openInspector(id);
  }
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  setScale(scale + (e.deltaY < 0 ? 1 : -1), e.clientX - r.left, e.clientY - r.top);
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
for (const b of document.querySelectorAll<HTMLButtonElement>('.tabs button'))
  b.addEventListener('click', () => {
    tab = b.dataset.tab as typeof tab;
    chatsShownFor = null; // pulsar la pestaña vuelve a cargar las charlas
    renderInspector();
  });

setupChat({ citizen: () => (detail ? { id: detail.id, name: detail.name } : null), auth: () => credentials, askAuth });

start().catch((err: unknown) => {
  $('#msg').textContent = `No se pudo conectar con la API: ${String(err)}. ¿Está corriendo \`pnpm dev\`?`;
});
