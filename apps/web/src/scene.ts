// Quién se dibuja y dónde (spec 024 R-013), como el prototipo: quien va de camino, por la calle y con su paso; quien
// está en un lugar al aire libre (parques y plazas), en un punto fijo dentro. Dentro de un edificio no se ve. Lógica
// pura: devuelve posiciones en px del mapa (tiles de 8 px).
import { TS, hash } from './logic.ts';
import type { MoveBook, Where } from './replay.ts';
import { alongPath } from './streets.ts';
import type { CitizenPosition, PlaceView, Rect } from './types.ts';

type Point = { x: number; y: number };

export interface Figure {
  id: string;
  /** Pies de la figura, en px del mapa. */
  x: number;
  y: number;
  walk: boolean;
  /** Fotograma del paso (0 o 1). */
  frame: number;
  small: boolean;
}

/** Lugares al aire libre: se ve a quien está dentro (parques y plazas, como el prototipo). */
export const isOutdoor = (kind: string): boolean => kind.startsWith('espacio_publico');

export interface SceneInput {
  t: number;
  people: readonly CitizenPosition[];
  book: MoveBook;
  points: Readonly<Record<string, [number, number]>>;
  outdoor: ReadonlyMap<string, Rect>;
  route: (a: Point, b: Point) => Point[];
}

/** Un punto fijo dentro de un lugar al aire libre para cada persona, lejos de los bordes (en px del mapa). */
export function spotIn(r: Rect, id: string): Point {
  const h = hash(`spot:${id}`);
  const w = Math.max(1, r.w * TS - 10);
  const hh = Math.max(1, r.h * TS - 12);
  return { x: r.x * TS + 4 + (h % w), y: r.y * TS + 9 + ((h >>> 12) % hh) };
}

/** Dónde está cada persona en el minuto `t`, y la figura de las que se ven. */
export function scene(s: SceneInput): { figures: Figure[]; where: Map<string, Where> } {
  const figures: Figure[] = [];
  const where = new Map<string, Where>();
  for (const c of s.people) {
    const w = s.book.where(c.id, s.t, c.placeId);
    where.set(c.id, w);
    const small = (c.age ?? 30) < 12;
    if (w.kind === 'walk') {
      const a = s.points[w.move.from];
      const b = s.points[w.move.to];
      if (!a || !b) continue; // viaje fuera del mapa (La Capital)
      const p = alongPath(s.route({ x: a[0], y: a[1] }, { x: b[0], y: b[1] }), w.f);
      // Carriles: cada persona algo desplazada dentro del tile, para no pisarse (como el prototipo).
      const h = hash(c.id);
      const minutes = s.t - w.move.departAt;
      figures.push({ id: c.id, x: p.x * TS - 2 + (h % 3) * 2 - 1, y: p.y * TS + 1 + ((h >>> 3) % 3) * 2 - 2, walk: true, frame: Math.floor(minutes * 2) % 2, small });
    } else if (w.place && s.outdoor.has(w.place)) {
      const p = spotIn(s.outdoor.get(w.place)!, c.id);
      figures.push({ id: c.id, x: p.x, y: p.y, walk: false, frame: 0, small });
    }
  }
  // Los de más abajo, delante.
  figures.sort((a, b) => a.y - b.y || (a.id < b.id ? -1 : 1));
  return { figures, where };
}

/** Lugares al aire libre del mapa, con su área. */
export function outdoorRects(places: readonly PlaceView[]): Map<string, Rect> {
  return new Map(places.filter((p) => p.rect && isOutdoor(p.kind)).map((p) => [p.id, p.rect!]));
}

/** Cuántas personas despiertas hay en cada punto de entrada (para encender las ventanas de noche). */
export function occupancy(where: ReadonlyMap<string, Where>, people: readonly CitizenPosition[], points: Readonly<Record<string, [number, number]>>): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of people) {
    const w = where.get(c.id);
    if (!w || w.kind !== 'at' || !w.place || c.activity === 'sleep') continue;
    const p = points[w.place];
    if (!p) continue;
    const k = `${p[0]},${p[1]}`;
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}
