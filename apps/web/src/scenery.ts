// Detalle visual del prototipo (spec 024 R-012): árboles sueltos en la hierba lejos de las calles, parques con
// senderos, estanque, árboles y bancos, y edificios con tejado a franjas, toldos y el adorno de su tipo. Se porta el
// comportamiento, no el código: el azar del prototipo se sustituye por un hash estable de la posición (R-006), así el
// mapa sale igual en cada carga y no depende de ninguna semilla del cliente.
import { hash } from './logic.ts';

/** Tiles del motor (`TILE` de la geografía). */
export const T = Object.freeze({ grass: 0, road: 1, building: 2, water: 3, park: 4, plaza: 5 });

/** [M] Proporción de tiles de hierba libres con árbol (el prototipo usa 0,22). */
export const TREE_DENSITY = 0.22;

export interface Rect { x: number; y: number; w: number; h: number }

const rnd = (key: string) => hash(key) / 0x1_0000_0000;

/**
 * Tiles con árbol: hierba cuyos cuatro vecinos también son hierba (ni calle ni edificio al lado), fuera de cualquier
 * lugar con área, con la densidad del prototipo. Devuelve el tile y un desplazamiento de 0 a 2 px, como el prototipo.
 */
export function treeSpots(geo: { width: number; height: number; tiles: readonly number[] }, rects: readonly Rect[]): { x: number; y: number; dx: number; dy: number }[] {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= geo.width || y >= geo.height ? T.grass : geo.tiles[y * geo.width + x] ?? T.grass);
  const inRect = (x: number, y: number) => rects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  const out: { x: number; y: number; dx: number; dy: number }[] = [];
  for (let y = 0; y < geo.height; y++)
    for (let x = 0; x < geo.width; x++) {
      if (at(x, y) !== T.grass || at(x + 1, y) !== T.grass || at(x - 1, y) !== T.grass || at(x, y + 1) !== T.grass || at(x, y - 1) !== T.grass) continue;
      if (inRect(x, y) || rnd(`arbol:${x}:${y}`) >= TREE_DENSITY) continue;
      const h = hash(`arbol-pos:${x}:${y}`);
      out.push({ x, y, dx: h % 3, dy: (h >>> 2) % 2 });
    }
  return out;
}

/** Adornos del tipo de lugar: toldo a rayas (comercio y ocio) y el distintivo del prototipo. */
export interface Decor { awning?: readonly [string, string]; mark?: 'cruz' | 'chimenea' | 'bandera' | 'pesas' }

export function decorOf(kind: string): Decor {
  if (kind.startsWith('salud')) return { mark: 'cruz' };
  if (kind.startsWith('industria')) return { mark: 'chimenea' };
  if (kind.startsWith('educacion')) return { mark: 'bandera' };
  if (kind === 'ocio.gimnasio' || kind.startsWith('deporte')) return { mark: 'pesas' };
  if (kind === 'ocio.cafe' || kind === 'ocio.bar') return { awning: ['#7A4A2E', '#EFE0C8'] };
  if (kind === 'ocio.restaurante') return { awning: ['#B23A2E', '#F5EEE4'] };
  if (kind.startsWith('comercio')) return { awning: ['#3D8A6A', '#F1EDE2'] };
  return {};
}

/**
 * Árboles de un parque (en px del lienzo): hasta 9 intentos como el prototipo, fuera de los senderos centrales y del
 * rincón del estanque; posiciones fijas por el id del lugar.
 */
export function parkTrees(id: string, x: number, y: number, w: number, h: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  if (w < 14 || h < 13) return out;
  for (let i = 0; i < 9; i++) {
    const hv = hash(`${id}:arbol:${i}`);
    const tx = x + 4 + (hv % (w - 12));
    const ty = y + 3 + ((hv >>> 8) % (h - 11));
    if (Math.abs(ty + 3 - (y + h / 2)) < 5 || Math.abs(tx + 2 - (x + w / 2)) < 5 || (tx < x + 22 && ty < y + 16)) continue;
    out.push({ x: tx, y: ty });
  }
  return out;
}
