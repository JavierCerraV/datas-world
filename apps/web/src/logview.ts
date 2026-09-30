// Registro de eventos bajo el mapa (spec 024 R-016 y R-021): guarda los últimos eventos, los filtra por categoría y
// menores, y pinta como mucho 150 en una tabla (hora, tipo, qué pasó y causas), el más reciente arriba. Un nombre
// abre la ficha de esa persona.
import { CATEGORIES, logTableRow, passes } from './log.ts';
import type { Category } from './log.ts';
import type { EventView } from './types.ts';

const KEEP = 600;
const SHOWN = 150;

export interface LogView {
  add: (events: readonly EventView[]) => void;
  /** Día de hoy (`2026-01-05`), para mostrar solo la hora de los eventos de hoy. */
  setToday: (iso: string) => void;
}

export function setupLog(o: { openPerson: (id: string) => void }): LogView {
  const list = document.querySelector<HTMLElement>('#events')!;
  const chips = document.querySelector<HTMLSelectElement>('#log-filter')!;
  const sub = document.querySelector<HTMLElement>('#log-sub')!;
  const minorBox = document.querySelector<HTMLInputElement>('#show-minor')!;
  let events: EventView[] = [];
  let filter: Category | 'all' = 'all';
  let today = '';
  let dirty = true;
  chips.innerHTML = CATEGORIES.map(([k, l]) => `<option value="${k}">${k === 'all' ? 'todos los tipos' : l}</option>`).join('');

  const render = () => {
    if (!dirty) return;
    dirty = false;
    const shown: string[] = [];
    for (let i = events.length - 1; i >= 0 && shown.length < SHOWN; i--) {
      const e = events[i]!;
      if (passes(e.type, filter, minorBox.checked)) shown.push(logTableRow(e, today));
    }
    list.innerHTML = shown.join('') || '<tr><td colspan="4" class="empty">Aún no hay eventos de este tipo. Sube la velocidad o avanza un día para que el mundo produzca historia.</td></tr>';
    const todayN = events.filter((e) => e.date.startsWith(today)).length;
    sub.textContent = `en vivo · ${todayN} ${todayN === 1 ? 'evento' : 'eventos'} hoy en el registro`;
  };
  // Como el prototipo, se repinta como mucho dos veces por segundo.
  setInterval(render, 500);

  chips.addEventListener('change', () => {
    filter = chips.value as Category | 'all';
    dirty = true;
    render();
  });
  minorBox.addEventListener('change', () => {
    dirty = true;
    render();
  });
  list.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-person]');
    if (b) o.openPerson(b.dataset.person!);
  });
  return {
    add: (xs) => {
      if (!xs.length) return;
      const seen = new Set(events.map((e) => e.id));
      events = [...events, ...xs.filter((e) => !seen.has(e.id))].sort((a, b) => (a.id < b.id ? -1 : 1)).slice(-KEEP);
      dirty = true;
    },
    setToday: (iso) => {
      if (iso === today) return;
      today = iso;
      dirty = true;
    },
  };
}
