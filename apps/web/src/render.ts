// Dibujo del mapa en Canvas 2D (spec 024 R-001, R-012, R-030): se pinta una vez en un lienzo aparte, en el estilo del
// lienzo T10 (formas redondeadas, contorno grueso, calles beige, césped en damero), y cada cuadro lo copia con la cámara.
// El lienzo se pinta a `scale` veces la resolución del mapa para que no se pixele al acercar. Las ventanas de cada
// edificio se guardan para encenderlas de noche (R-013); las figuras y el velo están en `figures.ts`.
import { drawBuilding, drawPark, drawPlaza, tree } from './draw-places.ts';
import { TILE_COLORS, TS, hash } from './logic.ts';
import { T, treeSpots } from './scenery.ts';
import type { WorldView } from './types.ts';

export interface MapLayer {
  canvas: HTMLCanvasElement;
  /** Tamaño del mapa en px del mapa (el lienzo es `scale` veces mayor). */
  w: number;
  h: number;
  scale: number;
  /** Ventanas de cada edificio (px del mapa), por su punto de entrada `x,y` (el de `WorldView.points`). */
  windows: Map<string, [number, number, number, number][]>;
}

/** [M] Resolución del lienzo del mapa: 3× salvo que el lienzo pase de ~16 millones de píxeles. */
export const layerScale = (w: number, h: number): number => Math.max(1, Math.min(3, Math.floor(Math.sqrt(16_000_000 / (w * h)))));

const GRASS = ['#7CCB4B', '#72C243'];
const ROAD = '#EAD9AB';
const ROAD_EDGE = '#C9B57C';
const ROAD_LINE = '#FFF6D6';

/** Pinta el mapa (tiles, calles, árboles y edificios) en un lienzo del tamaño del mundo. */
export function drawMap(world: WorldView): MapLayer {
  const geo = world.geo!;
  const w = geo.width * TS;
  const h = geo.height * TS;
  const scale = layerScale(w, h);
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const g = c.getContext('2d')!;
  g.scale(scale, scale);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const windows = new Map<string, [number, number, number, number][]>();
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= geo.width || y >= geo.height ? -1 : geo.tiles[y * geo.width + x]!);
  for (let y = 0; y < geo.height; y++)
    for (let x = 0; x < geo.width; x++) {
      const t = geo.tiles[y * geo.width + x] ?? 0;
      const px = x * TS;
      const py = y * TS;
      g.fillStyle = t === T.grass ? GRASS[(x + y) % 2]! : t === T.road ? ROAD : (TILE_COLORS[t] ?? GRASS[0]!);
      g.fillRect(px, py, TS, TS);
      if (t === T.grass) {
        // Un par de motas de hierba, fijas por tile.
        const hv = hash(`h${x}:${y}`);
        g.fillStyle = (hv & 1) === 0 ? 'rgba(255,255,255,.22)' : 'rgba(40,110,30,.2)';
        g.fillRect(px + ((hv >>> 1) % 6), py + ((hv >>> 4) % 6), 1.2, 1.2);
      } else if (t === T.road) {
        // Borde de la calle donde toca hierba (el bordillo) y línea discontinua entre los dos carriles de una calle de dos tiles.
        g.fillStyle = ROAD_EDGE;
        if (at(x, y - 1) === T.grass) g.fillRect(px, py, TS, 1);
        if (at(x, y + 1) === T.grass) g.fillRect(px, py + TS - 1, TS, 1);
        if (at(x - 1, y) === T.grass) g.fillRect(px, py, 1, TS);
        if (at(x + 1, y) === T.grass) g.fillRect(px + TS - 1, py, 1, TS);
        g.fillStyle = ROAD_LINE;
        if (at(x, y + 1) === T.road && at(x, y - 1) !== T.road && at(x, y + 2) !== T.road && at(x - 1, y) === T.road && at(x + 1, y) === T.road && at(x - 1, y + 1) === T.road)
          for (let k = 0; k < TS; k += 6) g.fillRect(px + k, py + TS - 0.6, 3, 1.2);
        if (at(x + 1, y) === T.road && at(x - 1, y) !== T.road && at(x + 2, y) !== T.road && at(x, y - 1) === T.road && at(x, y + 1) === T.road && at(x + 1, y - 1) === T.road)
          for (let k = 0; k < TS; k += 6) g.fillRect(px + TS - 0.6, py + k, 1.2, 3);
      }
    }
  // Edificios: los que tienen área, del más grande al más pequeño (los de dentro quedan encima).
  const buildings = world.places.filter((p) => p.rect && !p.kind.startsWith('territorio')).sort((a, b) => b.rect!.w * b.rect!.h - a.rect!.w * a.rect!.h);
  for (const s of treeSpots(geo, buildings.map((p) => p.rect!))) tree(g, s.x * TS + s.dx, s.y * TS + s.dy);
  for (const p of buildings) {
    const r = p.rect!;
    if (p.kind === 'espacio_publico.parque') drawPark(g, p.id, r.x * TS, r.y * TS, r.w * TS, r.h * TS);
    else if (p.kind.startsWith('espacio_publico')) drawPlaza(g, r.x * TS, r.y * TS, r.w * TS, r.h * TS);
    else {
      const list: [number, number, number, number][] = [];
      drawBuilding(g, p, r.x * TS, r.y * TS, r.w * TS, r.h * TS, list);
      const pt = world.points?.[p.id];
      if (pt) windows.set(`${pt[0]},${pt[1]}`, [...(windows.get(`${pt[0]},${pt[1]}`) ?? []), ...list]);
    }
  }
  return { canvas: c, w, h, scale, windows };
}
