// Pestañas del expediente de vida (spec 024 R-022), primera parte: Resumen, Estado y necesidades, Emociones e
// Historia. Formateo puro a partir de la ficha (022), el expediente (022 R-015) y el informe de vida (020).
import { CRITICAL, dec, esc, meter } from './card-compact.ts';
import type { Dossier } from './dossier-types.ts';
import { ACTIVITY_ES, EMO_ES, NEED_ES, causeEs } from './format.ts';
import { lifeCourseSvg } from './lifecourse.ts';
import { kindOf, linkNames } from './log.ts';
import { renderReport } from './report.ts';
import type { ReportView } from './report.ts';
import { skeleton } from './loading.ts';
import type { CitizenDetail } from './types.ts';
import { whyToggle } from './why.ts';

export interface ExpData {
  d: CitizenDetail;
  dos: Dossier;
  report: ReportView | null;
  /** Fecha del mundo (`2026-01-07 10:15`). */
  today: string;
  /** Lo que hace ahora, con el lugar. */
  doing: string;
}

export const card = (title: string, body: string, extra = '') => `<section class="card"${extra}><h2>${title}</h2>${body}</section>`;
export const kv = (rows: [string, string][]) => `<dl class="kv2">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
export const table = (head: string[], rows: string[][], empty = 'Sin datos.') =>
  rows.length ? `<table class="dtable"><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` : `<p class="empty">${esc(empty)}</p>`;
const name1 = (d: CitizenDetail) => d.name.split(' ')[0]!;
const TENURE: Record<string, string> = { propia: 'vivienda propia', pagando: 'la están pagando', arriendo: 'en arriendo', usufructo: 'en usufructo' };

/** Texto de un evento con los nombres pulsables. */
export const evText = (e: Dossier['events'][number]) =>
  linkNames(e.text ?? e.type, (id) => e.names?.[id] ?? e.participants.find((p) => p.id === id)?.name ?? null);

/** «Por qué está donde está»: los hechos que lo explican, con sus causas, y su rutina de ahora. */
export function whyList(x: ExpData): string {
  const items = x.dos.why.map((e) => `<li><span class="mono">${esc(e.date.slice(0, 10))}</span> ${evText(e)}<small>causas: ${esc(e.causes.map(causeEs).join(' · ') || 'sin registrar')}</small></li>`);
  items.push(`<li>Ahora: ${esc(x.doing || (ACTIVITY_ES[x.d.activity] ?? x.d.activity) + (x.d.place ? ` en ${x.d.place.name}` : ''))}${x.dos.until ? ` hasta las ${esc(x.dos.until.slice(11, 16))}` : ''}<small>causa: su rutina del día (011)</small></li>`);
  return `<ul class="whylist">${items.join('')}</ul>`;
}

export function tabResumen(x: ExpData): string {
  const i = x.dos.identity;
  const occ = x.d.occupation;
  const job = occ?.kind === 'formal' ? `Formal · ${esc(String(occ.orgName ?? ''))}${occ.positionId ? ` · <span class="mono">${esc(String(occ.positionId).split('/').at(-1) ?? '')}</span>` : ''}` : esc(occ?.kind === 'none' ? String(occ.reason ?? '') : String(occ?.kind ?? 'sin datos'));
  const ident = kv([
    ['Nacimiento', `<span class="mono">${esc(i.birthDate)}</span>${i.birthplace ? `, ${esc(i.birthplace)}` : ''}`],
    ['Llegó al mundo', i.arrived ? `<span class="mono">${esc(i.arrived.date)}</span>${i.arrived.reason ? ` (${esc(i.arrived.reason)})` : ''}` : 'nació aquí'],
    ['Estudios', esc(i.education ?? 'sin datos')],
    ['Ocupación', job],
    ['Salud', esc(x.dos.health.insurance?.regime ?? 'sin datos')],
    ['Hogar', i.household ? `<span class="mono">${esc(i.household.id)}</span> · ${i.household.members} ${i.household.members === 1 ? 'persona' : 'personas'}${i.household.tenure ? `, ${esc(TENURE[i.household.tenure] ?? i.household.tenure)}` : ''}` : 'sin datos'],
  ]);
  const c = x.dos.counts;
  const counts = `<div class="counters">${[['Eventos registrados', c.events], ['Estímulos con función', c.functions], ['Reglas verbales', c.rules], ['Charlas', c.chats]].map(([l, n]) => `<div><span>${l}</span><b class="mono">${n}</b></div>`).join('')}</div>`;
  return `<div class="grid-2-1"><div class="col">${card('Identidad', ident)}${card('Por qué está donde está', whyList(x))}</div>`
    + `${card('Curso de vida <span class="h-note">historia de origen (030) y simulación</span>', `${lifeCourseSvg(x.dos, x.today)}${counts}`)}</div>`;
}

const AG_LABEL: Record<string, string> = { dormir: 'Dormir', desplazamiento: 'Desplazamiento', trabajo: 'Trabajo (no flexible)', estudio: 'Estudio (no flexible)', obligacion: 'Obligaciones', cuidado: 'Comer y asearse', libre: 'Tiempo libre (flexible)' };
const hh = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** La agenda de hoy en una franja de 24 h con la marca de «ahora» y su leyenda. */
export function agendaSvg(a: Dossier['agenda']): string {
  const W = 560;
  const x = (m: number) => 10 + ((W - 20) * m) / 1440;
  const blocks = a.blocks.map((b) => `<rect class="ag-${b.kind}" x="${x(b.from).toFixed(1)}" y="18" width="${(x(b.to) - x(b.from)).toFixed(1)}" height="26"><title>${hh(b.from)}–${hh(b.to)} · ${esc(ACTIVITY_ES[b.activity] ?? b.activity)}</title></rect>`).join('');
  const ticks = [0, 6, 12, 18, 24].map((h) => `<text x="${x(h * 60)}" y="60" text-anchor="middle" class="ag-tick">${String(h).padStart(2, '0')}</text>`).join('');
  const now = `<path class="ag-now" d="M${x(a.now).toFixed(1)} 10 V50"/><text x="${x(a.now).toFixed(1)}" y="8" text-anchor="middle" class="ag-tick">ahora</text>`;
  const kinds = [...new Set(a.blocks.map((b) => b.kind))];
  return `<svg class="agenda" viewBox="0 0 ${W} 64" role="img" aria-label="Agenda de hoy">${blocks}${ticks}${now}</svg><p class="legend">${kinds.map((k) => `<span><i class="ag-${k}"></i>${AG_LABEL[k]}</span>`).join('')}</p>`;
}

export function tabEstado(x: ExpData): string {
  const d = x.d;
  const needs = NEED_ES_ORDER.filter((k) => d.needs[k] !== undefined).map((k) => meter(NEED_ES[k] ?? k, d.needs[k]!, d.needs[k]! < CRITICAL ? 'bad' : 'ink')).join('');
  const crit = NEED_ES_ORDER.filter((k) => (d.needs[k] ?? 1) < CRITICAL);
  const critNote = crit.length ? `<p class="warn-line">Crítica (&lt; ${dec(CRITICAL, 1)}): ${esc(crit.map((k) => (NEED_ES[k] ?? k).toLowerCase()).join(', '))}. Es operación motivadora: entra con peso alto en su próxima decisión (040 R-007).</p>` : '';
  const a = x.dos.agenda;
  const place = kv([
    ['Lugar', d.moving ? 'en camino' : d.place ? `${esc(d.place.name)} <span class="mono">(${esc(d.place.id)})</span>` : 'fuera del pueblo'],
    ['Se mueve', d.moving ? 'Sí' : 'No'],
    ['Próximo libre', a.free ? `desde las <span class="mono">${a.free.from}</span> hasta las <span class="mono">${a.free.to}</span>` : 'hoy ya no tiene tiempo libre'],
  ]);
  return `<div class="grid-2">${card('Estado general', `${meter('Ánimo', d.state.mood, 'ok')}${meter('Estrés', d.state.stress, 'bad')}<h3>Necesidades <span class="h-note">(1 = satisfecha)</span></h3>${needs}${critNote}`)}`
    + `${card('Agenda de hoy <span class="h-note">rutina prevista</span>', `${agendaSvg(a)}${place}`)}</div>`;
}
const NEED_ES_ORDER = ['energy', 'fun', 'hunger', 'hygiene', 'social'];

export function tabEmociones(x: ExpData): string {
  const e = x.d.emotions;
  const bars = Object.keys(EMO_ES).filter((k) => e[k] !== undefined).map((k) => meter(EMO_ES[k]!, e[k]!, k === 'joy' ? 'ok' : 'bad')).join('');
  const active = Object.values(e).some((v) => v >= 0.05);
  // Los hechos recientes que suelen disparar emociones (010), para ver su origen.
  const TRIGGERS = new Set(['JOB_LOST', 'JOB_HIRED', 'ARGUMENT', 'BREAKUP', 'CONFRONTATION', 'FELL_ILL', 'CONVERSATION_HELD', 'CHAT_CLAIM_BELIEVED', 'RUMOR_TOLD', 'PNR_EPISODE', 'FRIENDSHIP_FORMED', 'STRESS_PEAK']);
  const recent = x.dos.events.filter((ev) => !ev.origin && TRIGGERS.has(ev.type)).slice(-6).reverse();
  const origin = recent.length ? `<h3>Hechos recientes que pueden haberlas disparado</h3><ul class="whylist">${recent.map((ev) => `<li><span class="mono">${esc(ev.date)}</span> ${evText(ev)}</li>`).join('')}</ul>` : '';
  const note = active ? '' : '<p class="empty">Ninguna emoción activa. Las emociones se disparan con eventos (un despido, una discusión, una charla hostil) y decaen en horas (spec 010).</p>';
  return card('Emociones activas', `${bars}${note}${origin}`);
}

export type HistFilter = 'todos' | 'origen' | 'simulacion';
export function tabHistoria(x: ExpData, filter: HistFilter, limit = Number.POSITIVE_INFINITY): string {
  const all = x.dos.events;
  const shown = all.filter((e) => filter === 'todos' || (filter === 'origen') === e.origin);
  const btn = (k: HistFilter, l: string) => `<button type="button" data-hist="${k}" aria-pressed="${k === filter}">${l}</button>`;
  // R-026: se pintan los más recientes primero, por páginas, para que la pestaña responda al instante.
  const page = [...shown].reverse().slice(0, limit);
  const more = shown.length > page.length ? `<p class="more-row"><button class="btn" type="button" data-hist-more>Ver más (${shown.length - page.length} anteriores)</button></p>` : '';
  const rows = page.map((e) => {
    const [label, tone] = kindOf(e.type);
    return [`<span class="mono">${esc(e.origin ? e.date.slice(0, 10) : e.date)}</span>`, `<span class="kind k-${tone}">${esc(label)}</span><span class="code mono">${esc(e.type)}</span>`, evText(e), `<span class="causes">${esc(e.causes.map(causeEs).join(' · ') || '—')}</span>`, whyToggle(e.id)];
  });
  const head = `<div class="card-head"><h2>Eventos <span class="h-note">${all.length} · del más reciente al más antiguo</span></h2><div class="seg" role="group" aria-label="Filtro de eventos">${btn('todos', 'Todos')}${btn('origen', 'Historia de origen')}${btn('simulacion', 'Simulación')}</div></div>`;
  const report = x.report ? `<details class="card"><summary><h2>Informe de vida de ${esc(name1(x.d))}</h2></summary>${renderReport(x.report)}</details>` : `<section class="card" style="margin-top:16px">${skeleton('el informe de vida', 3)}</section>`;
  return `<section class="card">${head}${table(['Fecha', 'Tipo', 'Descripción', 'Causas', ''], rows, 'Sin eventos de este tipo.')}${more}</section>${report}`;
}
