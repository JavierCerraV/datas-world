// Dibujo en Canvas 2D (spec 024 R-001, R-006, R-007): el mapa se pinta una vez en un lienzo aparte y cada cuadro
// lo copia escalado por un entero, con las personas y el velo nocturno encima.
import { TILE_COLORS, TS, lookOf, styleOf } from './logic.ts';
import type { WorldView } from './types.ts';

/** Pinta el mapa (tiles y edificios) en un lienzo del tamaño del mundo a 1 px por px de tile. */
export function drawMap(world: WorldView): HTMLCanvasElement {
  const geo = world.geo!;
  const c = document.createElement('canvas');
  c.width = geo.width * TS;
  c.height = geo.height * TS;
  const g = c.getContext('2d')!;
  for (let y = 0; y < geo.height; y++)
    for (let x = 0; x < geo.width; x++) {
      const t = geo.tiles[y * geo.width + x] ?? 0;
      g.fillStyle = t === 0 ? ((x + y) % 2 ? '#739C50' : '#76A053') : (TILE_COLORS[t] ?? '#76A053');
      g.fillRect(x * TS, y * TS, TS, TS);
      if (t === 1 && (x + y) % 3 === 0) {
        g.fillStyle = '#625D55';
        g.fillRect(x * TS + ((x * 5) % 7), y * TS + ((y * 3) % 7), 1, 1);
      }
    }
  // Edificios: los que tienen área, del más grande al más pequeño (los de dentro quedan encima).
  const buildings = world.places.filter((p) => p.rect && !p.kind.startsWith('territorio')).sort((a, b) => b.rect!.w * b.rect!.h - a.rect!.w * a.rect!.h);
  for (const p of buildings) {
    const r = p.rect!;
    const x = r.x * TS;
    const y = r.y * TS;
    const w = r.w * TS;
    const h = r.h * TS;
    if (p.kind.startsWith('espacio_publico')) {
      g.fillStyle = '#5F9146';
      g.fillRect(x, y, w, h);
      g.fillStyle = '#4C7A38';
      g.strokeStyle = '#4C7A38';
      g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      continue;
    }
    const s = styleOf(p.kind, p.id);
    const rh = Math.max(3, Math.floor(h * 0.35));
    g.fillStyle = 'rgba(0,0,0,.2)';
    g.fillRect(x + 2, y + 2, w, h);
    g.fillStyle = s.wall;
    g.fillRect(x + 1, y + rh, w - 2, h - rh);
    g.fillStyle = s.roof;
    g.fillRect(x, y, w, rh);
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.fillRect(x, y + rh - 1, w, 1);
    g.fillStyle = s.win;
    for (let wy = y + rh + 2; wy < y + h - 5; wy += 5) for (let wx = x + 3; wx < x + w - 4; wx += 6) g.fillRect(wx, wy, 3, 2);
    if (p.door) {
      g.fillStyle = s.door;
      g.fillRect(p.door.x * TS + 2, Math.min(y + h - 5, p.door.y * TS), 4, 5);
    }
  }
  return c;
}

/** Figura de una persona (3 × 6 px) en coordenadas de lienzo; resaltada si está seleccionada. */
export function drawPerson(g: CanvasRenderingContext2D, id: string, px: number, py: number, scale: number, selected: boolean): void {
  const l = lookOf(id);
  const s = scale;
  const x = Math.round(px - 1.5 * s);
  const y = Math.round(py - 6 * s);
  if (selected) {
    g.fillStyle = '#FFE14D';
    g.fillRect(x - s, y - s, 5 * s, 8 * s);
  }
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.fillRect(x, y + 6 * s, 3 * s, s);
  g.fillStyle = l.hair;
  g.fillRect(x, y, 3 * s, s);
  g.fillStyle = l.skin;
  g.fillRect(x, y + s, 3 * s, s);
  g.fillStyle = l.shirt;
  g.fillRect(x, y + 2 * s, 3 * s, 2 * s);
  g.fillStyle = l.pants;
  g.fillRect(x, y + 4 * s, s, 2 * s);
  g.fillRect(x + 2 * s, y + 4 * s, s, 2 * s);
}
