// Pestaña «Vida» de la ficha (spec 041 R-009; decisión del usuario 2026-09-28): el familiograma extenso y la historia
// de aprendizaje por etapas. Solo lee `/api/citizens/:id/life` (022). El familiograma usa la simbología habitual:
// cuadrado hombre, círculo mujer, borde doble la persona, cruz si murió, borde punteado si vive fuera del mundo, y
// la relación con la persona en verde (cercana), rojo en zigzag (conflictiva) o gris punteado (distante).

export type Quality = 'cercana' | 'conflictiva' | 'distante' | 'sin_datos';
export interface GenoNode {
  id: string;
  name: string;
  sex: 'F' | 'M';
  born: number | null;
  died: number | null;
  outside: boolean;
  generation: number;
  relation: string;
  quality: Quality;
  motherId: string | null;
  fatherId: string | null;
}
export interface EpisodeView {
  date: string;
  age: number;
  stage: string;
  kind: string;
  title: string;
  text: string;
  speaker: string;
  speakerName: string | null;
  valence: number;
  learned: { label: string; delta: number }[];
  cause: string | null;
}
export interface LifeView {
  id: string;
  name: string;
  genogram: { nodes: GenoNode[]; partners: [string, string][] };
  stages: { stage: string; episodes: EpisodeView[] }[];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const STAGE: Record<string, string> = { infancia: 'Infancia (0–5 años)', escolar: 'Edad escolar (6–11)', adolescencia: 'Adolescencia (12–17)', adulto: 'Vida adulta (18+)' };
const QUALITY: Record<Quality, string> = { cercana: 'cercana', conflictiva: 'conflictiva', distante: 'distante', sin_datos: 'sin datos' };
const DX = 96;
const DY = 92;
const R = 16;

/** Posiciones: una fila por generación; en cada fila, en el orden en que llegan (generación, nacimiento). */
function layout(nodes: readonly GenoNode[]): { pos: Map<string, { x: number; y: number }>; width: number; height: number } {
  const rows = new Map<number, GenoNode[]>();
  for (const n of nodes) rows.set(n.generation, [...(rows.get(n.generation) ?? []), n]);
  const gens = [...rows.keys()].sort((a, b) => a - b);
  const widest = Math.max(1, ...[...rows.values()].map((r) => r.length));
  const width = widest * DX + DX;
  const pos = new Map<string, { x: number; y: number }>();
  gens.forEach((g, gi) => {
    const row = rows.get(g)!;
    const offset = (width - row.length * DX) / 2 + DX / 2;
    row.forEach((n, i) => pos.set(n.id, { x: offset + i * DX, y: 40 + gi * DY }));
  });
  return { pos, width, height: gens.length * DY + 30 };
}

const zigzag = (x1: number, y1: number, x2: number, y2: number) => {
  const n = 8;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const dx = y2 - y1;
    const dy = x1 - x2;
    const len = Math.hypot(dx, dy) || 1;
    const k = i % 2 === 0 ? 0 : i % 4 === 1 ? 5 : -5;
    pts.push(`${(x1 + (x2 - x1) * t + (dx / len) * k).toFixed(1)},${(y1 + (y2 - y1) * t + (dy / len) * k).toFixed(1)}`);
  }
  return pts.join(' ');
};

/** SVG del familiograma (041 CA-006). */
export function genogramSvg(g: LifeView['genogram']): string {
  const { pos, width, height } = layout(g.nodes);
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const me = g.nodes.find((n) => n.relation === 'yo');
  const parts: string[] = [];
  // Parejas: línea horizontal por debajo de los dos.
  for (const [a, b] of g.partners) {
    const p = pos.get(a);
    const q = pos.get(b);
    if (p && q) parts.push(`<path class="g-couple" d="M${p.x},${p.y + R} v10 H${q.x} v-10"/>`);
  }
  // Hijos: del punto medio de la pareja (o de su único progenitor) al hijo.
  for (const n of g.nodes) {
    const parents = [n.motherId, n.fatherId].map((x) => (x ? pos.get(x) : undefined)).filter((x): x is { x: number; y: number } => !!x);
    const c = pos.get(n.id)!;
    if (parents.length === 0) continue;
    const mx = parents.reduce((s, p) => s + p.x, 0) / parents.length;
    const my = parents[0]!.y + R + (parents.length === 2 ? 10 : 0);
    parts.push(`<path class="g-child" d="M${mx},${my} V${(my + c.y - R) / 2} H${c.x} V${c.y - R}"/>`);
  }
  // Relación con la persona.
  if (me) {
    const m = pos.get(me.id)!;
    for (const n of g.nodes) {
      if (n.id === me.id || n.quality === 'sin_datos') continue;
      const p = pos.get(n.id)!;
      if (n.quality === 'conflictiva') parts.push(`<polyline class="g-q conflictiva" points="${zigzag(m.x, m.y, p.x, p.y)}"/>`);
      else parts.push(`<line class="g-q ${n.quality}" x1="${m.x}" y1="${m.y}" x2="${p.x}" y2="${p.y}"/>`);
    }
  }
  // Personas.
  for (const n of g.nodes) {
    const p = pos.get(n.id)!;
    const cls = `g-person${n.outside ? ' outside' : ''}${n.relation === 'yo' ? ' me' : ''}`;
    const shape = n.sex === 'M' ? `<rect x="${p.x - R}" y="${p.y - R}" width="${2 * R}" height="${2 * R}"/>` : `<circle cx="${p.x}" cy="${p.y}" r="${R}"/>`;
    const inner = n.relation === 'yo' ? (n.sex === 'M' ? `<rect class="inner" x="${p.x - R + 4}" y="${p.y - R + 4}" width="${2 * R - 8}" height="${2 * R - 8}"/>` : `<circle class="inner" cx="${p.x}" cy="${p.y}" r="${R - 4}"/>`) : '';
    const dead = n.died !== null ? `<path class="g-dead" d="M${p.x - R},${p.y - R} L${p.x + R},${p.y + R} M${p.x + R},${p.y - R} L${p.x - R},${p.y + R}"/>` : '';
    const years = `${n.born ?? '?'}${n.died !== null ? `–${n.died}` : ''}`;
    const first = n.name.split(' ')[0] ?? n.name;
    const title = `${n.name} · ${n.relation} · ${years}${n.outside ? ' · vive fuera del mundo' : ''}${n.relation !== 'yo' ? ` · relación ${QUALITY[n.quality]}` : ''}`;
    parts.push(`<g class="${cls}"${byId.has(n.id) ? ` data-id="${esc(n.id)}"` : ''}><title>${esc(title)}</title>${shape}${inner}${dead}<text x="${p.x}" y="${p.y - R - 5}" class="g-rel">${esc(n.relation)}</text><text x="${p.x}" y="${p.y + R + 26}" class="g-name">${esc(first)}</text><text x="${p.x}" y="${p.y + R + 38}" class="g-years">${esc(years)}</text></g>`);
  }
  return `<svg class="genogram" viewBox="0 0 ${width} ${height + 30}" width="${width}" role="img" aria-label="Familiograma">${parts.join('')}</svg>`;
}

const LEGEND = `<p class="g-legend"><span class="sw cercana"></span>cercana <span class="sw conflictiva"></span>conflictiva <span class="sw distante"></span>distante · ▢ hombre ○ mujer · ✕ murió · borde punteado: vive fuera del mundo</p>`;

const learnedText = (l: { label: string; delta: number }[]) =>
  l.length ? l.map((x) => `${esc(x.label)} <span class="mono ${x.delta > 0 ? 'up' : 'down'}">${x.delta > 0 ? '+' : ''}${x.delta.toFixed(2)}</span>`).join(' · ') : '<span class="muted">nada nuevo (ya lo había aprendido)</span>';

/** La pestaña completa: familiograma y episodios por etapa (041 CA-005). */
export function renderLife(v: LifeView): string {
  const total = v.stages.reduce((a, s) => a + s.episodes.length, 0);
  const stages = v.stages
    .map((s, i) => `<details class="life-stage"${i === 0 ? ' open' : ''}><summary>${esc(STAGE[s.stage] ?? s.stage)} · ${s.episodes.length} episodios</summary><ol class="life">${s.episodes
      .map((e) => `<li class="${e.valence > 0 ? 'pos' : e.valence < 0 ? 'neg' : ''}"><span class="mono">${esc(e.date)}</span> · ${e.age} años${e.speaker ? ` · ${esc(e.speaker)}${e.speakerName ? ` (${esc(e.speakerName)})` : ''}` : ''}<br>${esc(e.text)}<small>aprendió: ${learnedText(e.learned)}${e.cause ? `<br>por: ${esc(e.cause)}` : ''}</small></li>`)
      .join('')}</ol></details>`)
    .join('');
  return `<h3>Familiograma</h3><div class="genogram-wrap">${genogramSvg(v.genogram)}</div>${LEGEND}<h3>Historia de vida</h3>${total ? stages : '<p>Este mundo no tiene historia de desarrollo (se creó antes de la spec 041).</p>'}`;
}

/** Carga y muestra la historia de vida de una persona. */
export async function showLife(el: HTMLElement, id: string): Promise<void> {
  el.innerHTML = '<p>Cargando su historia…</p>';
  const r = await fetch(`/api/citizens/${id}/life`);
  if (!r.ok) {
    el.innerHTML = '<p>No se pudo cargar su historia.</p>';
    return;
  }
  el.innerHTML = renderLife((await r.json()) as LifeView);
}
