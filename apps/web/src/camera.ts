// Cámara y reloj del visor (spec 024 R-001, R-014), como el prototipo: el mapa ajustado a su espacio y centrado, zoom
// de 1 a 6 (entero a partir de ×3 para que el pixel art no se emborrone), arrastre y seguimiento; y la hora del
// minuto de la vista en español. Lógica pura.

export interface Cam {
  /** Centro de la vista, en px del mapa. */
  x: number;
  y: number;
  /** Zoom sobre el ajuste: 1 = el mapa entero a la vista. */
  z: number;
}

/**
 * Escala (px de pantalla por px del mapa) y centro ya limitado: si el mapa cabe, centrado; si no, sin salirse de él.
 * `dpr` es la densidad de la pantalla: la escala real en píxeles físicos es entera desde ×3.
 */
export function frameOf(cam: Cam, viewW: number, viewH: number, mapW: number, mapH: number, dpr = 1): { s: number; cx: number; cy: number } {
  const fit = Math.min(viewW / mapW, viewH / mapH);
  const raw = fit * cam.z * dpr;
  const s = (raw >= 3 ? Math.floor(raw) : raw) / dpr;
  const vw = viewW / s;
  const vh = viewH / s;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return { s, cx: vw >= mapW ? mapW / 2 : clamp(cam.x, vw / 2, mapW - vw / 2), cy: vh >= mapH ? mapH / 2 : clamp(cam.y, vh / 2, mapH - vh / 2) };
}

/** Un punto de la pantalla (relativo al lienzo) en px del mapa. */
export const toMap = (f: { s: number; cx: number; cy: number }, viewW: number, viewH: number, px: number, py: number) => ({
  x: (px - viewW / 2) / f.s + f.cx,
  y: (py - viewH / 2) / f.s + f.cy,
});

export const clampZoom = (z: number): number => Math.min(6, Math.max(1, z));

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** La hora, la fecha y el día de simulación del minuto `m` del mundo (desde su `epoch`, `2026-01-01T00:00`). */
export function clockOf(epoch: string, m: number): { time: string; date: string; day: string; iso: string } {
  const [d, t] = epoch.split('T');
  const [y, mo, da] = (d ?? '2026-01-01').split('-').map(Number);
  const [hh, mm] = (t ?? '00:00').split(':').map(Number);
  const at = new Date(Date.UTC(y!, mo! - 1, da!, hh ?? 0, mm ?? 0) + Math.floor(m) * 60_000);
  const two = (n: number) => String(n).padStart(2, '0');
  const iso = `${at.getUTCFullYear()}-${two(at.getUTCMonth() + 1)}-${two(at.getUTCDate())}`;
  return {
    time: `${two(at.getUTCHours())}:${two(at.getUTCMinutes())}`,
    date: `${DAYS[at.getUTCDay()]} ${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`,
    day: `Día ${Math.floor(m / 1440) + 1} de simulación`,
    iso,
  };
}
