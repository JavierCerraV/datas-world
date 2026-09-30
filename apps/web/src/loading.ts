// Indicador de carga (spec 024 R-026): un esqueleto animado con «Cargando …» y `aria-busy`, mientras llega lo que
// necesita una pestaña o una pantalla. Formateo puro; la animación se quita con movimiento reducido (CSS).

/** CA-019: el esqueleto de una sección que aún no ha llegado. `rows`: líneas grises que imitan el contenido. */
export function skeleton(label: string, rows = 4): string {
  const lines = Array.from({ length: rows }, (_, k) => `<i style="width:${[92, 78, 85, 64, 88, 70][k % 6]}%"></i>`).join('');
  return `<div class="skeleton" role="status" aria-busy="true" aria-live="polite"><span class="sk-label"><b class="spinner" aria-hidden="true"></b>Cargando ${label}…</span>${lines}</div>`;
}

/** Dos tarjetas de esqueleto, para una pestaña entera. */
export const skeletonTab = (label: string): string =>
  `<div class="grid-2"><section class="card">${skeleton(label, 5)}</section><section class="card">${skeleton(label, 5)}</section></div>`;
