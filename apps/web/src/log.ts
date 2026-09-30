// Registro de eventos bajo el mapa (spec 024 R-016), como el prototipo: filtros por categoría, «Incluir menores»,
// una etiqueta con la clase de cada evento (buena, mala, aviso o información, siempre con texto), el texto con los
// nombres pulsables y su «Por qué». Formateo puro.
import { stanceLabel } from './chat.ts';
import { causeEs } from './format.ts';
import type { EventView } from './types.ts';

export type Category = 'trabajo' | 'relaciones' | 'economia' | 'salud' | 'info';
export type Tone = 'good' | 'bad' | 'warn' | 'info';

export const CATEGORIES: readonly [Category | 'all', string][] = [
  ['all', 'Todos'],
  ['trabajo', 'Trabajo'],
  ['relaciones', 'Relaciones'],
  ['economia', 'Economía'],
  ['salud', 'Salud'],
  ['info', 'Información'],
];

/** Por tipo: etiqueta, clase y categoría. Los que no están aquí son de información. */
const KINDS: Record<string, [string, Tone, Category]> = {
  JOB_HIRED: ['Empleo nuevo', 'good', 'trabajo'],
  INFORMAL_WORK_STARTED: ['Trabajo informal', 'good', 'trabajo'],
  JOB_WARNING: ['Advertencia', 'warn', 'trabajo'],
  JOB_LOST: ['Despido', 'bad', 'trabajo'],
  RETIRED: ['Pensión', 'info', 'trabajo'],
  ARRIVED_LATE: ['Llegada tarde', 'warn', 'trabajo'],
  OVERSLEPT: ['Se durmió', 'warn', 'trabajo'],
  STUDIES_COMPLETED: ['Estudios', 'good', 'trabajo'],
  MET: ['Se conocen', 'info', 'relaciones'],
  ENCOUNTER: ['Roce', 'warn', 'relaciones'],
  ARGUMENT: ['Discusión', 'bad', 'relaciones'],
  FRIENDSHIP_FORMED: ['Amistad', 'good', 'relaciones'],
  RELATIONSHIP_STARTED: ['Nueva pareja', 'good', 'relaciones'],
  BREAKUP: ['Ruptura', 'bad', 'relaciones'],
  BOND_FORGOTTEN: ['Pierden contacto', 'info', 'relaciones'],
  UNION_FORMED: ['Pareja', 'good', 'relaciones'],
  HOUSEHOLD_FORMED: ['Hogar nuevo', 'good', 'relaciones'],
  CITIZEN_BORN: ['Nacimiento', 'good', 'relaciones'],
  CONVERSATION_STARTED: ['Charla', 'info', 'relaciones'],
  CONVERSATION_HELD: ['Charla', 'info', 'relaciones'],
  CONVERSATION_DECLINED: ['Charla rechazada', 'warn', 'relaciones'],
  SALARY_PAID: ['Salario', 'good', 'economia'],
  RENT_PAID: ['Arriendo', 'info', 'economia'],
  RENT_LATE: ['Arriendo atrasado', 'bad', 'economia'],
  DEBT_TAKEN: ['Préstamo', 'warn', 'economia'],
  DEBT_REPAID: ['Deuda pagada', 'good', 'economia'],
  PAYMENT_MISSED: ['Cuota sin pagar', 'bad', 'economia'],
  OBJECT_ACQUIRED: ['Compra', 'info', 'economia'],
  OBJECT_GIFTED: ['Regalo', 'good', 'economia'],
  OBJECT_SOLD: ['Venta', 'info', 'economia'],
  OBJECT_LOST: ['Pérdida', 'warn', 'economia'],
  FELL_ILL: ['Enfermedad', 'bad', 'salud'],
  RECOVERED: ['Recuperación', 'good', 'salud'],
  STRESS_PEAK: ['Pico de estrés', 'warn', 'salud'],
  PNR_EPISODE: ['Rumiación', 'warn', 'salud'],
  CONDITION_DIAGNOSED: ['Diagnóstico', 'warn', 'salud'],
  CITIZEN_DIED: ['Fallecimiento', 'bad', 'salud'],
  RUMOR_TOLD: ['Rumor', 'info', 'info'],
  RUMOR_DISTORTED: ['Rumor deformado', 'warn', 'info'],
  BELIEF_CORRECTED: ['Corrige lo que creía', 'good', 'info'],
  LEARNED_FROM_CONVERSATION: ['Aprendió', 'info', 'info'],
  SCHEMA_FORMED: ['Aprendió de su vida', 'info', 'info'],
  SCHEMA_REVISED: ['Revisó lo aprendido', 'info', 'info'],
  CHAPTER_OPENED: ['Nueva etapa', 'info', 'info'],
  CHAPTER_CLOSED: ['Cierra una etapa', 'info', 'info'],
  TRIP_TAKEN: ['Viaje', 'info', 'info'],
};

/** Menores: rutina y ruido del sistema; solo con «Incluir menores» (como el prototipo). */
const MINOR = new Set([
  'LEISURE_DONE', 'DAY_STARTED', 'TRIP_TAKEN', 'SPEED_CHANGED', 'WORLD_PAUSED', 'WORLD_RESUMED', 'WORLD_CLOSED', 'WORLD_CREATED',
  'EXTERNAL_INPUT_APPLIED', 'CAPABILITY_ENABLED', 'MET', 'BOND_FORGOTTEN', 'SALARY_PAID', 'RENT_PAID', 'PAYMENT_MISSED', 'OVERSLEPT',
  'SCHEMA_FORMED', 'SCHEMA_REVISED', 'CONVERSATION_STARTED',
]);

export const isMinor = (type: string): boolean => MINOR.has(type);
export const kindOf = (type: string): [string, Tone, Category] => KINDS[type] ?? [type.toLowerCase().replace(/_/g, ' '), 'info', 'info'];

/** CA-011: si un evento pasa el filtro de categoría y de menores. */
export function passes(type: string, filter: Category | 'all', minor: boolean): boolean {
  if (!minor && isMinor(type)) return false;
  return filter === 'all' || kindOf(type)[2] === filter;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** El texto con cada persona como un botón con su nombre (`data-person`). */
export function linkNames(text: string, names: (id: string) => string | null): string {
  return esc(text).replace(/CIT-\d+/g, (id) => {
    const n = names(id);
    return n ? `<button class="who" data-person="${id}">${esc(n)}</button>` : 'alguien';
  });
}

/** La hora (y la fecha si no es hoy) del evento, como en el prototipo. */
export function stamp(date: string, today: string): string {
  const [d, t] = date.split(' ');
  return d === today ? (t ?? date) : `${d!.slice(8, 10)}/${d!.slice(5, 7)} ${t ?? ''}`;
}

/** El texto del evento con las posturas de un encuentro en palabras («poner limite» → «poner un límite»). */
export function eventText(e: EventView): string {
  let text = e.text ?? e.type;
  for (const k of ['stanceA', 'stanceB']) {
    const s = e.payload[k];
    if (typeof s === 'string') text = text.replace(s.replace(/_/g, ' '), stanceLabel(s));
  }
  return text;
}

/** Una fila del registro: hora, etiqueta, texto con nombres y «Por qué». */
export function logRow(e: EventView, today: string, withKind = true): string {
  const [label, tone] = kindOf(e.type);
  const names = (id: string) => e.names?.[id] ?? e.participants.find((p) => p.id === id)?.name ?? null;
  const text = eventText(e);
  const why = [...new Set(e.causes.slice(0, 4).map(causeEs))];
  return `<li><time>${esc(stamp(e.date, today))}</time>${withKind ? `<span class="kind k-${tone}">${esc(label)}</span>` : ''}<span class="txt">${linkNames(text, names)}${why.length ? `<span class="why">Por qué: ${esc(why.join('; '))}</span>` : ''}</span></li>`;
}
