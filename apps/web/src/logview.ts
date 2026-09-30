// Registro de eventos bajo el mapa (spec 024 R-016): guarda los últimos eventos, los filtra por categoría y menores,
// y pinta como mucho 150, el más reciente arriba, como el prototipo. Un nombre abre la ficha de esa persona.
import { CATEGORIES, logRow, passes } from './log.ts';
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
  const list = document.querySelector<HTMLUListElement>('#events')!;
  const chips = document.querySelector<HTMLElement>('#chips')!;
  const minorBox = document.querySelector<HTMLInputElement>('#show-minor')!;
  let events: EventView[] = [];
  let filter: Category | 'all' = 'all';
  let today = '';
  let dirty = true;
  chips.innerHTML = CATEGORIES.map(([k, l]) => `<button data-f="${k}" aria-pressed="${k === 'all'}">${l}</button>`).join('');

  const render = () => {
    if (!dirty) return;
    dirty = false;
    const shown: string[] = [];
    for (let i = events.length - 1; i >= 0 && shown.length < SHOWN; i--) {
      const e = events[i]!;
      if (passes(e.type, filter, minorBox.checked)) shown.push(logRow(e, today));
    }
    list.innerHTML = shown.join('') || '<li class="empty">Aún no hay eventos de este tipo. Sube la velocidad o avanza un día para que el mundo produzca historia.</li>';
  };
  // Como el prototipo, se repinta como mucho dos veces por segundo.
  setInterval(render, 500);

  chips.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-f]');
    if (!b) return;
    filter = b.dataset.f as Category | 'all';
    for (const x of chips.querySelectorAll('[data-f]')) x.setAttribute('aria-pressed', String(x === b));
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
