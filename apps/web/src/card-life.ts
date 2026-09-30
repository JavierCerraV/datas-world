// Pestañas de la ficha que cargan datos aparte (spec 024 R-017): Memoria y Vida (de `/api/citizens/:id/life`) e
// Historia (de `/report` y de los eventos de la ficha). No cambian con cada tick: se cargan una vez por persona.
import { esc, mini } from './card.ts';
import { money, pct } from './format.ts';
import { renderDevelopment, renderFamily } from './life.ts';
import type { LifeView, MemoryView } from './life.ts';
import { eventText, kindOf, linkNames } from './log.ts';
import { renderReport } from './report.ts';
import type { ReportView } from './report.ts';
import type { CitizenDetail } from './types.ts';
import { whyToggle } from './why.ts';

export type LifeSub = 'informe' | 'desarrollo' | 'familia';
export const LIFE_SUBS: readonly [LifeSub, string][] = [
  ['informe', 'Informe'],
  ['desarrollo', 'Desarrollo'],
  ['familia', 'Familia'],
];

const THEME: Record<string, string> = {
  infancia: 'Infancia', adolescencia: 'Adolescencia', juventud: 'Juventud', vida_adulta: 'Vida adulta', trabajo: 'Trabajo', desempleo: 'Desempleo',
  jubilacion: 'Jubilación', pareja: 'En pareja', ruptura: 'Después de una ruptura', crianza: 'Criando hijos', duelo: 'Duelo', migracion: 'Migración',
};
const tone = (v: number) => (v <= -0.3 ? 'muy difícil' : v < -0.1 ? 'difícil' : v >= 0.3 ? 'muy buena' : v > 0.1 ? 'buena' : 'mezclada');

/** Pestaña Memoria: lo que recuerda (no lo que pasó), del más reciente al más antiguo, con su intensidad. */
export function renderMemories(v: LifeView): string {
  const memories = [...(v.memories ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const chapters = v.chapters ?? [];
  if (!memories.length && !chapters.length) return '<p class="empty">Aún no ha formado recuerdos. Aparecen cuando le pasan cosas.</p>';
  const drift = (m: MemoryView) => (m.valence - m.valence0 <= -0.1 ? ' Lo recuerda peor de lo que lo vivió.' : m.valence - m.valence0 >= 0.1 ? ' Lo recuerda mejor de lo que lo vivió.' : '');
  const items = memories.map((m) => {
    const faded = m.intensity < 0.08;
    return `<li class="${faded ? 'faded' : ''}">${esc(m.text)}<small>${esc(m.date)}, a los ${m.age} años${m.source === 'told' ? ', se lo contaron' : m.source === 'session' ? ', en una charla' : ''}${faded ? ', casi olvidado' : ''}.${drift(m)}${m.rehearsals ? ` Lo ha recordado ${m.rehearsals} ${m.rehearsals === 1 ? 'vez' : 'veces'}.` : ''}</small>${mini('Intensidad', m.intensity, m.valence < -0.1)}</li>`;
  });
  const stages = chapters.map((c) => `<li><b>${esc(THEME[c.theme] ?? c.theme)}</b>, desde los ${c.fromAge} años${c.to ? '' : ' (ahora)'}<small>Etapa ${tone(c.tone)}${c.openedBy ? `. Empezó con: ${esc(c.openedBy)}` : ''}</small></li>`);
  return `<p class="sub" style="margin-top:12px">Lo que recuerda, no lo que pasó. La intensidad baja con el tiempo y sube cada vez que lo vuelve a recordar.</p>`
    + (stages.length ? `<h3>Etapas de su vida, como las cuenta</h3><ul class="list">${stages.join('')}</ul>` : '')
    + `<h3>Recuerdos (${memories.length})</h3><ul class="list">${items.join('') || '<li class="empty">Sin recuerdos todavía.</li>'}</ul>`;
}

/** Pestaña Historia: el resumen del informe de vida (como el prototipo) y la trayectoria con su «¿por qué?». */
export function renderHistory(d: CitizenDetail, r: ReportView | null): string {
  const t = r?.trajectory ?? [];
  const a = t[0];
  const b = t.at(-1);
  const cell = (label: string, value: string) => `<div><span>${esc(label)}</span><b>${value}</b></div>`;
  const current = r?.chapters.at(-1);
  const grid = a && b
    ? `<div class="report">${cell('Dinero', `${money(a.money)} → ${money(b.money)}`)}${cell('Ánimo', `${pct(a.mood)} → ${pct(b.mood)}`)}${cell('Estrés', `${pct(a.stress)} → ${pct(b.stress)}`)}${cell('Etapa actual', current ? `${esc(THEME[current.theme] ?? current.theme)}, ${tone(current.tone)}` : 'sin datos')}${cell('Días observados', String(t.length))}${cell('Hechos que cambiaron su vida', String(r?.turningPoints.length ?? 0))}</div>`
    : '<p class="empty">Aún no hay trayectoria: se guarda un punto por cada día que pasa en el mundo.</p>';
  const names = (id: string) => d.events.flatMap((e) => e.participants).find((p) => p.id === id)?.name ?? null;
  const events = [...d.events].reverse().map((e) => {
    const [label, k] = kindOf(e.type);
    return `<li><time>${esc(e.date)}</time> <span class="kind k-${k}">${esc(label)}</span><span class="txt">${linkNames(eventText(e), (id) => e.names?.[id] ?? names(id))}</span>${whyToggle(e.id)}</li>`;
  });
  return `<h3>Informe de vida${t.length ? ` (${t.length} ${t.length === 1 ? 'día' : 'días'} observados)` : ''}</h3>${grid}<p class="sub">La historia no se borra cuando cambia el estado. Cada hecho guarda sus causas: ábrelas con «¿por qué?». El informe completo está en la pestaña Vida.</p>`
    + `<h3>Trayectoria (últimos hechos)</h3><ul class="list hist">${events.join('') || '<li class="empty">Todavía no le ha pasado nada registrable.</li>'}</ul>`;
}

/** Pestaña Vida con sus subpestañas. */
export function renderLifeTab(sub: LifeSub, life: LifeView | null, report: ReportView | null): string {
  const subtabs = `<div class="subtabs" role="tablist">${LIFE_SUBS.map(([k, l]) => `<button role="tab" data-sub="${k}" aria-selected="${k === sub}">${l}</button>`).join('')}</div>`;
  const body = sub === 'informe'
    ? report ? renderReport(report) : '<p>Cargando el informe…</p>'
    : life ? (sub === 'desarrollo' ? renderDevelopment(life) : renderFamily(life)) : '<p>Cargando su historia…</p>';
  return subtabs + body;
}

/** Los datos de vida e informe de una persona, pedidos una vez y guardados mientras se mira a esa persona. */
export class LifeData {
  #id: string | null = null;
  life: LifeView | null = null;
  report: ReportView | null = null;

  /** Pide lo que falte para `id`; `done` se llama cada vez que llega algo. */
  load(id: string, done: () => void): void {
    if (this.#id === id) return;
    this.#id = id;
    this.life = null;
    this.report = null;
    const get = async <T>(url: string): Promise<T | null> => {
      const r = await fetch(url);
      return r.ok ? ((await r.json()) as T) : null;
    };
    void get<LifeView>(`/api/citizens/${id}/life`).then((v) => {
      if (this.#id !== id) return;
      this.life = v;
      done();
    });
    void get<ReportView>(`/api/citizens/${id}/report`).then((v) => {
      if (this.#id !== id) return;
      this.report = v;
      done();
    });
  }

  /** Olvida lo cargado (al cambiar de persona o al volver a pedir). */
  reset(): void {
    this.#id = null;
  }
}
