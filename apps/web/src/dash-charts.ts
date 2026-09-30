// Gráficas del dashboard (spec 024 R-023, R-027) en SVG, con las marcas de la guía de visualización: barras de 24 px
// como mucho con el extremo redondeado, rejilla fina, etiquetas directas selectivas y el valor al pasar el cursor
// (`<title>`). El SVG tiene su ancho natural y solo se encoge, así que las líneas no engordan. Formateo puro.

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Tope redondo del eje: el siguiente múltiplo de 10 (así la marca del medio es entera). */
export const niceMax = (m: number) => Math.max(10, Math.ceil(m / 10) * 10);

/** Barra horizontal con el extremo de datos redondeado (4 px) y la base recta. */
const hbar = (x: number, y: number, w: number, h: number, cls: string, title: string, left = false) => {
  if (w <= 0) return '';
  const r = Math.min(4, w, h / 2);
  const d = left
    ? `M${x} ${y}H${x - w + r}Q${x - w} ${y} ${x - w} ${y + r}V${y + h - r}Q${x - w} ${y + h} ${x - w + r} ${y + h}H${x}Z`
    : `M${x} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x}Z`;
  return `<path class="${cls}" d="${d}"><title>${esc(title)}</title></path>`;
};

/** CA-015: la pirámide por edad y sexo: mujeres a la izquierda y hombres a la derecha, del grupo mayor arriba. */
export function pyramidSvg(p: readonly { group: string; F: number; M: number }[]): string {
  const W = 560;
  const mid = 280;
  const gap = 28;
  const half = mid - gap - 16;
  const max = niceMax(Math.max(1, ...p.flatMap((g) => [g.F, g.M])));
  const rowH = 28;
  const barH = 20;
  const rows = [...p].reverse();
  const w = (n: number) => (half * n) / max;
  const top = 26;
  const f = rows.map((g, i) => hbar(mid - gap, top + i * rowH, w(g.F), barH, 'bar', `${g.group} · mujeres: ${g.F}`, true)).join('');
  const m = rows.map((g, i) => hbar(mid + gap, top + i * rowH, w(g.M), barH, 'bar', `${g.group} · hombres: ${g.M}`)).join('');
  const labels = rows.map((g, i) => `<text x="${mid}" y="${top + i * rowH + 14}" text-anchor="middle" class="axis-lbl">${esc(g.group)}</text>`).join('');
  const bottom = top + rows.length * rowH;
  const ticks = [0, max / 2, max].flatMap((v) => [
    `<path class="grid" d="M${(mid - gap - w(v)).toFixed(1)} ${top - 4}V${bottom}M${(mid + gap + w(v)).toFixed(1)} ${top - 4}V${bottom}"/>`,
    `<text x="${(mid - gap - w(v)).toFixed(1)}" y="${bottom + 14}" text-anchor="middle" class="tick">${v}</text>`,
    `<text x="${(mid + gap + w(v)).toFixed(1)}" y="${bottom + 14}" text-anchor="middle" class="tick">${v}</text>`,
  ]).join('');
  return `<svg class="dchart pyramid" width="${W}" viewBox="0 0 ${W} ${bottom + 20}" role="img" aria-label="Pirámide de población por grupos de 10 años">`
    + `${ticks}<text x="${mid - gap - half / 2}" y="12" text-anchor="middle" class="axis-lbl">Mujeres</text><text x="${mid + gap + half / 2}" y="12" text-anchor="middle" class="axis-lbl">Hombres</text>`
    + `<g class="f">${f}</g><g class="m">${m}</g>${labels}</svg>`;
}

/** CA-015: barras horizontales de mayor a menor, con el valor al final de cada barra (ocupación, empleadores, hogares). */
export function hbarsSvg(rows: readonly { label: string; count: number }[], total: number, aria: string, labelW = 150): string {
  const W = 520;
  const rowH = 26;
  const barH = 18;
  const max = Math.max(1, ...rows.map((r) => r.count));
  const len = (n: number) => ((W - labelW - 50) * n) / max;
  const body = rows.map((r, i) => {
    const y = 6 + i * rowH;
    const pct = total ? Math.round((r.count / total) * 100) : 0;
    return `<text x="${labelW - 10}" y="${y + 13}" text-anchor="end" class="axis-lbl">${esc(r.label)}</text>`
      + hbar(labelW, y, len(r.count), barH, 'bar', `${r.label}: ${r.count}${total ? ` (${pct} %)` : ''}`)
      + `<text x="${(labelW + len(r.count) + 6).toFixed(1)}" y="${y + 13}" class="val">${r.count}</text>`;
  }).join('');
  const h = 10 + rows.length * rowH;
  return `<svg class="dchart hbars" width="${W}" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(aria)}"><path class="axis" d="M${labelW} 2V${h - 2}"/>${body}</svg>`;
}

/** CA-020: histograma en columnas (≤ 24 px, extremo redondeado arriba) con el eje de sus tramos. */
export function histogramSvg(counts: readonly number[], labels: readonly string[], aria: string, cls = 'bar'): string {
  const W = 380;
  const H = 170;
  const pad = { l: 28, r: 8, t: 10, b: 26 };
  const max = niceMax(Math.max(1, ...counts));
  const slot = (W - pad.l - pad.r) / counts.length;
  const bw = Math.min(24, slot - 4);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const base = H - pad.b;
  const bars = counts.map((c, i) => {
    if (c <= 0) return '';
    const x = pad.l + i * slot + (slot - bw) / 2;
    const top = y(c);
    const r = Math.min(4, (base - top) / 2, bw / 2);
    return `<path class="${cls}" d="M${x.toFixed(1)} ${base}V${(top + r).toFixed(1)}Q${x.toFixed(1)} ${top.toFixed(1)} ${(x + r).toFixed(1)} ${top.toFixed(1)}H${(x + bw - r).toFixed(1)}Q${(x + bw).toFixed(1)} ${top.toFixed(1)} ${(x + bw).toFixed(1)} ${(top + r).toFixed(1)}V${base}Z"><title>${esc(labels[i] ?? '')}: ${c}</title></path>`;
  }).join('');
  const grid = [0, max / 2, max].map((v) => `<path class="grid" d="M${pad.l} ${y(v).toFixed(1)}H${W - pad.r}"/><text x="${pad.l - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="tick">${v}</text>`).join('');
  const step = counts.length > 8 ? 2 : 1;
  const xl = labels.map((l, i) => (i % step === 0 ? `<text x="${(pad.l + i * slot + slot / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="tick">${esc(l)}</text>` : '')).join('');
  return `<svg class="dchart hist" width="${W}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">${grid}${bars}${xl}</svg>`;
}

/** Las marcas de un histograma de [0,1] en 10 tramos: «0,0», «0,1»… */
export const unitLabels = Array.from({ length: 10 }, (_, i) => (i / 10).toFixed(1).replace('.', ','));

/** Una tabla simple para «Ver como tabla». */
export const miniTable = (head: [string, string], rows: readonly [string, string | number][]) =>
  `<table class="dtable"><thead><tr><th>${esc(head[0])}</th><th>${esc(head[1])}</th></tr></thead><tbody>${rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="mono">${esc(String(b))}</td></tr>`).join('')}</tbody></table>`;
