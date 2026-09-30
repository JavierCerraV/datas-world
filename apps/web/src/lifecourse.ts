// Curso de vida del expediente (spec 024 R-022, pestaña Resumen): una línea por años con los tramos de dónde vivió
// (antes y después de llegar al mundo) y los hitos de su historia de origen (030) y de la simulación, con las
// etiquetas repartidas arriba y abajo para que no se pisen. Lógica pura: devuelve SVG.
import type { Dossier } from './dossier-types.ts';

export interface Milestone { at: number; year: number; label: string; tone: 'ink' | 'bad' | 'good' | 'muted' }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const yearOf = (date: string) => Number(date.slice(0, 4));
const first = (name: string | null | undefined) => (name ?? 'alguien').split(' ')[0]!;

/** Los hitos de una vida, de su expediente: nacer, estudios, hogar, hijos, muertes cercanas, migración y trabajo. */
export function milestones(d: Dossier): Milestone[] {
  const rel = new Map(d.family.map((f) => [f.id, f.relation]));
  const born = yearOf(d.identity.birthDate);
  const age = (date: string) => yearOf(date) - born;
  const out: Milestone[] = [];
  for (const e of d.events) {
    const p = e.payload as Record<string, unknown>;
    const who = String(p.citizenId ?? '');
    const r = rel.get(who);
    const name = e.participants.find((x) => x.id === who)?.name;
    const put = (label: string, tone: Milestone['tone'] = 'ink') => out.push({ at: e.at, year: yearOf(e.date), label, tone });
    switch (e.type) {
      case 'CITIZEN_BORN':
        if (who === d.id) put('Nace');
        else if (r === 'hija' || r === 'hijo') put(`Nace ${r === 'hija' ? 'su hija' : 'su hijo'} ${first(name)} · ${age(e.date)}`, 'good');
        break;
      case 'CITIZEN_DIED':
        if (r) put(`Muere su ${r} · ${age(e.date)} años`, 'muted');
        break;
      case 'MIGRATED':
        if (who === d.id) put(`Llega a Data's World · ${age(e.date)}`);
        break;
      case 'STUDIES_COMPLETED':
        if (who === d.id && Number(p.level ?? 0) >= 3) put(`${String(p.levelName ?? 'Estudios')} · ${age(e.date)}`);
        break;
      case 'UNION_FORMED':
      case 'HOUSEHOLD_FORMED':
        if (e.participants.some((x) => x.id === d.id) && !out.some((m) => m.label.startsWith('Forma hogar'))) put(`Forma hogar · ${age(e.date)}`, 'good');
        break;
      case 'JOB_LOST':
        if (who === d.id) put(`Pierde su empleo · ${e.date.slice(0, 10)}`, 'bad');
        break;
      case 'JOB_HIRED':
        if (who === d.id) put(`Entra a ${String(p.orgName ?? 'un trabajo')} · ${e.date.slice(0, 10)}`, 'good');
        break;
      case 'INFORMAL_WORK_STARTED':
        if (who === d.id) put(`Empieza a trabajar por su cuenta · ${age(e.date)}`);
        break;
      case 'RETIRED':
        if (who === d.id) put(`Se pensiona · ${age(e.date)}`);
        break;
      case 'CONDITION_DIAGNOSED':
        if (who === d.id) put(`Diagnóstico · ${age(e.date)}`, 'bad');
        break;
      case 'CHILDHOOD_EVENT':
        if (who === d.id) put(String(p.text ?? 'Infancia').replace(/^./, (c) => c.toUpperCase()), 'muted');
        break;
    }
  }
  return out;
}

const W = 920;
const X0 = 20;
const X1 = 900;
const AXIS = 108;
/** Filas de etiquetas: tres encima de la línea y tres debajo. */
const ROWS = [84, 148, 60, 170, 36, 192];

/** Reparte las etiquetas en filas sin que se solapen (ancho estimado por carácter). */
export function placeLabels(xs: readonly number[], labels: readonly string[]): number[] {
  const ends = ROWS.map(() => -Infinity);
  return xs.map((x, i) => {
    const w = labels[i]!.length * 6.2 + 12;
    const start = Math.max(X0, Math.min(X1 - w, x - w / 2));
    let row = ends.findIndex((e) => e <= start);
    if (row < 0) row = ends.indexOf(Math.min(...ends));
    ends[row] = start + w;
    return row;
  });
}

/** El SVG del curso de vida, de su nacimiento a hoy. `today` es la fecha del mundo. */
export function lifeCourseSvg(d: Dossier, today: string): string {
  const from = yearOf(d.identity.birthDate);
  const to = Math.max(from + 1, yearOf(today) + 1);
  const x = (year: number) => X0 + ((X1 - X0) * (year - from)) / (to - from);
  const ms = milestones(d).sort((a, b) => a.at - b.at);
  const arrived = d.identity.arrived ? yearOf(d.identity.arrived.date) : null;
  const split = arrived !== null ? x(arrived) : X0;
  const bands = (arrived !== null ? `<rect x="${X0}" y="${AXIS - 4}" width="${split - X0}" height="8" class="lc-before"/>` : '')
    + `<rect x="${split}" y="${AXIS - 4}" width="${X1 - split}" height="8" class="lc-here"/>`;
  const places = (arrived !== null ? `<text x="${X0}" y="${AXIS + 22}" class="lc-place">EN ${esc((d.identity.arrived?.from ?? 'otro lugar').toUpperCase())}</text>` : '')
    + `<text x="${X1}" y="${AXIS + 22}" text-anchor="end" class="lc-place">EN DATA'S WORLD</text>`;
  const step = to - from > 60 ? 20 : 10;
  const ticks: string[] = [];
  for (let y = Math.ceil(from / step) * step; y <= to; y += step) ticks.push(`<text x="${x(y)}" y="206" text-anchor="middle" class="lc-year">${y}</text>`);
  const xs = ms.map((m) => x(m.year + 0.5));
  const rows = placeLabels(xs, ms.map((m) => m.label));
  const marks = ms.map((m, i) => {
    const y = ROWS[rows[i]!]!;
    const above = y < AXIS;
    const w = m.label.length * 6.2 + 12;
    const lx = Math.max(X0, Math.min(X1 - w, xs[i]! - w / 2)) + w / 2;
    return `<path class="lc-stem" d="M${xs[i]!.toFixed(1)} ${above ? AXIS - 6 : AXIS + 6} V${above ? y + 4 : y - 12}"/><circle cx="${xs[i]!.toFixed(1)}" cy="${AXIS}" r="4" class="lc-dot ${m.tone}"/><text x="${lx.toFixed(1)}" y="${y}" text-anchor="middle" class="lc-label ${m.tone}">${esc(m.label)}</text>`;
  });
  return `<svg class="lifecourse" viewBox="0 0 ${W} 214" role="img" aria-label="Curso de vida de ${from} a hoy">${bands}${places}${ticks.join('')}${marks.join('')}</svg>`;
}
