// Dibujo del mapa en Canvas 2D (spec 024 R-001, R-012): se pinta una vez en un lienzo aparte, con los detalles del
// prototipo, y cada cuadro lo copia con la cámara. Las ventanas de cada edificio se guardan para encenderlas de noche
// (R-013); las figuras y el velo están en `figures.ts`.
import { TILE_COLORS, TS, hash, styleOf } from './logic.ts';
import { T, decorOf, parkTrees, treeSpots } from './scenery.ts';
import type { WorldView } from './types.ts';

export interface MapLayer {
  canvas: HTMLCanvasElement;
  /** Ventanas de cada edificio (px del mapa), por su punto de entrada `x,y` (el de `WorldView.points`). */
  windows: Map<string, [number, number, number, number][]>;
}

/** Pinta el mapa (tiles, calles, árboles y edificios) en un lienzo del tamaño del mundo a 1 px por px de tile. */
export function drawMap(world: WorldView): MapLayer {
  const geo = world.geo!;
  const c = document.createElement('canvas');
  c.width = geo.width * TS;
  c.height = geo.height * TS;
  const g = c.getContext('2d')!;
  const windows = new Map<string, [number, number, number, number][]>();
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= geo.width || y >= geo.height ? -1 : geo.tiles[y * geo.width + x]!);
  for (let y = 0; y < geo.height; y++)
    for (let x = 0; x < geo.width; x++) {
      const t = geo.tiles[y * geo.width + x] ?? 0;
      g.fillStyle = t === 0 ? ((x + y) % 2 ? '#739C50' : '#76A053') : (TILE_COLORS[t] ?? '#76A053');
      g.fillRect(x * TS, y * TS, TS, TS);
      const px = x * TS;
      const py = y * TS;
      if (t === T.road) {
        g.fillStyle = '#625D55';
        g.fillRect(px + (hash(`c${x}:${y}`) % 7), py + (hash(`c${y}:${x}`) % 7), 1, 1);
        // Línea discontinua entre los dos carriles de una calle de dos tiles (no en los cruces), como el prototipo.
        g.fillStyle = '#C8BFA4';
        if (at(x, y + 1) === T.road && at(x, y - 1) !== T.road && at(x, y + 2) !== T.road && at(x - 1, y) === T.road && at(x + 1, y) === T.road && at(x - 1, y + 1) === T.road)
          for (let k = 0; k < TS; k += 6) if ((px + k) % 6 < 3) g.fillRect(px + k, py + TS - 1, 3, 1);
        if (at(x + 1, y) === T.road && at(x - 1, y) !== T.road && at(x + 2, y) !== T.road && at(x, y - 1) === T.road && at(x, y + 1) === T.road && at(x + 1, y - 1) === T.road)
          for (let k = 0; k < TS; k += 6) if ((py + k) % 6 < 3) g.fillRect(px + TS - 1, py + k, 1, 3);
      } else if (t === T.grass) {
        // Motas de hierba y bordillo claro hacia la calle, como el prototipo.
        const hv = hash(`h${x}:${y}`);
        for (let i = 0; i < 3; i++) {
          g.fillStyle = (hv >>> (i * 7)) & 1 ? '#86AE60' : '#658D46';
          g.fillRect(px + ((hv >>> (i * 7 + 1)) % 7), py + ((hv >>> (i * 7 + 4)) % 7), 1, 1);
        }
        const road = (dx: number, dy: number) => geo.tiles[(y + dy) * geo.width + x + dx] === T.road && x + dx >= 0 && x + dx < geo.width;
        g.fillStyle = '#A9A290';
        if (road(0, 1)) g.fillRect(px, py + TS - 1, TS, 1);
        if (road(0, -1)) g.fillRect(px, py, TS, 1);
        if (road(1, 0)) g.fillRect(px + TS - 1, py, 1, TS);
        if (road(-1, 0)) g.fillRect(px, py, 1, TS);
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
  return { canvas: c, windows };
}

/** Árbol de 5 × 7 px del prototipo. */
function tree(g: CanvasRenderingContext2D, x: number, y: number): void {
  g.fillStyle = '#5A3A22';
  g.fillRect(x + 2, y + 4, 1, 3);
  g.fillStyle = '#2F5E2D';
  g.fillRect(x + 1, y, 3, 1);
  g.fillRect(x, y + 1, 5, 3);
  g.fillRect(x + 1, y + 4, 3, 1);
  g.fillStyle = '#437A3A';
  g.fillRect(x + 1, y + 1, 2, 1);
}

/** Parque: césped con borde, senderos en cruz, estanque en la esquina, árboles y dos bancos. */
function drawPark(g: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number): void {
  g.fillStyle = '#5F9146';
  g.fillRect(x, y, w, h);
  g.fillStyle = '#4C7A38';
  g.fillRect(x, y, w, 1);
  g.fillRect(x, y + h - 1, w, 1);
  g.fillRect(x, y, 1, h);
  g.fillRect(x + w - 1, y, 1, h);
  g.fillStyle = '#CDBF98';
  g.fillRect(x + 2, y + Math.floor(h / 2) - 1, w - 4, 3);
  g.fillRect(x + Math.floor(w / 2) - 1, y + 2, 3, h - 4);
  if (w >= 24 && h >= 18) {
    g.fillStyle = '#3F7FB5';
    g.fillRect(x + 6, y + 6, 14, 8);
    g.fillRect(x + 8, y + 5, 10, 10);
    g.fillStyle = '#6FA8D6';
    g.fillRect(x + 9, y + 7, 4, 1);
  }
  for (const t of parkTrees(id, x, y, w, h)) tree(g, t.x, t.y);
  if (w >= 40) {
    g.fillStyle = '#7A5A3A';
    g.fillRect(x + w - 18, y + Math.floor(h / 2) + 4, 6, 2);
    g.fillRect(x + 26, y + Math.floor(h / 2) - 5, 6, 2);
  }
}

/** Plaza: adoquín claro con borde y juntas. */
function drawPlaza(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.fillStyle = '#CDBF98';
  g.fillRect(x, y, w, h);
  g.fillStyle = '#B6AE98';
  for (let yy = y + 3; yy < y + h; yy += 4) g.fillRect(x, yy, w, 1);
  g.fillRect(x, y, w, 1);
  g.fillRect(x, y + h - 1, w, 1);
}

/** Edificio: sombra, muro, tejado a franjas con alero, ventanas, puerta, toldo y el distintivo de su tipo. */
function drawBuilding(g: CanvasRenderingContext2D, p: WorldView['places'][number], x: number, y: number, w: number, h: number, windows: [number, number, number, number][]): void {
  const s = styleOf(p.kind, p.id);
  // Sendero de la puerta a la calle, como el prototipo.
  if (p.door && p.door.y * TS > y + h) {
    g.fillStyle = '#B6AE98';
    g.fillRect(p.door.x * TS + 2, y + h, 4, p.door.y * TS - (y + h));
  }
  const d = decorOf(p.kind);
  const office = p.kind === 'servicios.oficina' || p.kind.startsWith('gobierno') || p.kind.startsWith('finanzas');
  const rh = Math.max(3, Math.round(h * 0.4));
  g.fillStyle = 'rgba(0,0,0,.2)';
  g.fillRect(x + 2, y + 2, w, h);
  g.fillStyle = s.wall;
  g.fillRect(x + 1, y + rh, w - 2, h - rh);
  g.fillStyle = s.roof;
  g.fillRect(x, y, w, rh);
  g.fillStyle = 'rgba(0,0,0,.18)';
  for (let yy = y + 3; yy < y + rh - 2; yy += 3) g.fillRect(x + 1, yy, w - 2, 1);
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.fillRect(x, y + rh - 2, w, 2);
  const doorX = p.door ? p.door.x * TS + 2 : x + Math.floor(w / 2) - 2;
  g.fillStyle = s.win;
  for (let wy = y + rh + 3; wy < y + h - 8; wy += office ? 4 : 6)
    for (let wx = x + 4; wx < x + w - 5; wx += 6)
      if (!(Math.abs(wx + 1 - (doorX + 2)) < 4 && wy > y + h - 12)) {
        g.fillRect(wx, wy, 3, office ? 2 : 3);
        windows.push([wx, wy, 3, office ? 2 : 3]);
      }
  g.fillStyle = s.door;
  g.fillRect(doorX, y + h - 6, 4, 6);
  if (d.awning) for (let i = 0; i < w - 2; i++) {
    g.fillStyle = d.awning[Math.floor(i / 2) % 2]!;
    g.fillRect(x + 1 + i, y + rh, 1, 3);
  }
  const cx = x + Math.floor(w / 2);
  if (d.mark === 'cruz') {
    g.fillStyle = '#C83A34';
    g.fillRect(cx - 1, y + 3, 3, 9);
    g.fillRect(cx - 4, y + 6, 9, 3);
  } else if (d.mark === 'chimenea') {
    g.fillStyle = '#5A5A60';
    g.fillRect(x + w - 8, y - 6, 4, 9);
    g.fillStyle = '#B04A3A';
    g.fillRect(x + w - 8, y - 6, 4, 1);
  } else if (d.mark === 'bandera') {
    g.fillStyle = '#6A5020';
    g.fillRect(x + 3, y - 6, 1, 8);
    g.fillStyle = '#F2D24A';
    g.fillRect(x + 4, y - 6, 4, 2);
    g.fillStyle = '#2A5FA8';
    g.fillRect(x + 4, y - 4, 4, 1);
    g.fillStyle = '#C83A34';
    g.fillRect(x + 4, y - 3, 4, 1);
  } else if (d.mark === 'pesas') {
    g.fillStyle = '#EDEAF7';
    g.fillRect(cx - 5, y + 5, 11, 1);
    g.fillRect(cx - 6, y + 3, 2, 5);
    g.fillRect(cx + 5, y + 3, 2, 5);
  }
}
