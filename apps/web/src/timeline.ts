// Línea temporal (spec 024 R-010): un deslizador por los días con instantánea (022 R-009) para mirar el mundo tal como
// estaba. En el pasado, el mapa y la ficha leen ese día y se ve un aviso; el mundo sigue corriendo y un botón vuelve
// al presente. La lógica es pura y se prueba; el cableado del DOM está al final.

export interface DayInfo {
  day: number;
  date: string;
}

/** De dónde leer: el presente o un día pasado. */
export type Moment = { mode: 'live' } | { mode: 'past'; day: number; date: string };

/** CA-007: las rutas que pide el visor en cada momento. */
export function urlsFor(m: Moment): { citizens: string; citizen: (id: string) => string } {
  if (m.mode === 'live') return { citizens: '/api/citizens', citizen: (id) => `/api/citizens/${id}` };
  return { citizens: `/api/days/${m.day}/citizens`, citizen: (id) => `/api/days/${m.day}/citizens/${id}` };
}

/** El momento que corresponde a la posición del deslizador: la última es el presente. */
export function momentAt(days: readonly DayInfo[], index: number): Moment {
  if (index >= days.length - 1 || index < 0) return { mode: 'live' };
  const d = days[index]!;
  return { mode: 'past', day: d.day, date: d.date };
}

/** CA-007: el aviso visible del momento (vacío en el presente). */
export const banner = (m: Moment): string => (m.mode === 'past' ? `Mirando el pasado: ${m.date}. El mundo sigue corriendo.` : '');

/**
 * Cablea `#tl` (deslizador), `#tl-live` (volver al presente) y `#tl-banner`. Llama a `onChange` al cambiar de momento.
 * `refresh` vuelve a leer los días disponibles (se añade uno por día de mundo).
 */
export function setupTimeline(o: { fetchDays: () => Promise<{ days: DayInfo[] }>; onChange: (m: Moment) => void }) {
  const slider = document.querySelector<HTMLInputElement>('#tl')!;
  const live = document.querySelector<HTMLButtonElement>('#tl-live')!;
  const note = document.querySelector<HTMLElement>('#tl-banner')!;
  let days: DayInfo[] = [];
  let moment: Moment = { mode: 'live' };
  const show = (m: Moment) => {
    moment = m;
    note.textContent = banner(m);
    note.hidden = m.mode === 'live';
    live.disabled = m.mode === 'live';
    o.onChange(m);
  };
  const refresh = async () => {
    days = [...(await o.fetchDays()).days, { day: Number.POSITIVE_INFINITY, date: 'hoy' }];
    const atEnd = moment.mode === 'live';
    slider.max = String(days.length - 1);
    if (atEnd) slider.value = slider.max;
    slider.title = moment.mode === 'past' ? moment.date : 'Hoy';
  };
  slider.addEventListener('input', () => {
    const m = momentAt(days, Number(slider.value));
    slider.title = m.mode === 'past' ? m.date : 'Hoy';
    show(m);
  });
  live.addEventListener('click', () => {
    slider.value = slider.max;
    show({ mode: 'live' });
  });
  return { refresh, moment: () => moment };
}
