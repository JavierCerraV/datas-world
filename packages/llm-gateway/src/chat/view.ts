// Vista mínima de la persona (spec 043 §3, R-002, R-003): lo único que recibe el LLM. Solo contiene hechos propios,
// eventos en los que participa y los nacimientos y muertes de su familia cercana (los sabe por parentesco). Nunca
// hechos de otros que no presenció. Se sustituye por la `PersonView` de la 025 cuando exista.
import { ACTIVITY, ACTIVITY_COLUMN, ageInYears, formatId, toCalendar } from '@datas-world/engine';
import type { EntityId, WorldEvent, WorldView } from '@datas-world/engine';
import { renderFact } from './facts.ts';

export interface ViewFact {
  id: string;
  date: string;
  /** Edad de la persona en ese momento (null si no se conoce su nacimiento). */
  age: number | null;
  text: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  age: number | null;
  alive: boolean;
}

export interface PersonView {
  citizenId: string;
  name: string;
  sex: 'F' | 'M' | null;
  age: number | null;
  birthplace: string | null;
  occupation: string;
  family: FamilyMember[];
  situation: { date: string; time: string; activity: string; place: string | null; money: number | null };
  state: { mood: number; stress: number; needs: Record<string, number>; emotions: Record<string, number> };
  likes: string[];
  facts: ViewFact[];
}

export interface ViewInput {
  view: WorldView;
  citizenId: string;
  now: number;
  /** Eventos candidatos (los que la persistencia asocia a la persona y a su familia); se filtran aquí. */
  events: readonly WorldEvent[];
  /** Eventos recientes de la simulación que entran (043 §8, `N_RECENT_EVENTS`). */
  nRecent?: number;
}

const ACTIVITY_LABEL: Record<string, string> = {
  idle: 'sin hacer nada en particular', sleep: 'durmiendo', eat: 'comiendo', work: 'trabajando', study: 'estudiando',
  commute: 'en camino', leisure: 'en su tiempo libre', socialize: 'con otras personas', chores: 'haciendo oficios',
  shop: 'comprando', exercise: 'haciendo ejercicio', care: 'cuidando a alguien', job_search: 'buscando empleo',
  errands: 'haciendo diligencias', sick: 'enfermo', wash: 'arreglándose',
};
const NEED_LABEL: Record<string, string> = { 'need.hunger': 'alimentación', 'need.energy': 'energía', 'need.hygiene': 'aseo', 'need.social': 'compañía', 'need.fun': 'diversión' };
const EMOTION_LABEL: Record<string, string> = { 'emo.joy': 'alegría', 'emo.sadness': 'tristeza', 'emo.anger': 'rabia', 'emo.fear': 'miedo', 'emo.shame': 'vergüenza' };
const KIN_EVENTS = new Set(['CITIZEN_BORN', 'CITIZEN_DIED']);

const r2 = (x: number) => Math.round(x * 100) / 100;

export function nameOf(view: WorldView, id: string): string {
  const c = view.citizens.get(id as EntityId);
  return c?.name ? `${c.name.given} ${c.name.family[0]}` : id;
}

/** Familia cercana: padres, pareja (adulto del hogar que no es su hijo) e hijos. */
function familyOf(view: WorldView, id: string, now: number): FamilyMember[] {
  const me = view.citizens.get(id as EntityId);
  if (!me) return [];
  const birth = view.components.i32['demo.birthMinute'];
  const ageOf = (x: string) => {
    const row = Number(x.slice(4));
    const b = birth?.[row];
    return b !== undefined && b !== 0 ? ageInYears(b, now, view.config.epoch) : null;
  };
  const out: FamilyMember[] = [];
  const add = (x: string | undefined, relation: string) => {
    if (!x || out.some((m) => m.id === x)) return;
    const c = view.citizens.get(x as EntityId);
    out.push({ id: x, name: nameOf(view, x), relation, age: ageOf(x), alive: c?.status === 'active' });
  };
  add(me.fatherId, 'padre');
  add(me.motherId, 'madre');
  const children = [...view.citizens.values()].filter((c) => c.motherId === id || c.fatherId === id).map((c) => c.id);
  for (const c of children) add(c, view.citizens.get(c)?.sex === 'F' ? 'hija' : 'hijo');
  const household = me.householdId ? view.households.get(me.householdId) : undefined;
  for (const k of household?.kinship ?? [])
    if (k.kind === 'partner' && (k.from === id || k.to === id)) add(k.from === id ? k.to : k.from, 'pareja');
  for (const m of household?.memberIds ?? [])
    if (m !== id && m !== me.fatherId && m !== me.motherId) add(m, 'familiar del hogar');
  return out;
}

export function buildPersonView(input: ViewInput): PersonView {
  const { view, citizenId: id, now } = input;
  const me = view.citizens.get(id as EntityId);
  if (!me) throw new Error(`Persona inexistente: ${id}`);
  const row = Number(id.slice(4));
  const epoch = view.config.epoch;
  const f = view.components.f32;
  const birth = view.components.i32['demo.birthMinute']?.[row];
  const ageAt = (at: number) => (birth !== undefined && birth !== 0 ? ageInYears(birth, at, epoch) : null);
  const family = familyOf(view, id, now);
  const kin = new Set(family.map((m) => m.id));

  // R-003: solo lo que presenció (participa) o lo que sabe por parentesco (nacimientos y muertes de su familia).
  const mine = input.events.filter((e) =>
    e.participants.some((p) => p.id === id) ||
    (KIN_EVENTS.has(e.type) && kin.has(String((e.payload as { citizenId?: string }).citizenId))));
  const born = mine.find((e) => e.type === 'CITIZEN_BORN' && (e.payload as { citizenId: string }).citizenId === id);
  const origin = mine.filter((e) => e.at < 0 && e.type !== 'LEISURE_DONE');
  const recent = mine.filter((e) => e.at >= 0 && e.type !== 'LEISURE_DONE').slice(-(input.nRecent ?? 40));
  const facts: ViewFact[] = [...origin, ...recent]
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1))
    .map((e) => {
      const c = toCalendar(e.at, epoch);
      return { id: e.id, date: `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`, age: ageAt(e.at), text: renderFact(view, id, e, family) };
    });
  // El ocio de la última semana, resumido en un hecho.
  const week = mine.filter((e) => e.type === 'LEISURE_DONE' && e.at >= now - 7 * 1440);
  if (week.length > 0) {
    const count = new Map<string, number>();
    for (const e of week) {
      const n = (e.payload as { name: string }).name.toLowerCase();
      count.set(n, (count.get(n) ?? 0) + 1);
    }
    facts.push({ id: 'OCIO-SEMANA', date: '', age: ageAt(now), text: `En la última semana: ${[...count].map(([n, k]) => `${n} (${k} ${k === 1 ? 'vez' : 'veces'})`).join(', ')}.` });
  }

  const cal = toCalendar(now, epoch);
  const act = view.components.u8[ACTIVITY_COLUMN]?.[row] ?? 0;
  const actKey = Object.entries(ACTIVITY).find(([, v]) => v === act)?.[0] ?? 'idle';
  const here = view.components.i32['loc.place']?.[row] ?? 0;
  const occ = me.occupation;
  const occupation = !occ ? 'sin datos'
    : occ.kind === 'formal' ? `empleo formal en ${view.organizations.get(occ.orgId)?.name ?? occ.orgId}`
    : occ.kind === 'none' ? ({ unemployed: 'desempleado', student: 'estudiante', home_duties: 'labores del hogar', pensioned: 'pensionado', other_inactive: 'sin ocupación', minor: 'menor de edad' } as Record<string, string>)[occ.reason] ?? occ.reason
    : occ.kind === 'informal' ? 'trabajo informal' : 'trabajo independiente';
  const likeNames = new Map(mine.filter((e) => e.type === 'LEISURE_TAKEN_UP').map((e) => {
    const p = e.payload as { activity: string; name: string };
    return [p.activity, p.name] as const;
  }));
  return {
    citizenId: id,
    name: me.name ? `${me.name.given} ${me.name.family.join(' ')}` : id,
    sex: me.sex ?? null,
    age: ageAt(now),
    birthplace: born ? (born.payload as { placeName: string }).placeName : null,
    occupation,
    family,
    situation: {
      date: `${cal.year}-${String(cal.month).padStart(2, '0')}-${String(cal.day).padStart(2, '0')}`,
      time: `${String(cal.hour).padStart(2, '0')}:${String(cal.minute).padStart(2, '0')}`,
      activity: ACTIVITY_LABEL[actKey] ?? actKey,
      place: here > 0 ? (view.places.get(formatId('PLC', here))?.name ?? null) : null,
      money: view.components.i32.money?.[row] ?? null,
    },
    state: {
      mood: r2(f['state.mood']?.[row] ?? 0.5),
      stress: r2(f['state.stress']?.[row] ?? 0),
      needs: Object.fromEntries(Object.entries(NEED_LABEL).map(([k, l]) => [l, r2(f[k]?.[row] ?? 1)])),
      emotions: Object.fromEntries(Object.entries(EMOTION_LABEL).flatMap(([k, l]) => ((f[k]?.[row] ?? 0) >= 0.1 ? [[l, r2(f[k]![row]!)]] : []))),
    },
    likes: (me.leisure ?? []).slice(0, 5).map((l) => likeNames.get(l.key) ?? l.key),
    facts,
  };
}
