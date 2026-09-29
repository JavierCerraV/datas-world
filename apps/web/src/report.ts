// Sección «Informe» de la pestaña Vida (spec 020 R-007): la gráfica del ánimo y el estrés, las etapas vividas y
// recordadas lado a lado, sus diferencias, lo que cambió su vida con su «¿por qué?» y el perfil que sale de su
// historia. Solo lee `/api/citizens/:id/report`.
import { renderWhy } from './why.ts';
import type { WhyNode } from './why.ts';

interface Fact { id: string; date: string; text: string }
export interface ReportView {
  chapters: { theme: string; from: number; to?: number; tone: number; date: string; opened: Fact | null }[];
  remembered: { id: string; theme: string; from: number; to?: number; tone: number; date: string }[];
  divergences: { chapter: number; kind: string; note: string }[];
  turningPoints: { event: string; consequences: number; moodDelta?: number; moneyDelta?: number; why: WhyNode; fact: Fact }[];
  profile: { values: Record<string, number | null>; basis: Record<string, string[]> };
  trajectory: { day: number; mood: number; stress: number; money: number }[];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const THEME: Record<string, string> = {
  infancia: 'Infancia', adolescencia: 'Adolescencia', juventud: 'Juventud', vida_adulta: 'Vida adulta', trabajo: 'Trabajo', desempleo: 'Desempleo',
  jubilacion: 'Jubilación', pareja: 'En pareja', ruptura: 'Después de una ruptura', crianza: 'Criando hijos', duelo: 'Duelo', migracion: 'Migración',
};
const PROFILE: Record<string, string> = {
  jobStability: 'Estabilidad laboral', relationshipStability: 'Estabilidad en sus relaciones', socialNetwork: 'Red social',
  stressorExposure: 'Golpes del último año', economicTrajectory: 'Rumbo económico', resilience: 'Resiliencia',
};
const tone = (x: number) => (x <= -0.3 ? 'muy difícil' : x < -0.1 ? 'difícil' : x >= 0.3 ? 'muy buena' : x > 0.1 ? 'buena' : 'mezclada');
const cls = (x: number) => (x > 0.1 ? 'pos' : x < -0.1 ? 'neg' : '');

/** Gráfica del ánimo (verde) y el estrés (rojo) por día, en SVG. */
export function trajectorySvg(t: ReportView['trajectory']): string {
  if (t.length < 2) return '<p class="muted">Aún no hay trayectoria (se guarda un punto por día de vida en el mundo).</p>';
  const W = 460;
  const H = 110;
  const d0 = t[0]!.day;
  const span = Math.max(1, t.at(-1)!.day - d0);
  const line = (k: 'mood' | 'stress') => t.map((p) => `${Math.round(((p.day - d0) / span) * W)},${Math.round(H - p[k] * H)}`).join(' ');
  return `<svg class="traj" viewBox="-4 -4 ${W + 8} ${H + 8}" role="img" aria-label="Ánimo y estrés por día"><rect x="0" y="0" width="${W}" height="${H}" class="traj-bg"/><polyline class="traj-mood" points="${line('mood')}"/><polyline class="traj-stress" points="${line('stress')}"/></svg><p class="g-legend"><span class="sw cercana"></span>ánimo <span class="sw conflictiva"></span>estrés · ${t.length} días</p>`;
}

export function renderReport(r: ReportView): string {
  const overlap = (c: ReportView['chapters'][number]) =>
    r.remembered.find((m) => Math.min(c.to ?? Infinity, m.to ?? Infinity) > Math.max(c.from, m.from));
  const rows = r.chapters.map((c) => {
    const m = overlap(c);
    return `<tr><td class="mono">${esc(c.date)}</td><td class="${cls(c.tone)}">${esc(THEME[c.theme] ?? c.theme)} · ${tone(c.tone)}${c.opened ? `<small>${esc(c.opened.text)}</small>` : ''}</td><td class="${m ? cls(m.tone) : ''}">${m ? `${esc(THEME[m.theme] ?? m.theme)} · ${tone(m.tone)}` : '<span class="muted">no la cuenta</span>'}</td></tr>`;
  });
  const divs = r.divergences.map((d) => `<li>${d.chapter >= 0 ? `<span class="mono">${d.chapter + 1}.</span> ` : ''}${esc(d.note)}</li>`);
  const points = r.turningPoints.map((t) => {
    const extra = [`${t.consequences} consecuencias`, ...(t.moodDelta !== undefined ? [`ánimo ${t.moodDelta > 0 ? '+' : ''}${Math.round(t.moodDelta * 100)} en 30 días`] : [])];
    return `<li><span class="mono">${esc(t.fact.date)}</span> ${esc(t.fact.text)} <span class="muted">(${extra.join(', ')})</span><details class="why-box"><summary>¿por qué?</summary>${renderWhy(t.why)}</details></li>`;
  });
  const profile = Object.entries(PROFILE).map(([k, label]) => {
    const v = r.profile.values[k];
    const n = r.profile.basis[k]?.length ?? 0;
    return `<tr><td>${label}</td><td>${v === null || v === undefined ? '<span class="muted">sin datos</span>' : `<meter min="0" max="1" value="${v}"></meter> ${Math.round(v * 100)} %`}</td><td class="muted">${n ? `${n} hechos` : ''}</td></tr>`;
  });
  return `<h3>Informe de vida</h3>${trajectorySvg(r.trajectory)}`
    + `<h4>Etapas: lo que pasó · cómo lo recuerda</h4><table class="report"><tbody>${rows.join('')}</tbody></table>`
    + `<h4>Diferencias entre lo vivido y lo recordado</h4>${divs.length ? `<ul>${divs.join('')}</ul>` : '<p class="muted">Ninguna.</p>'}`
    + `<h4>Lo que cambió su vida</h4><ol class="life">${points.join('')}</ol>`
    + `<h4>Perfil que sale de su historia</h4><table class="report"><tbody>${profile.join('')}</tbody></table>`;
}

/** Carga el informe en `el` (se llama al abrir la pestaña Vida). */
export async function showReport(el: HTMLElement, id: string): Promise<void> {
  const r = await fetch(`/api/citizens/${id}/report`);
  el.innerHTML = r.ok ? renderReport((await r.json()) as ReportView) : '';
}
