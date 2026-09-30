// Figuras, noche y selección sobre el mapa (spec 024 R-006, R-007, R-013, R-015), como el prototipo. Se dibuja en
// px del mapa: quien llama pone la transformación de la cámara.
import { hash, lookOf } from './logic.ts';
import type { Figure } from './scene.ts';
import type { Rect } from './types.ts';
import { TS } from './logic.ts';

/** R-007: oscuridad según el minuto del día (la del prototipo): 0,5 de noche, amanecer de 5:00 a 7:00, atardecer de 18:00 a 20:30. */
export function darkness(minuteOfDay: number): number {
  const m = ((minuteOfDay % 1440) + 1440) % 1440;
  if (m < 300 || m >= 1230) return 0.5;
  if (m < 420) return 0.5 * (1 - (m - 300) / 120);
  if (m >= 1080) return (0.5 * (m - 1080)) / 150;
  return 0;
}

/** R-006: la figura de 3 px de ancho del prototipo; las piernas se alternan al caminar; los niños son más bajos. */
export function drawFigure(g: CanvasRenderingContext2D, f: Figure): void {
  const l = lookOf(f.id);
  const x = Math.round(f.x) - 1;
  const y = Math.round(f.y) - (f.small ? 5 : 6);
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.fillRect(x - 1, y + (f.small ? 4 : 5), 5, 1);
  g.fillStyle = l.hair;
  g.fillRect(x, y, 3, 1);
  g.fillStyle = l.skin;
  g.fillRect(x, y + 1, 3, 1);
  g.fillStyle = l.shirt;
  g.fillRect(x, y + 2, 3, f.small ? 1 : 2);
  g.fillStyle = l.pants;
  const ly = y + (f.small ? 3 : 4);
  if (f.walk && f.frame) {
    g.fillRect(x, ly, 1, 1);
    g.fillRect(x + 2, ly, 1, 1);
  } else {
    g.fillRect(x + 1, ly, 1, 1);
    g.fillRect(x, ly, 1, 1);
  }
}

/**
 * R-007 y R-013: el velo de la noche y, cuando ya oscurece, las ventanas de los edificios con alguien despierto
 * dentro (en las casas con poca gente, no todas).
 */
export function drawNight(g: CanvasRenderingContext2D, dk: number, size: { w: number; h: number }, windows: ReadonlyMap<string, [number, number, number, number][]>, occ: ReadonlyMap<string, number>): void {
  if (dk <= 0) return;
  g.fillStyle = `rgba(16,20,56,${dk})`;
  g.fillRect(0, 0, size.w, size.h);
  if (dk <= 0.15) return;
  g.fillStyle = '#FFD66B';
  for (const [key, n] of occ) {
    const list = windows.get(key);
    if (!list) continue;
    const h = hash(key);
    list.forEach((w, i) => {
      if (n < 3 && (i + h) % 3 === 2) return;
      g.fillRect(w[0], w[1], w[2], w[3]);
    });
  }
}

/** R-015: la flecha amarilla que parpadea sobre la persona elegida. */
export function drawArrow(g: CanvasRenderingContext2D, f: Figure, blink: boolean): void {
  const x = Math.round(f.x) - 1;
  const y = Math.round(f.y) - 13 - (blink ? 1 : 0);
  g.fillStyle = '#FFE46B';
  g.fillRect(x, y, 3, 1);
  g.fillRect(x + 1, y + 1, 1, 1);
}

/** R-015: el marco amarillo de un lugar (el elegido, o el edificio donde está la persona elegida). */
export function drawFrame(g: CanvasRenderingContext2D, r: Rect, scale: number): void {
  g.strokeStyle = '#FFE46B';
  g.lineWidth = Math.max(1, Math.round(scale)) / scale;
  g.strokeRect(r.x * TS - 1.5, r.y * TS - 1.5, r.w * TS + 3, r.h * TS + 3);
}
