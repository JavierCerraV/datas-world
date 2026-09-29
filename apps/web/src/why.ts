// «¿Por qué?» de cada evento de la pestaña Historia (spec 019 R-007): el árbol de causas de `/api/events/:id/why`,
// desplegable. Los árboles ya cargados y los abiertos se guardan aquí: la ficha se repinta con cada tick.

export interface WhyNode {
  kind: 'event' | 'state' | 'source';
  ref: string;
  text: string;
  weight: number;
  at?: number;
  date?: string;
  children: WhyNode[];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const cache = new Map<string, string>();
const open = new Set<string>();

/** El árbol en listas anidadas: los hechos con su fecha, los estados y las fuentes en otro estilo, con su peso. */
export function renderWhy(n: WhyNode, root = true): string {
  const label = `${n.date ? `<span class="mono">${esc(n.date.slice(0, 16))}</span> ` : ''}<span class="why-${n.kind}">${esc(n.text)}</span>${root ? '' : ` <span class="muted">${Math.round(n.weight * 100)} %</span>`}`;
  const kids = n.children.length ? `<ul class="why">${n.children.map((c) => `<li>${renderWhy(c, false)}</li>`).join('')}</ul>` : '';
  return root ? kids || '<p class="muted">Sin causas registradas.</p>' : `← ${label}${kids}`;
}

/** El desplegable de un evento, abierto y con su árbol si ya se había abierto. */
export const whyToggle = (id: string): string =>
  `<details class="why-box" data-why="${esc(id)}"${open.has(id) ? ' open' : ''}><summary>¿por qué?</summary><div>${cache.get(id) ?? (open.has(id) ? '<p>Cargando…</p>' : '')}</div></details>`;

/** Escucha los desplegables de `root`: al abrir uno, carga su árbol (una vez) y lo recuerda abierto. */
export function bindWhy(root: HTMLElement): void {
  root.addEventListener('toggle', (ev) => {
    const box = ev.target as HTMLDetailsElement;
    const id = box.dataset?.why;
    if (!id) return;
    if (!box.open) {
      open.delete(id);
      return;
    }
    open.add(id);
    const body = box.querySelector('div')!;
    if (cache.has(id)) {
      body.innerHTML = cache.get(id)!;
      return;
    }
    body.innerHTML = '<p>Cargando…</p>';
    void fetch(`/api/events/${id}/why`).then(async (r) => {
      const html = r.ok ? renderWhy((await r.json()) as WhyNode) : '<p>No se pudo cargar.</p>';
      if (r.ok) cache.set(id, html);
      body.innerHTML = html;
    });
  }, true);
}
