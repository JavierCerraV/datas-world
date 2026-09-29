// Formateo en español de la ficha y de los eventos para el inspector (spec 024 R-003, CA-002). Funciones puras.
import type { Cause, CitizenDetail, EventView } from './types.ts';

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
};

const LABEL_ES: Record<string, string> = { amigo: 'amistad', companero: 'trabajo', conocido: 'conocido', ex: 'expareja', familia: 'familia', pareja: 'pareja' };
const STYLE_ES: Record<string, string> = { seguro: 'seguro', evitativo: 'evitativo', ansioso: 'ansioso' };
const signed = (x: number): string => `${x > 0 ? '+' : ''}${Math.round(x * 100)}`;

const NEED_ES: Record<string, string> = { hunger: 'Alimentación', energy: 'Energía', social: 'Compañía', fun: 'Diversión', hygiene: 'Higiene', safety: 'Seguridad', health: 'Salud' };
const EMO_ES: Record<string, string> = { joy: 'Alegría', sadness: 'Tristeza', anger: 'Enojo', fear: 'Miedo', shame: 'Vergüenza' };
const KIND_ES: Record<string, string> = { pliance: 'la obedece (pliance)', tracking: 'le funciona (tracking)', augmenting: 'le da sentido (augmenting)' };
const TYPE_ES: Record<string, string> = {
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

/** Una causa legible (019): una fuente de la decisión, un estado o un evento anterior. */
export function causeEs(c: Cause): string {
  if ('event' in c) return `por un hecho anterior (${c.event})`;
  const [head, ref] = c.state.split(':');
  const value = c.value === null ? '' : ` (${c.value})`;
  if (head?.startsWith('fuente.')) return `${head.slice(7)}${ref ? `: ${stimulusEs(ref)}` : ''}${value}`;
  return `${c.state.replace(/_/g, ' ')}${value}`;
}

/** Resumen de un evento en una línea. */
export function eventEs(e: EventView): string {
  const who = e.participants.find((p) => p.id.startsWith('CIT'))?.name;
  const base = EVENT_ES[e.type] ?? e.type;
  const act = typeof e.payload.name === 'string' ? `: ${e.payload.name}` : '';
  return `${e.date} · ${base}${act}${who ? ` — ${who}` : ''}`;
}

export interface Section {
  title: string;
  rows: { label: string; value: string }[];
}

/** 024 R-003: las tres pestañas del inspector a partir de la ficha de la API. */
export function inspectorTabs(d: CitizenDetail): { estado: Section[]; historia: { id: string; line: string; causes: string[] }[]; funcional: Section[] } {
  const occ = d.occupation;
  const occText = !occ
    ? 'sin datos'
    : occ.kind === 'formal'
      ? `empleo formal${occ.orgName ? ` en ${occ.orgName}` : ''}`
      : occ.kind === 'none'
        ? ({ unemployed: 'desempleado/a', student: 'estudiante', home_duties: 'oficios del hogar', pensioned: 'pensionado/a', other_inactive: 'inactivo/a', minor: 'menor de edad' }[occ.reason ?? ''] ?? 'sin ocupación')
        : `trabajo ${occ.kind === 'informal' ? 'informal' : 'independiente'}${occ.trade ? ` (${occ.trade})` : ''}`;
  const estado: Section[] = [
    {
      title: 'Ahora',
      rows: [
        { label: 'Qué hace', value: ACTIVITY_ES[d.activity] ?? d.activity },
        { label: 'Dónde', value: d.moving ? 'en camino' : (d.place?.name ?? 'fuera del pueblo') },
        { label: 'Ánimo', value: pct(d.state.mood) },
        { label: 'Estrés', value: pct(d.state.stress) },
      ],
    },
    {
      title: 'Persona',
      rows: [
        { label: 'Edad', value: `${d.age} años` },
        { label: 'Ocupación', value: occText },
        ...(d.money !== null ? [{ label: 'Dinero', value: money(d.money) }] : []),
        ...(d.household ? [{ label: 'Hogar', value: `${d.household.members} personas` }] : []),
      ],
    },
    { title: 'Necesidades', rows: Object.entries(d.needs).map(([k, v]) => ({ label: NEED_ES[k] ?? k, value: pct(v) })) },
    { title: 'Emociones', rows: Object.entries(d.emotions).map(([k, v]) => ({ label: EMO_ES[k] ?? k, value: pct(v) })) },
    // 012 R6: quién, etiqueta, familiaridad y el afecto de cada lado (el suyo y el que le tienen).
    {
      title: 'Vínculos',
      rows: (d.bonds ?? []).map((b) => ({
        label: `${b.name ?? b.id}${b.labels.length ? ` (${b.labels.filter((l) => l !== 'conocido' || b.labels.length === 1).map((l) => LABEL_ES[l] ?? l).join(', ')})` : ''}`,
        value: `trato ${pct(b.familiarity)} · afecto ${signed(b.affection)} / ${signed(b.affectionBack)}${b.tension >= 0.05 ? ` · tensión ${pct(b.tension)}` : ''}`,
      })),
    },
  ];
  const historia = [...d.events].reverse().map((e) => ({ id: e.id, line: eventEs(e), causes: e.causes.slice(0, 4).map(causeEs) }));
  const funcional: Section[] = [
    {
      title: 'Lo que ha aprendido (funciones)',
      rows: d.functions.map((f) => ({ label: stimulusEs(f.stimulus), value: `${f.value > 0 ? 'agradable' : 'desagradable'} ${pct(Math.abs(f.value))} · ${f.trials} veces` })),
    },
    { title: 'Reglas', rows: d.rules.map((r) => ({ label: `${stimulusEs(r.response)} → ${stimulusEs(r.consequence)}`, value: `${KIND_ES[r.kind] ?? r.kind} · peso ${r.contribution}` })) },
    { title: 'Relaciones verbales', rows: d.relations.map((r) => ({ label: `${stimulusEs(r.a)} ${TYPE_ES[r.type] ?? r.type} ${stimulusEs(r.b)}`, value: pct(r.strength) })) },
    {
      title: 'Estados aprendidos',
      rows: [
        { label: 'Impaciencia (descuento)', value: String(d.learned.discountK) },
        { label: 'Exploración (variabilidad)', value: pct(d.learned.variability) },
      ],
    },
    ...(d.attachment
      ? [{
          title: 'Apego (métrica de su historia)',
          rows: [
            { label: 'Estilo', value: STYLE_ES[d.attachment.style] ?? d.attachment.style },
            { label: 'Seguridad con quienes le criaron', value: pct(d.attachment.security) },
            { label: 'Evitación (evadir frente a abrirse)', value: pct(d.attachment.avoidance) },
          ],
        }]
      : []),
  ];
  return { estado, historia, funcional };
}
