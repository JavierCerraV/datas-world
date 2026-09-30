// Interacción con el mapa (spec 024 R-005): arrastrar mueve la cámara, la rueda cambia el zoom y un clic (sin arrastre)
// elige lo que haya debajo. Solo el cableado del DOM; qué se elige lo decide quien llama.

export interface MapInput {
  canvas: HTMLCanvasElement;
  /** Mueve la cámara `dx`, `dy` píxeles de pantalla. */
  pan: (dx: number, dy: number) => void;
  /** Cambia el zoom un paso (+1 o −1) alrededor de un punto de la pantalla. */
  zoom: (step: number, cx: number, cy: number) => void;
  /** Un clic en un punto de la pantalla (relativo al lienzo). */
  click: (x: number, y: number) => void;
}

export function setupMapInput(o: MapInput): void {
  const { canvas } = o;
  let drag: { x: number; y: number; moved: boolean } | null = null;
  canvas.addEventListener('pointerdown', (e) => (drag = { x: e.clientX, y: e.clientY, moved: false }));
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    if (drag.moved) {
      o.pan(dx, dy);
      drag = { x: e.clientX, y: e.clientY, moved: true };
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (drag && !drag.moved) {
      const r = canvas.getBoundingClientRect();
      o.click(e.clientX - r.left, e.clientY - r.top);
    }
    drag = null;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    o.zoom(e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top);
  });
}
