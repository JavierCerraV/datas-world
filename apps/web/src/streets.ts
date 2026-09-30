// Recorridos por las calles (spec 024 R-009): la ruta más corta por los tiles de calle entre dos puertas (búsqueda en
// anchura, como el prototipo) y la posición a lo largo de ella. Solo dibujo: el tiempo de viaje es el del motor (016).
// Lógica pura, sin DOM.

/** Tiles por los que se camina: calle (1) y plaza (5), como `TILE` del motor (003). */
const WALKABLE = new Set([1, 5]);

export interface Grid {
  width: number;
  height: number;
  tiles: ArrayLike<number>;
}

type Point = { x: number; y: number };

/**
 * La ruta de centros de tile desde la puerta `a` hasta la `b`: sale de la puerta, va solo por calles y entra en la
 * otra puerta. Sin ruta posible, la recta entre las dos.
 */
export function streetPath(grid: Grid, a: Point, b: Point): Point[] {
  const { width: w, height: h, tiles } = grid;
  const ax = Math.floor(a.x);
  const ay = Math.floor(a.y);
  const bx = Math.floor(b.x);
  const by = Math.floor(b.y);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  if (!inside(ax, ay) || !inside(bx, by)) return [a, b];
  const s = ay * w + ax;
  const goal = by * w + bx;
  const prev = new Int32Array(w * h).fill(-1);
  prev[s] = s;
  const q = [s];
  for (let head = 0; head < q.length; head++) {
    const cur = q[head]!;
    if (cur === goal) break;
    const cx = cur % w;
    const cy = (cur / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inside(nx, ny)) continue;
      const ni = ny * w + nx;
      if (prev[ni] !== -1 || (ni !== goal && !WALKABLE.has(tiles[ni]!))) continue;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (prev[goal] === -1) return [a, b];
  const out: Point[] = [];
  for (let c = goal; c !== s; c = prev[c]!) out.push({ x: (c % w) + 0.5, y: ((c / w) | 0) + 0.5 });
  out.push({ x: ax + 0.5, y: ay + 0.5 });
  return out.reverse();
}

/** El punto a una fracción `f` ∈ [0,1] del largo de la ruta. */
export function alongPath(path: readonly Point[], f: number): Point {
  if (path.length === 1) return path[0]!;
  const seg = path.slice(1).map((p, i) => Math.hypot(p.x - path[i]!.x, p.y - path[i]!.y));
  const total = seg.reduce((s, x) => s + x, 0);
  let left = Math.min(1, Math.max(0, f)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (left <= seg[i]! || i === seg.length - 1) {
      const k = seg[i]! ? Math.min(1, left / seg[i]!) : 1;
      return { x: path[i]!.x + (path[i + 1]!.x - path[i]!.x) * k, y: path[i]!.y + (path[i + 1]!.y - path[i]!.y) * k };
    }
    left -= seg[i]!;
  }
  return path.at(-1)!;
}

/** Rutas ya calculadas, por puertas (las rutas no cambian mientras el mapa sea el mismo). */
export function routeCache(grid: Grid): (a: Point, b: Point) => Point[] {
  const cache = new Map<string, Point[]>();
  return (a, b) => {
    const k = `${a.x},${a.y}>${b.x},${b.y}`;
    let r = cache.get(k);
    if (!r) cache.set(k, (r = streetPath(grid, a, b)));
    return r;
  };
}

/** La posición de quien va de camino en el minuto `now`, por la calle. */
export function onTheWay(route: (a: Point, b: Point) => Point[], trip: { from: Point; to: Point; departAt: number; arriveAt: number }, now: number): Point {
  const f = trip.arriveAt > trip.departAt ? (now - trip.departAt) / (trip.arriveAt - trip.departAt) : 1;
  return alongPath(route(trip.from, trip.to), f);
}
