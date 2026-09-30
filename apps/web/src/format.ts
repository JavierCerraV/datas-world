// Formateo en español de actividades, estímulos, causas y eventos (spec 024). Funciones puras.
import type { Cause, EventView } from './types.ts';

export const ACTIVITY_ES: Record<string, string> = {
  idle: 'descansando',
  sleep: 'durmiendo',
  eat: 'comiendo',
  work: 'trabajando',
  study: 'estudiando',
  commute: 'en camino',
  leisure: 'en su tiempo libre',
  socialize: 'con otras personas',
  chores: 'haciendo oficios',
  shop: 'comprando',
  exercise: 'haciendo ejercicio',
  care: 'cuidando',
  job_search: 'buscando empleo',
  errands: 'haciendo diligencias',
  sick: 'enfermo/a',
  wash: 'arreglándose',
};

export const EVENT_ES: Record<string, string> = {
  WORLD_CREATED: 'Se creó el mundo',
  DAY_STARTED: 'Empieza el día',
  EXTERNAL_INPUT_APPLIED: 'Orden externa aplicada',
  SPEED_CHANGED: 'Cambio de velocidad',
  WORLD_PAUSED: 'Mundo en pausa',
  WORLD_RESUMED: 'Mundo reanudado',
  WORLD_CLOSED: 'Mundo cerrado',
  HOUSEHOLD_FORMED: 'Se formó un hogar',
  STUDIES_COMPLETED: 'Terminó sus estudios',
  CHILDHOOD_EVENT: 'Hecho de infancia',
  JOB_HIRED: 'Consiguió empleo',
  INFORMAL_WORK_STARTED: 'Empezó un trabajo informal',
  JOB_WARNING: 'Recibió una advertencia en el trabajo',
  JOB_LOST: 'Perdió el empleo',
  RETIRED: 'Se pensionó',
  OBJECT_ACQUIRED: 'Adquirió un objeto',
  OBJECT_GIFTED: 'Regaló un objeto',
  OBJECT_SOLD: 'Vendió un objeto',
  OBJECT_LOST: 'Perdió un objeto',
  OBJECT_INHERITED: 'Heredó un objeto',
  FELL_ILL: 'Se enfermó',
  RECOVERED: 'Se recuperó',
  OVERSLEPT: 'Se quedó dormido/a',
  SALARY_PAID: 'Recibió su salario',
  RENT_PAID: 'Se pagó el arriendo',
  RENT_LATE: 'Se atrasó el arriendo',
  DEBT_TAKEN: 'Tomó un préstamo',
  DEBT_REPAID: 'Pagó una deuda',
  PAYMENT_MISSED: 'No pudo pagar una cuota',
  ARRIVED_LATE: 'Llegó tarde',
  TRIP_TAKEN: 'Hizo un viaje',
  STRESS_PEAK: 'Pico de estrés',
  HEALTH_INSURANCE_SET: 'Afiliación a salud',
  CONDITION_DIAGNOSED: 'Le diagnosticaron una condición',
  LEISURE_DONE: 'Tiempo libre',
  LEISURE_TAKEN_UP: 'Empezó una afición',
  TOWN_FOUNDED: 'Fundación del pueblo',
  DISTRICT_FOUNDED: 'Fundación de un barrio',
  PLACE_BUILT: 'Se construyó un lugar',
  ORG_FOUNDED: 'Se fundó una organización',
  CITIZEN_BORN: 'Nació',
  UNION_FORMED: 'Formó pareja',
  MIGRATED: 'Migró',
  CITIZEN_DIED: 'Murió',
  HISTORICAL_CONTEXT: 'Contexto histórico',
  CAPABILITY_ENABLED: 'Nueva capacidad del mundo',
  MET: 'Conoció a alguien',
  ENCOUNTER: 'Tuvo un roce',
  ARGUMENT: 'Discutió',
  FRIENDSHIP_FORMED: 'Hizo una amistad',
  RELATIONSHIP_STARTED: 'Empezó una relación de pareja',
  BREAKUP: 'Terminó una relación',
  BOND_FORGOTTEN: 'Perdió el contacto',
  RUMOR_TOLD: 'Contó un rumor',
  RUMOR_DISTORTED: 'Rumor deformado',
  BELIEF_CORRECTED: 'Corrigió lo que creía',
  SCHEMA_FORMED: 'Aprendió de su vida',
  SCHEMA_REVISED: 'Revisó lo aprendido',
  CHAPTER_OPENED: 'Empezó una etapa',
  CHAPTER_CLOSED: 'Cerró una etapa',
  PNR_EPISODE: 'Rumiación',
  CONVERSATION_STARTED: 'Empezó una charla',
  CONVERSATION_HELD: 'Tuvo una charla',
  CONVERSATION_DECLINED: 'No pudo charlar',
  LEARNED_FROM_CONVERSATION: 'Aprendió de una charla',
};


export const NEED_ES: Record<string, string> = { hunger: 'Alimentación', energy: 'Energía', social: 'Compañía', fun: 'Diversión', hygiene: 'Higiene', safety: 'Seguridad', health: 'Salud' };
export const EMO_ES: Record<string, string> = { joy: 'Alegría', sadness: 'Tristeza', anger: 'Enojo', fear: 'Miedo', shame: 'Vergüenza' };
export const KIND_ES: Record<string, string> = { pliance: 'la obedece (pliance)', tracking: 'le funciona (tracking)', augmenting: 'le da sentido (augmenting)' };
export const TYPE_ES: Record<string, string> = {
  coordination: 'es como',
  distinction: 'es distinto de',
  opposition: 'es lo opuesto de',
  more: 'es más que',
  less: 'es menos que',
  contains: 'contiene',
  part_of: 'es parte de',
  causes: 'lleva a',
  caused_by: 'viene de',
  before: 'va antes de',
  after: 'va después de',
  deictic: 'desde la perspectiva de',
};

export const pct = (x: number): string => `${Math.round(x * 100)} %`;
export const money = (x: number): string => `$${Math.round(x).toLocaleString('es-CO')}`;

/** Estímulo legible: `verbal.llegar_tarde` → "llegar tarde"; `actividad.deporte.futbol` → "futbol (actividad)". */
export function stimulusEs(s: string): string {
  const parts = s.split('.');
  const last = (parts.at(-1) ?? s).replace(/_/g, ' ');
  const kind = parts[0];
  if (kind === 'need') return (NEED_ES[parts[1] ?? ''] ?? last).toLowerCase();
  if (kind === 'saciedad') return 'haberlo hecho hace poco';
  if (s === 'hist.discountK') return 'impaciencia';
  if (kind === 'actividad') return `${last} (actividad)`;
  if (kind === 'lugar') return `${last} (lugar)`;
  if (kind === 'rutina') return `${ACTIVITY_ES[parts.at(-1) ?? ''] ?? last} (rutina)`;
  if (kind === 'dominio') return `${last} (valor)`;
  return last;
}

/** Estados que aparecen como causa, en palabras (019). */
const STATE_ES: Record<string, string> = {
  mismo_lugar: 'estaban en el mismo lugar',
  sin_contacto: 'llevaban tiempo sin verse',
  quincena: 'día de pago',
  energia: 'energía',
  estres: 'estrés',
  salud_fisica: 'salud física',
  tension: 'tensión entre ellos',
  deuda_de_sueno: 'deuda de sueño',
  duracion_viaje: 'duración del viaje',
  rng: 'azar',
  clock: 'la hora del día',
  tiempo: 'el paso del tiempo',
  external_input: 'una orden externa',
  deficit: 'déficit',
  actividad: 'lo que estaba haciendo',
  descuento: 'impaciencia',
  funcion: 'lo que ha aprendido',
  horario_de_sueno: 'su horario de sueño',
};
const SOURCE_ES: Record<string, string> = { reforzador: 'le gusta', fuerza: 'costumbre', coste: 'le cuesta', regla: 'una regla', relacion: 'lo que relaciona', valor: 'lo que valora', funcion: 'lo que ha aprendido' };
const valueEs = (v: number | null) => (v === null ? '' : ` (${Number.isInteger(v) ? v : v.toFixed(2)})`);

/** Una causa legible (019): una fuente de la decisión, un estado o un hecho anterior. */
export function causeEs(c: Cause): string {
  if ('event' in c) return 'un hecho anterior';
  const [head, ref] = c.state.split(':');
  if (head?.startsWith('fuente.')) {
    const src = head.slice(7);
    return `${SOURCE_ES[src] ?? src}${ref ? `: ${stimulusEs(ref)}` : ''}`;
  }
  // `gasto.arriendo` → «gasto en arriendo».
  const text = STATE_ES[head ?? ''] ?? (head?.includes('.') ? head.replace(/^([a-z_]+)\.(.+)$/, (_, a: string, b: string) => `${a.replace(/_/g, ' ')} en ${b.replace(/_/g, ' ')}`) : c.state.replace(/_/g, ' '));
  return `${text}${valueEs(c.value)}`;
}

/** Resumen de un evento en una línea. */
export function eventEs(e: EventView): string {
  const who = e.participants.find((p) => p.id.startsWith('CIT'))?.name;
  const base = EVENT_ES[e.type] ?? e.type;
  const act = typeof e.payload.name === 'string' ? `: ${e.payload.name}` : '';
  return `${e.date} · ${base}${act}${who ? ` — ${who}` : ''}`;
}
