// Dibujo de los lugares del mapa en el estilo del lienzo T10 (spec 024 v0.8, R-030): formas redondeadas, contorno grueso
// de tinta, colores planos con un solo reflejo. Las coordenadas son px del mapa (el lienzo se escala con `scale` antes);
// los colores de cada tipo salen de `styleOf` (los mismos del prototipo).
import { styleOf } from './logic.ts';
import { decorOf, parkTrees } from './scenery.ts';
import type { WorldView } from './types.ts';

/** La tinta de los contornos (el azul oscuro del tablero). */
export const INK = '#1B2547';
const LW = 1.1;

type G = CanvasRenderingContext2D;

function box(g: G, x: number, y: number, w: number, h: number, r: number, fill: string, lw = LW): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = lw;
  g.strokeStyle = INK;
  g.stroke();
}

/** Árbol redondo con tronco, borde y un reflejo. */
export function tree(g: G, x: number, y: number): void {
  g.fillStyle = 'rgba(0,0,0,.16)';
  g.beginPath();
  g.ellipse(x + 2.8, y + 7, 3, 1.1, 0, 0, Math.PI * 2);
  g.fill();
  box(g, x + 2.1, y + 4, 1.4, 3, 0.4, '#8A5A33', 0.7);
  g.beginPath();
  g.arc(x + 2.8, y + 2.8, 3.1, 0, Math.PI * 2);
  g.fillStyle = '#3FA535';
  g.fill();
  g.lineWidth = 0.9;
  g.strokeStyle = INK;
  g.stroke();
  g.beginPath();
  g.arc(x + 1.9, y + 1.9, 1, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.fill();
}

/** Parque: césped con borde, senderos en cruz, estanque, árboles y dos bancos. */
export function drawPark(g: G, id: string, x: number, y: number, w: number, h: number): void {
  box(g, x + 0.5, y + 0.5, w - 1, h - 1, 2.5, '#62C03F');
  g.fillStyle = '#EFE0B4';
  g.fillRect(x + 2, y + Math.floor(h / 2) - 1, w - 4, 3);
  g.fillRect(x + Math.floor(w / 2) - 1, y + 2, 3, h - 4);
  if (w >= 24 && h >= 18) {
    box(g, x + 6, y + 6, 14, 9, 4, '#3FA6F2', 0.9);
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.fillRect(x + 9, y + 8, 5, 1);
  }
  for (const t of parkTrees(id, x, y, w, h)) tree(g, t.x, t.y);
  if (w >= 40) {
    box(g, x + w - 18, y + Math.floor(h / 2) + 4, 7, 2.4, 0.8, '#9A6B3E', 0.7);
    box(g, x + 26, y + Math.floor(h / 2) - 6, 7, 2.4, 0.8, '#9A6B3E', 0.7);
  }
}

/** Plaza: adoquín claro con borde y juntas. */
export function drawPlaza(g: G, x: number, y: number, w: number, h: number): void {
  box(g, x + 0.5, y + 0.5, w - 1, h - 1, 2, '#F0E4BE');
  g.fillStyle = '#D8C896';
  for (let yy = y + 4; yy < y + h - 2; yy += 4) g.fillRect(x + 2, yy, w - 4, 0.6);
  for (let xx = x + 4; xx < x + w - 2; xx += 8) g.fillRect(xx, y + 2, 0.6, h - 4);
}

/** Edificio: sombra, muro, tejado de color con alero, ventanas, puerta, toldo y el distintivo de su tipo. */
export function drawBuilding(g: G, p: WorldView['places'][number], x: number, y: number, w: number, h: number, windows: [number, number, number, number][]): void {
  const s = styleOf(p.kind, p.id);
  // Sendero de la puerta a la calle.
  if (p.door && p.door.y * 8 > y + h) {
    g.fillStyle = '#D9C792';
    g.fillRect(p.door.x * 8 + 2, y + h, 4, p.door.y * 8 - (y + h));
  }
  const d = decorOf(p.kind);
  const office = p.kind === 'servicios.oficina' || p.kind.startsWith('gobierno') || p.kind.startsWith('finanzas');
  const rh = Math.max(4, Math.round(h * 0.42));
  g.fillStyle = 'rgba(0,0,0,.2)';
  g.beginPath();
  g.roundRect(x + 2, y + 2.5, w, h, 2.5);
  g.fill();
  box(g, x + 1, y + rh - 2, w - 2, h - rh + 2, 1.6, s.wall);
  // Tejado: más ancho que el muro, con el alero oscuro y un reflejo arriba.
  box(g, x - 0.5, y, w + 1, rh, 2.4, s.roof);
  g.fillStyle = 'rgba(255,255,255,.22)';
  g.fillRect(x + 2, y + 1.6, w - 4, 1.2);
  g.fillStyle = 'rgba(0,0,0,.2)';
  g.fillRect(x + 1, y + rh - 2, w - 2, 1.4);
  const doorX = p.door ? p.door.x * 8 + 2 : x + Math.floor(w / 2) - 2;
  const wh = office ? 2.6 : 3.2;
  for (let wy = y + rh + 2.5; wy < y + h - 9; wy += office ? 4.6 : 6.4)
    for (let wx = x + 4; wx < x + w - 6; wx += 6.4)
      if (!(Math.abs(wx + 1.5 - (doorX + 2)) < 4.5 && wy > y + h - 13)) {
        box(g, wx, wy, 3.4, wh, 0.7, s.win, 0.6);
        windows.push([wx, wy, 3.4, wh]);
      }
  box(g, doorX, y + h - 6.5, 4, 6.5, 1.4, s.door, 0.8);
  if (d.awning) {
    for (let i = 0; i < w - 2; i += 2) {
      g.fillStyle = d.awning[(i / 2) % 2]!;
      g.fillRect(x + 1 + i, y + rh - 1, Math.min(2, w - 2 - i), 3);
    }
    g.lineWidth = 0.7;
    g.strokeStyle = INK;
    g.strokeRect(x + 1, y + rh - 1, w - 2, 3);
  }
  const cx = x + Math.floor(w / 2);
  if (d.mark === 'cruz') {
    box(g, cx - 1.5, y + 2.5, 3, 9, 0.6, '#E0453D', 0.7);
    box(g, cx - 4.5, y + 5.5, 9, 3, 0.6, '#E0453D', 0.7);
  } else if (d.mark === 'chimenea') {
    box(g, x + w - 9, y - 7, 5, 10, 0.8, '#6A6A74', 0.8);
    g.fillStyle = '#B04A3A';
    g.fillRect(x + w - 9, y - 7, 5, 1.4);
  } else if (d.mark === 'bandera') {
    g.fillStyle = INK;
    g.fillRect(x + 3, y - 7, 0.9, 9);
    g.fillStyle = '#F2D24A';
    g.fillRect(x + 4, y - 7, 5, 2);
    g.fillStyle = '#2A5FA8';
    g.fillRect(x + 4, y - 5, 5, 1.2);
    g.fillStyle = '#C83A34';
    g.fillRect(x + 4, y - 3.8, 5, 1.2);
  } else if (d.mark === 'pesas') {
    g.fillStyle = '#F3F0FF';
    g.fillRect(cx - 5, y + 5.6, 11, 1.2);
    box(g, cx - 7, y + 3.4, 2.4, 5.6, 0.6, '#F3F0FF', 0.7);
    box(g, cx + 5, y + 3.4, 2.4, 5.6, 0.6, '#F3F0FF', 0.7);
  }
}
