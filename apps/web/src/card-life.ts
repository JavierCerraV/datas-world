// Datos de vida que el expediente (spec 024 R-022) carga aparte: la memoria (de `/api/citizens/:id/life`), con su
// pestaña, y el informe de vida (de `/report`). No cambian con cada tick: se cargan una vez por persona.
import { esc, mini } from './card.ts';
import type { LifeView, MemoryView } from './life.ts';
import type { ReportView } from './report.ts';

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
