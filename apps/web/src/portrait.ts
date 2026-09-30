// Retrato pixel art de una persona (spec 024 R-025): un busto de 12 × 14 píxeles con los colores de su figura del mapa
// (R-006), estable por su id. Lógica pura: devuelve los rectángulos y el SVG, que se escala por enteros sin suavizado.
import { hash, lookOf } from './logic.ts';

export const PORTRAIT_W = 12;
export const PORTRAIT_H = 14;
const EYE = '#1d2126';

/** Un color más oscuro (para la boca y la sombra de la camisa). */
function shade(hex: string, k: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

/** CA-018: los rectángulos del retrato `[x, y, ancho, alto, color]`, en píxeles del retrato. */
export function portraitRects(id: string): [number, number, number, number, string][] {
  const l = lookOf(id);
  const h = hash(`retrato:${id}`);
  const long = (h & 1) === 1; // pelo largo a los lados
  const tuft = ((h >>> 1) & 3) === 0; // mechón arriba
  const r: [number, number, number, number, string][] = [];
  // Pelo
  r.push([3, 0, 6, 1, l.hair], [2, 1, 8, 2, l.hair]);
  if (tuft) r.push([5, 0, 3, 1, shade(l.hair, 1.25)]);
  // Cara
  r.push([3, 3, 6, 4, l.skin], [4, 7, 4, 1, l.skin]);
  r.push([2, 3, 1, long ? 6 : 2, l.hair], [9, 3, 1, long ? 6 : 2, l.hair]);
  // Ojos, mejillas y boca
  r.push([4, 4, 1, 1, EYE], [7, 4, 1, 1, EYE]);
  r.push([5, 6, 2, 1, shade(l.skin, 0.72)]);
  // Cuello y camisa
  r.push([5, 8, 2, 1, shade(l.skin, 0.85)]);
  r.push([2, 9, 8, 1, l.shirt], [1, 10, 10, 4, l.shirt]);
  r.push([5, 9, 2, 1, shade(l.shirt, 0.78)]); // cuello de la camisa
  r.push([1, 13, 10, 1, shade(l.shirt, 0.82)]);
  return r;
}

/** El retrato en SVG, `scale` píxeles de pantalla por píxel del retrato. */
export function portraitSvg(id: string, name: string, scale = 5): string {
  const rects = portraitRects(id).map(([x, y, w, hh, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${c}"/>`).join('');
  const label = `Retrato de ${name.replace(/[&<>"]/g, '')}`;
  return `<svg class="portrait" width="${PORTRAIT_W * scale}" height="${PORTRAIT_H * scale}" viewBox="0 0 ${PORTRAIT_W} ${PORTRAIT_H}" shape-rendering="crispEdges" role="img" aria-label="${label}">${rects}</svg>`;
}
