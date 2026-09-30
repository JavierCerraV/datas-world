// Red de vínculos en 3D del dashboard (spec 024 R-027): disposición por fuerzas en 3D con semilla fija por id (la
// misma red siempre se dibuja igual), proyección en perspectiva con rotación, y el lienzo que gira al arrastrar,
// acerca con la rueda y abre el expediente con un clic. La disposición y la proyección son puras (CA-020).
import { hash } from './logic.ts';

export interface NetNode { id: string; name: string; age: number; sex: 'F' | 'M' | null; district: string | null; household: string | null; mood: number }
export type EdgeKind = 'pareja' | 'familia' | 'amistad' | 'companeros' | 'otros';
export interface NetEdge { a: string; b: string; kind: EdgeKind; familiarity: number; tension: number }
export interface Network { nodes: NetNode[]; edges: NetEdge[] }
export type Vec3 = [number, number, number];

/** Posición inicial de un nodo, en [-1,1]³, por su id. */
const seedOf = (id: string): Vec3 => {
  const h = hash(`red:${id}`);
  const u = (k: number) => (((h >>> k) & 1023) / 1023) * 2 - 1;
  return [u(0), u(10), u(20) * 0.9 + (hash(`z:${id}`) % 100) / 1000];
};

/**
 * CA-020: disposición por fuerzas en 3D. Repulsión entre todos los nodos, atracción por arista y un leve tirón al
 * centro; los hogares quedan juntos. Determinista: sin azar, en orden de id.
 */
export function layout3d(net: Network, iterations = 160): Map<string, Vec3> {
  const ids = net.nodes.map((n) => n.id).sort();
  const index = new Map(ids.map((id, i) => [id, i]));
  const p = ids.map(seedOf);
  const k = 0.22;
  const edges = net.edges.filter((e) => index.has(e.a) && index.has(e.b)).map((e) => [index.get(e.a)!, index.get(e.b)!, e.kind === 'pareja' ? 0.6 : e.kind === 'familia' ? 0.8 : 1.2] as const);
  for (let it = 0; it < iterations; it++) {
    const t = 0.08 * (1 - it / iterations) + 0.005;
    const d: Vec3[] = p.map(() => [0, 0, 0]);
    for (let i = 0; i < p.length; i++)
      for (let j = i + 1; j < p.length; j++) {
        const dx = p[i]![0] - p[j]![0];
        const dy = p[i]![1] - p[j]![1];
        const dz = p[i]![2] - p[j]![2];
        const dist2 = Math.max(1e-4, dx * dx + dy * dy + dz * dz);
        const f = (k * k) / dist2;
        d[i]![0] += dx * f; d[i]![1] += dy * f; d[i]![2] += dz * f;
        d[j]![0] -= dx * f; d[j]![1] -= dy * f; d[j]![2] -= dz * f;
      }
    for (const [a, b, len] of edges) {
      const dx = p[a]![0] - p[b]![0];
      const dy = p[a]![1] - p[b]![1];
      const dz = p[a]![2] - p[b]![2];
      const dist = Math.max(1e-3, Math.hypot(dx, dy, dz));
      const f = (dist - k * len) / dist;
      d[a]![0] -= dx * f * 0.5; d[a]![1] -= dy * f * 0.5; d[a]![2] -= dz * f * 0.5;
      d[b]![0] += dx * f * 0.5; d[b]![1] += dy * f * 0.5; d[b]![2] += dz * f * 0.5;
    }
    for (let i = 0; i < p.length; i++) {
      const v = d[i]!;
      v[0] -= p[i]![0] * 0.05; v[1] -= p[i]![1] * 0.05; v[2] -= p[i]![2] * 0.05;
      const m = Math.hypot(v[0], v[1], v[2]);
      const s = m > t ? t / m : 1;
      p[i] = [p[i]![0] + v[0] * s, p[i]![1] + v[1] * s, p[i]![2] + v[2] * s];
    }
  }
  // Normaliza a la esfera unidad.
  const r = Math.max(1e-6, ...p.map((v) => Math.hypot(...v)));
  return new Map(ids.map((id, i) => [id, [p[i]![0] / r, p[i]![1] / r, p[i]![2] / r] as Vec3]));
}

/** CA-020: proyección en perspectiva tras girar `yaw` (eje vertical) y `pitch` (eje horizontal). */
export function project(v: Vec3, yaw: number, pitch: number, scale: number, cx: number, cy: number, dist = 3.2): { x: number; y: number; z: number; s: number } {
  const [x0, y0, z0] = v;
  const x1 = x0 * Math.cos(yaw) + z0 * Math.sin(yaw);
  const z1 = -x0 * Math.sin(yaw) + z0 * Math.cos(yaw);
  const y2 = y0 * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = y0 * Math.sin(pitch) + z1 * Math.cos(pitch);
  const s = dist / (dist + z2);
  return { x: cx + x1 * scale * s, y: cy + y2 * scale * s, z: z2, s };
}

/** Colores por barrio (orden fijo de la paleta categórica, R-011) y por tipo de vínculo. */
export const DISTRICT_VARS = ['--series-1', '--series-2', '--series-3', '--series-5', '--series-4'];
export const EDGE_LABEL: Record<EdgeKind, string> = { pareja: 'Pareja', familia: 'Familia', amistad: 'Amistad', companeros: 'Compañeros', otros: 'Otros' };

/** El lienzo interactivo de la red. Devuelve la función para cambiar los tipos de vínculo visibles. */
export function mountNetwork(canvas: HTMLCanvasElement, tip: HTMLElement, net: Network, districts: readonly string[], onOpen: (id: string) => void) {
  const pos = layout3d(net);
  const byId = new Map(net.nodes.map((n) => [n.id, n]));
  const css = getComputedStyle(canvas);
  const color = (v: string) => css.getPropertyValue(v).trim() || '#888';
  const dColor = (d: string | null) => color(DISTRICT_VARS[Math.max(0, districts.indexOf(d ?? '')) % DISTRICT_VARS.length]!);
  let yaw = 0.6;
  let pitch = -0.35;
  let zoom = 1;
  let visible = new Set<EdgeKind>(['pareja', 'familia', 'amistad', 'companeros', 'otros']);
  let hover: string | null = null;
  let spin = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pts: { id: string; x: number; y: number; z: number; s: number }[] = [];
  const g = canvas.getContext('2d')!;

  const draw = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(r.width * dpr)) canvas.width = Math.round(r.width * dpr);
    if (canvas.height !== Math.round(r.height * dpr)) canvas.height = Math.round(r.height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    const scale = Math.min(r.width, r.height) * 0.62 * zoom;
    pts = net.nodes.map((n) => ({ id: n.id, ...project(pos.get(n.id)!, yaw, pitch, scale, r.width / 2, r.height / 2) }));
    const at = new Map(pts.map((p) => [p.id, p]));
    const line = color('--muted');
    g.lineWidth = 1.25;
    for (const e of net.edges) {
      if (!visible.has(e.kind)) continue;
      const a = at.get(e.a);
      const b = at.get(e.b);
      if (!a || !b) continue;
      const hot = hover && (e.a === hover || e.b === hover);
      g.strokeStyle = hot ? color('--ink') : e.kind === 'pareja' ? color('--accent') : line;
      g.globalAlpha = hot ? 0.95 : Math.max(0.3, Math.min(0.75, 0.7 - (a.z + b.z) / 5));
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
    g.globalAlpha = 1;
    const surface = color('--panel');
    for (const p of [...pts].sort((a, b) => b.z - a.z)) {
      const rad = Math.max(2, 3.6 * p.s);
      g.beginPath();
      g.arc(p.x, p.y, rad + 1.5, 0, Math.PI * 2);
      g.fillStyle = surface; // anillo del color de la superficie
      g.fill();
      g.beginPath();
      g.arc(p.x, p.y, rad, 0, Math.PI * 2);
      g.fillStyle = dColor(byId.get(p.id)?.district ?? null);
      g.globalAlpha = Math.max(0.45, Math.min(1, 1.1 - p.z / 2));
      g.fill();
      g.globalAlpha = 1;
      if (p.id === hover) {
        g.lineWidth = 2;
        g.strokeStyle = color('--ink');
        g.stroke();
      }
    }
  };

  let raf = 0;
  const loop = () => {
    if (!canvas.isConnected) return;
    if (spin && !drag) yaw += 0.0025;
    draw();
    raf = requestAnimationFrame(loop);
  };
  let drag: { x: number; y: number; yaw: number; pitch: number; moved: boolean } | null = null;
  const nearest = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    let best: string | null = null;
    let bd = 10;
    for (const p of pts) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) {
        bd = d;
        best = p.id;
      }
    }
    return { id: best, x, y };
  };
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw, pitch, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      yaw = drag.yaw + dx * 0.008;
      pitch = Math.max(-1.4, Math.min(1.4, drag.pitch + dy * 0.008));
      return;
    }
    const n = nearest(e);
    hover = n.id;
    const node = n.id ? byId.get(n.id) : undefined;
    if (node) {
      const deg = net.edges.filter((x) => (x.a === node.id || x.b === node.id) && visible.has(x.kind)).length;
      tip.innerHTML = `<b>${node.name}</b>${node.age} años · ${node.district ?? 'sin barrio'} · ${deg} ${deg === 1 ? 'vínculo' : 'vínculos'}`;
      tip.hidden = false;
      tip.style.left = `${Math.min(n.x + 14, canvas.clientWidth - 200)}px`;
      tip.style.top = `${n.y + 14}px`;
    } else tip.hidden = true;
  });
  canvas.addEventListener('pointerup', (e) => {
    const moved = drag?.moved;
    drag = null;
    if (moved) return;
    const n = nearest(e);
    if (n.id) onOpen(n.id);
  });
  canvas.addEventListener('pointerleave', () => {
    hover = null;
    tip.hidden = true;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom = Math.max(0.5, Math.min(3, zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
  }, { passive: false });
  raf = requestAnimationFrame(loop);
  return {
    setKinds: (kinds: Set<EdgeKind>) => (visible = kinds),
    zoom: (k: number) => (zoom = Math.max(0.5, Math.min(3, zoom * k))),
    reset: () => {
      yaw = 0.6;
      pitch = -0.35;
      zoom = 1;
    },
    toggleSpin: () => (spin = !spin),
    stop: () => cancelAnimationFrame(raf),
  };
}
