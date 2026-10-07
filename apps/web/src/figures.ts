// Figuras, noche y selección sobre el mapa (spec 024 R-006, R-007, R-013, R-015), como el prototipo. Se dibuja en
// px del mapa: quien llama pone la transformación de la cámara.
import { hash, lookOf } from './logic.ts';
import type { Figure } from './scene.ts';
import type { Rect } from './types.ts';
import { TS } from './logic.ts';

/** R-026: el aro dorado de quien está en la cohorte (el oro de dw-tokens.css). */
export const COHORT_RING = '#FFD23E';

/** R-007: oscuridad según el minuto del día (la del prototipo): 0,5 de noche, amanecer de 5:00 a 7:00, atardecer de 18:00 a 20:30. */
export function darkness(minuteOfDay: number): number {
  const m = ((minuteOfDay % 1440) + 1440) % 1440;
  if (m < 300 || m >= 1230) return 0.5;
  if (m < 420) return 0.5 * (1 - (m - 300) / 120);
  if (m >= 1080) return (0.5 * (m - 1080)) / 150;
  return 0;
}

const INK = '#1B2547';

/** Altura de la figura adulta en px del mapa (la del niño es el 78 %): la persona se ve junto al edificio, como en el lienzo. */
export const FIGURE_H = 10;

/**
 * R-006, R-030: figura «chibi» en vectores (cabeza grande, cuerpo redondeado, contorno de tinta). Los pies están en
 * `f.y`. Las piernas se alternan al caminar y la figura rebota un poco; los niños son más bajos.
 */
export function drawFigure(g: CanvasRenderingContext2D, f: Figure): void {
  const l = lookOf(f.id);
  const k = f.small ? 0.78 : 1;
  const bob = f.walk && f.frame ? -0.5 : 0;
  const x = f.x;
  const y = f.y + bob;
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  g.lineJoin = 'round';
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.beginPath();
  g.ellipse(0, -bob / k, 3, 1, 0, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 0.7;
  g.strokeStyle = INK;
  g.fillStyle = l.pants;
  const step = f.walk && f.frame ? 1 : 0;
  for (const dx of [-1.6, 0.6]) {
    g.beginPath();
    g.roundRect(dx + (dx < 0 ? -step * 0.6 : step * 0.6), -3, 1.6, 3, 0.5);
    g.fill();
    g.stroke();
  }
  g.fillStyle = l.shirt;
  g.beginPath();
  g.roundRect(-2.4, -6.2, 4.8, 3.9, 1.5);
  g.fill();
  g.stroke();
  g.fillStyle = l.skin;
  g.beginPath();
  g.arc(0, -8, 2.5, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = l.hair;
  g.beginPath();
  g.arc(0, -8, 2.5, Math.PI * 1.02, Math.PI * 1.98);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(0, -8, 2.5, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = INK;
  g.fillRect(-1.2, -7.7, 0.6, 0.6);
  g.fillRect(0.6, -7.7, 0.6, 0.6);
  g.restore();
}

/** R-006, R-030: el punto del ánimo junto a la cabeza de la figura (capa Ánimo), con borde claro. */
export function drawMoodDot(g: CanvasRenderingContext2D, f: Figure, color: string): void {
  const k = f.small ? 0.78 : 1;
  g.beginPath();
  g.arc(f.x + 3.2 * k, f.y - 10.4 * k, 1.5, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.lineWidth = 0.7;
  g.strokeStyle = '#FFFFFF';
  g.stroke();
}

/** R-026, R-030: el aro dorado de la cohorte alrededor de la figura. */
export function drawCohortRing(g: CanvasRenderingContext2D, f: Figure): void {
  const k = f.small ? 0.78 : 1;
  g.beginPath();
  g.arc(f.x, f.y - 5 * k, 7.2 * k, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,210,62,.22)';
  g.fill();
  g.lineWidth = 1.2;
  g.strokeStyle = COHORT_RING;
  g.stroke();
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

/** R-015, R-030: la corona-flecha dorada que rebota sobre la persona elegida. */
export function drawArrow(g: CanvasRenderingContext2D, f: Figure, blink: boolean): void {
  const y = f.y - (f.small ? 13 : 15) - (blink ? 1.2 : 0);
  g.beginPath();
  g.moveTo(f.x - 2.6, y - 3.4);
  g.lineTo(f.x + 2.6, y - 3.4);
  g.lineTo(f.x, y);
  g.closePath();
  g.fillStyle = COHORT_RING;
  g.fill();
  g.lineJoin = 'round';
  g.lineWidth = 0.8;
  g.strokeStyle = INK;
  g.stroke();
}

/** R-015, R-030: el marco dorado de un lugar (el elegido, o el edificio donde está la persona elegida). */
export function drawFrame(g: CanvasRenderingContext2D, r: Rect, scale: number): void {
  g.lineWidth = Math.max(1.4, scale) / scale;
  g.strokeStyle = INK;
  g.beginPath();
  g.roundRect(r.x * TS - 2, r.y * TS - 2, r.w * TS + 4, r.h * TS + 4, 3);
  g.stroke();
  g.strokeStyle = COHORT_RING;
  g.lineWidth = Math.max(1, scale * 0.7) / scale;
  g.stroke();
}
