// El mapa en vivo (spec 024 R-001, R-013, R-015 y R-021): cámara ajustada con zoom y seguimiento, las personas en el
// minuto de la vista (solo quien camina o está al aire libre), la noche con las ventanas encendidas, las capas del
// Visor A+ (nombres de lugares, vínculos de la persona elegida, ánimo), la etiqueta de la persona elegida, la escala,
// el tooltip y los clics. Solo dibuja lo que ya pasó en el mundo.
import { clampZoom, frameOf, toMap } from './camera.ts';
import type { Cam } from './camera.ts';
import { darkness, drawArrow, drawFigure, drawFrame, drawNight } from './figures.ts';
import { TS } from './logic.ts';
import { drawPlan, renderScale } from './overlays.ts';
import type { Layers } from './overlays.ts';
import { kindEs, moodColor, placeAt } from './panels.ts';
import type { MoveBook, Where } from './replay.ts';
import type { MapLayer } from './render.ts';
import { occupancy, outdoorRects, scene } from './scene.ts';
import type { Figure } from './scene.ts';
import type { CitizenPosition, Rect, WorldView } from './types.ts';

type Point = { x: number; y: number };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface MapDeps {
  world: WorldView;
  layer: MapLayer;
  route: (a: Point, b: Point) => Point[];
  book: () => MoveBook;
  people: () => readonly CitizenPosition[];
  /** Avanza el reloj de la vista `dt` ms y devuelve su minuto. */
  tick: (dtMs: number) => number;
  selected: () => { person: string | null; place: string | null };
  doing: (c: CitizenPosition) => string;
  onPerson: (id: string) => void;
  onPlace: (id: string) => void;
  /** Capas del mapa (R-021). */
  layers: () => Layers;
  /** Con quién tiene vínculo la persona elegida (para la capa Vínculos). */
  bonds: () => readonly string[];
}

export interface MapView {
  zoom: (factor: number) => void;
  center: () => void;
  setFollow: (on: boolean) => void;
  following: () => boolean;
  /** Dónde está cada persona en el minuto de la vista (del último cuadro). */
  where: (id: string) => Where | undefined;
  pan: (dx: number, dy: number) => void;
}

export function setupMap(d: MapDeps): MapView {
  const canvas = document.querySelector<HTMLCanvasElement>('#map')!;
  const tip = document.querySelector<HTMLElement>('#tip')!;
  const g = canvas.getContext('2d')!;
  const mapW = d.layer.canvas.width;
  const mapH = d.layer.canvas.height;
  const points = d.world.points ?? {};
  const outdoor = outdoorRects(d.world.places);
  // El edificio de cada punto de entrada, para enmarcarlo cuando la persona elegida está dentro.
  const rectByPoint = new Map<string, Rect>();
  for (const p of d.world.places) {
    const pt = points[p.id];
    if (p.rect && pt && !p.kind.startsWith('territorio')) rectByPoint.set(`${pt[0]},${pt[1]}`, p.rect);
  }
  const tag = document.querySelector<HTMLElement>('#seltag')!;
  const labelled = d.world.places.filter((p) => p.rect && !p.kind.startsWith('territorio') && !p.kind.startsWith('vivienda'));
  let lastScale = 0;
  const cam: Cam = { x: mapW / 2, y: mapH / 2, z: 1 };
  let follow = false;
  let figures: Figure[] = [];
  let where = new Map<string, Where>();
  let frame = { s: 1, cx: mapW / 2, cy: mapH / 2 };
  let last = performance.now();
  let frames = 0;
  let fpsAt = last;

  const draw = (now: number) => {
    const dt = Math.min(250, now - last);
    last = now;
    const t = d.tick(dt);
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const people = d.people();
    const sc = scene({ t, people, book: d.book(), points, outdoor, route: d.route });
    figures = sc.figures;
    where = sc.where;
    const selNow = d.selected();
    if (follow && selNow.person) {
      const f = figures.find((x) => x.id === selNow.person);
      const w2 = where.get(selNow.person);
      const pt = w2?.kind === 'at' && w2.place ? points[w2.place] : undefined;
      if (f) Object.assign(cam, { x: f.x, y: f.y });
      else if (pt) Object.assign(cam, { x: pt[0] * TS, y: pt[1] * TS });
    }
    frame = frameOf(cam, r.width, r.height, mapW, mapH, dpr);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#5B8440';
    g.fillRect(0, 0, w, h);
    g.setTransform(dpr * frame.s, 0, 0, dpr * frame.s, dpr * (r.width / 2 - frame.cx * frame.s), dpr * (r.height / 2 - frame.cy * frame.s));
    g.imageSmoothingEnabled = false;
    g.drawImage(d.layer.canvas, 0, 0);
    const sel = d.selected();
    const plan = drawPlan(d.layers(), !!sel.person);
    if (!plan.figures) figures = [];
    // Punto de una persona en el mapa (px): su figura o la puerta de donde está.
    const pointOf = (id: string): Point | null => {
      const f = figures.find((x) => x.id === id);
      if (f) return { x: f.x, y: f.y - 4 };
      const w2 = where.get(id);
      const pt = w2?.kind === 'at' && w2.place ? points[w2.place] : undefined;
      return pt ? { x: pt[0] * TS + TS / 2, y: pt[1] * TS + TS / 2 } : null;
    };
    if (plan.bonds && sel.person) {
      const a = pointOf(sel.person);
      g.lineWidth = 1 / frame.s;
      g.strokeStyle = 'rgba(240,165,142,.9)';
      g.setLineDash([3 / frame.s, 2 / frame.s]);
      for (const id of d.bonds()) {
        const b = pointOf(id);
        if (!a || !b) continue;
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.stroke();
      }
      g.setLineDash([]);
    }
    for (const f of figures) drawFigure(g, f);
    if (plan.mood) {
      const mood = new Map(people.map((c) => [c.id, c.mood]));
      for (const f of figures) {
        g.fillStyle = moodColor(mood.get(f.id) ?? 0.5);
        g.fillRect(f.x - 1, f.y - (f.small ? 10 : 12), 3, 2);
      }
    }
    if (plan.night) drawNight(g, darkness(t % 1440), { w: mapW, h: mapH }, d.layer.windows, occupancy(where, people, points));
    const blink = Math.floor(now / 400) % 2 === 0;
    const toScreen = (p: Point) => ({ x: (p.x - frame.cx) * frame.s + r.width / 2, y: (p.y - frame.cy) * frame.s + r.height / 2 });
    if (sel.place) {
      const p = d.world.places.find((x) => x.id === sel.place);
      if (p?.rect) drawFrame(g, p.rect, frame.s * dpr);
    }
    if (sel.person) {
      const f = figures.find((x) => x.id === sel.person);
      const w2 = where.get(sel.person);
      if (f) drawArrow(g, f, blink);
      else if (blink && w2?.kind === 'at' && w2.place) {
        const pt = points[w2.place];
        const rect = pt ? rectByPoint.get(`${pt[0]},${pt[1]}`) ?? outdoor.get(w2.place) : undefined;
        if (rect) drawFrame(g, rect, frame.s * dpr);
      }
    }
    // Nombres de los lugares (capa Lugares) y etiqueta de la persona elegida, en px de pantalla.
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (plan.labels) {
      g.font = '500 11px "IBM Plex Sans", system-ui, sans-serif';
      g.textAlign = 'center';
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(29,33,38,.85)';
      g.fillStyle = '#ffffff';
      for (const p of labelled) {
        const c = toScreen({ x: (p.rect!.x + p.rect!.w / 2) * TS, y: p.rect!.y * TS + 6 });
        if (p.rect!.w * TS * frame.s < 44) continue;
        g.strokeText(p.name, c.x, c.y + 4);
        g.fillText(p.name, c.x, c.y + 4);
      }
    }
    const pt = sel.person ? pointOf(sel.person) : null;
    if (pt && sel.person) {
      const c = toScreen(pt);
      tag.hidden = false;
      const half = tag.offsetWidth / 2;
      tag.style.left = `${Math.round(Math.min(Math.max(c.x, half + 6), r.width - half - 6))}px`;
      tag.style.top = `${Math.round(c.y - 18 - 4 * frame.s)}px`;
      const who = d.people().find((x) => x.id === sel.person);
      const text = who ? `${who.id} · ${who.name} · ${d.doing(who)}` : '';
      if (tag.textContent !== text) tag.textContent = text;
    } else tag.hidden = true;
    if (frame.s !== lastScale) {
      lastScale = frame.s;
      renderScale(TS * frame.s);
    }
    frames++;
    if (now - fpsAt > 1000) {
      document.querySelector('#fps')!.textContent = `${Math.round((frames * 1000) / (now - fpsAt))} fps`;
      frames = 0;
      fpsAt = now;
    }
    requestAnimationFrame(draw);
  };

  /** Lo que hay bajo el puntero: la persona dibujada más cerca (a menos de 7 px del mapa) o el lugar. */
  const hit = (ev: PointerEvent): { person?: string; place?: string } | null => {
    const r = canvas.getBoundingClientRect();
    const p = toMap(frame, r.width, r.height, ev.clientX - r.left, ev.clientY - r.top);
    let best: Figure | null = null;
    let bd = 7;
    for (const f of figures) {
      const dist = Math.hypot(f.x - p.x, f.y - 3 - p.y);
      if (dist < bd) {
        bd = dist;
        best = f;
      }
    }
    if (best) return { person: best.id };
    const pl = placeAt(d.world.places.filter((x) => !x.kind.startsWith('territorio')), p.x / TS, p.y / TS);
    return pl ? { place: pl.id } : null;
  };

  let drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, cx: frame.cx, cy: frame.cy, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        drag.moved = true;
        canvas.classList.add('dragging');
        api.setFollow(false);
      }
      if (drag.moved) Object.assign(cam, { x: drag.cx - dx / frame.s, y: drag.cy - dy / frame.s });
      return;
    }
    const h = hit(e);
    if (!h) {
      tip.style.display = 'none';
      return;
    }
    const wrap = canvas.parentElement!.getBoundingClientRect();
    if (h.person) {
      const c = d.people().find((x) => x.id === h.person);
      tip.innerHTML = c ? `<b>${esc(c.name)}</b>${esc(d.doing(c))}` : '';
    } else {
      const pl = d.world.places.find((x) => x.id === h.place)!;
      const pt = points[pl.id];
      const key = pt ? `${pt[0]},${pt[1]}` : '';
      let n = 0;
      for (const w2 of where.values()) if (w2.kind === 'at' && w2.place && (w2.place === pl.id || (points[w2.place] && `${points[w2.place]![0]},${points[w2.place]![1]}` === key))) n++;
      tip.innerHTML = `<b>${esc(pl.name)}</b>${esc(kindEs(pl.kind))}, ${n} ${n === 1 ? 'persona' : 'personas'} dentro`;
    }
    tip.style.display = 'block';
    tip.style.left = `${Math.min(e.clientX - wrap.left + 12, wrap.width - 250)}px`;
    tip.style.top = `${e.clientY - wrap.top + 12}px`;
  });
  canvas.addEventListener('pointerup', (e) => {
    const wasDrag = drag?.moved;
    drag = null;
    canvas.classList.remove('dragging');
    if (wasDrag) return;
    const h = hit(e);
    if (h?.person) d.onPerson(h.person);
    else if (h?.place) d.onPlace(h.place);
  });
  canvas.addEventListener('pointerleave', () => (tip.style.display = 'none'));
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      cam.z = clampZoom(cam.z * (e.deltaY < 0 ? 1.2 : 1 / 1.2));
    },
    { passive: false },
  );

  const followBtn = document.querySelector<HTMLButtonElement>('#follow')!;
  const api: MapView = {
    zoom: (k) => (cam.z = clampZoom(cam.z * k)),
    center: () => {
      Object.assign(cam, { x: mapW / 2, y: mapH / 2, z: 1 });
      api.setFollow(false);
    },
    setFollow: (on) => {
      follow = on && !!d.selected().person;
      if (follow && cam.z < 2.5) cam.z = 3;
      followBtn.setAttribute('aria-pressed', String(follow));
      document.querySelector('#card-follow')?.setAttribute('aria-pressed', String(follow));
    },
    following: () => follow,
    where: (id) => where.get(id),
    pan: (dx, dy) => Object.assign(cam, { x: frame.cx + dx / frame.s, y: frame.cy + dy / frame.s }),
  };
  document.querySelector('#zoom-in')!.addEventListener('click', () => api.zoom(1.5));
  document.querySelector('#zoom-out')!.addEventListener('click', () => api.zoom(1 / 1.5));
  document.querySelector('#center')!.addEventListener('click', api.center);
  followBtn.addEventListener('click', () => api.setFollow(!follow));
  requestAnimationFrame(draw);
  return api;
}
