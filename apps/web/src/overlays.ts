// Capas, panel «Ahora» y escala de la pantalla Mundo (spec 024 R-021 y R-026): el panel de capas, lo que hace la gente
// ahora y la escala en metros. La lógica es pura y se prueba (CA-016); el cableado del DOM, al final.

export type LayerKey = 'personas' | 'lugares' | 'objetos' | 'vinculos' | 'animo' | 'noche';
export type Layers = Record<LayerKey, boolean>;

/** Las capas del lienzo, en su orden. Objetos aún no tiene posición en el mapa (005): se muestra desactivada. */
export const LAYERS: readonly [LayerKey, string, string | null][] = [
  ['personas', 'Personas', null],
  ['lugares', 'Lugares', null],
  ['objetos', 'Objetos', 'Los objetos todavía no tienen posición en el mapa: se ven en el expediente de cada persona (spec 005).'],
  ['vinculos', 'Vínculos', null],
  ['animo', 'Ánimo', null],
  ['noche', 'Día / noche', null],
];

export const DEFAULT_LAYERS: Layers = { personas: true, lugares: false, objetos: false, vinculos: true, animo: false, noche: true };

/** CA-016: lo que se dibuja con cada capa; lo que se apaga no aparece. */
export function drawPlan(l: Layers, hasSelection: boolean): { figures: boolean; labels: boolean; bonds: boolean; mood: boolean; night: boolean } {
  return { figures: l.personas, labels: l.lugares, bonds: l.vinculos && hasSelection, mood: l.personas && l.animo, night: l.noche };
}

/** Categorías del panel «Ahora» (022 R-016), con su nombre en el panel. */
export const NOW_LABELS: Record<string, string> = { trabajando: 'Trabajando', 'en clase': 'En clase', 'en casa': 'En casa', 'en la calle': 'En la calle', 'en otro lugar': 'En otro lugar' };

/** CA-016: el panel «Ahora»: una fila por categoría y el total, que es la población. */
export function nowRows(now: readonly { kind: string; count: number }[]): { label: string; count: number }[] {
  return now.map((k) => ({ label: NOW_LABELS[k.kind] ?? k.kind, count: k.count }));
}

/** Escala del mapa: la distancia redonda (en m) que ocupa entre 40 y 120 px, y su ancho. Un tile mide 8 m (003). */
export function scaleBar(pxPerTile: number, metersPerTile = 8): { meters: number; px: number } {
  const pxPerMeter = pxPerTile / metersPerTile;
  for (const m of [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]) if (m * pxPerMeter >= 40) return { meters: m, px: Math.round(m * pxPerMeter) };
  return { meters: 1000, px: Math.round(1000 * pxPerMeter) };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Cablea el panel de capas; las capas elegidas se recuerdan en este navegador. */
export function setupLayers(): { get: () => Layers } {
  const box = document.querySelector<HTMLElement>('#layers')!;
  let layers: Layers = { ...DEFAULT_LAYERS };
  try {
    const saved = JSON.parse(localStorage.getItem('dw.layers') ?? 'null') as Partial<Layers> | null;
    if (saved) layers = { ...layers, ...saved, objetos: false };
  } catch {
    // Sin almacenamiento local, las capas por defecto.
  }
  const render = () => {
    box.innerHTML = LAYERS.map(([k, l, off]) => `<button type="button" class="layer" data-layer="${k}" aria-pressed="${layers[k]}"${off ? ` disabled title="${esc(off)}"` : ''}><span>${l}</span><span class="tag">${off ? 'Pronto' : layers[k] ? 'Sí' : 'No'}</span></button>`).join('');
  };
  box.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-layer]');
    if (!b || b.disabled) return;
    const k = b.dataset.layer as LayerKey;
    layers = { ...layers, [k]: !layers[k] };
    try {
      localStorage.setItem('dw.layers', JSON.stringify(layers));
    } catch {
      // No importa: solo se pierde la preferencia.
    }
    render();
  });
  render();
  return { get: () => layers };
}

/** Pinta el panel «Ahora». */
export function renderNow(now: readonly { kind: string; count: number }[]): void {
  const rows = nowRows(now);
  document.querySelector('#nowbox')!.innerHTML = `<dl>${rows.map((r) => `<dt>${esc(r.label)}</dt><dd class="mono">${r.count}</dd>`).join('')}</dl>`;
}

/** Pinta la escala con los px de un tile en pantalla y los metros por tile del mundo (003 v0.4: 40; los anteriores, 8). */
export function renderScale(pxPerTile: number, metersPerTile = 8): void {
  const s = scaleBar(pxPerTile, metersPerTile);
  const bar = document.querySelector<HTMLElement>('#scale-bar');
  if (!bar) return;
  bar.style.width = `${s.px}px`;
  document.querySelector('#scale-txt')!.textContent = s.meters >= 1000 ? `${s.meters / 1000} km` : `${s.meters} m`;
}
