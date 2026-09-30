// Historia de vida de un ciudadano (spec 041 R-009, CA-005, CA-006): los episodios de su desarrollo por etapa, con
// quién intervino y lo que aprendió en palabras, y su familiograma extenso con la calidad de cada relación. Solo lee
// el estado persistido y el registro de eventos (022 R-001; CLAUDE.md §8).
import { eventText, idNumber } from '@datas-world/engine';
import type { DevelopmentEpisode, EntityId, World, WorldEvent } from '@datas-world/engine';
import type { Catalogs } from '@datas-world/generators';
import { dateOf, nameOf } from './views.ts';

export type Quality = 'cercana' | 'conflictiva' | 'distante' | 'sin_datos';

export interface GenoNode {
  id: string;
  name: string;
  sex: 'F' | 'M';
  born: number | null;
  died: number | null;
  /** Antepasado que no vive en el municipio (030). */
  outside: boolean;
  /** Generación respecto a la persona: −3 bisabuelos … 0 ella, sus hermanos, primos y pareja … +1 hijos. */
  generation: number;
  relation: string;
  quality: Quality;
  motherId: string | null;
  fatherId: string | null;
}

export interface EpisodeView {
  date: string;
  age: number;
  stage: string;
  kind: string;
  title: string;
  text: string;
  speaker: string;
  speakerName: string | null;
  valence: number;
  learned: { label: string; delta: number }[];
  cause: string | null;
}

/** Un recuerdo (013), como lo recuerda hoy la persona y cómo lo vivió. */
export interface MemoryView {
  id: string;
  date: string;
  age: number;
  source: 'lived' | 'told' | 'session';
  text: string;
  valence: number;
  valence0: number;
  intensity: number;
  rehearsals: number;
  chapter: string | null;
}

/** Un capítulo de su vida (013 R-010). */
export interface ChapterView {
  id: string;
  theme: string;
  from: string;
  to: string | null;
  fromAge: number;
  tone: number;
  openedBy: string | null;
}

export interface LifeView {
  id: string;
  name: string;
  genogram: { nodes: GenoNode[]; partners: [string, string][] };
  stages: { stage: string; episodes: EpisodeView[] }[];
  /** 013: capítulos y recuerdos (vacíos en mundos anteriores a la 013). */
  chapters: ChapterView[];
  memories: MemoryView[];
}

const STAGE_ORDER = ['infancia', 'escolar', 'adolescencia', 'adulto'];
const ROLE: Readonly<Record<string, string>> = {
  madre: 'su madre', padre: 'su padre', cuidador: 'quien le cuidaba', hermano: 'su hermano o hermana', docente: 'un docente',
  par: 'un amigo o compañero', pareja: 'su pareja', jefe: 'su jefe', ninguno: '',
};
const RESPONSE: Readonly<Record<string, string>> = {
  'evit.distraccion': 'evitar distrayéndose', 'evit.dormir': 'evitar durmiendo', 'evit.consumir': 'evitar bebiendo o consumiendo',
  'evit.suprimir': 'reprimir lo que siente', 'evit.evitar_persona': 'evitar a alguien', 'yo.enmarque': 'tomar distancia de sus pensamientos («Yo»)',
  'habito.fumar': 'fumar', 'habito.beber': 'beber', 'habito.ejercicio': 'hacer ejercicio', 'rutina.chores': 'hacer los oficios de la casa',
  'rutina.study': 'estudiar', 'rutina.care': 'cuidar a otros',
};

/** Etiquetas en palabras de lo aprendido (estímulos, respuestas, valores y relaciones). */
export function learnedLabels(catalogs: Catalogs): (key: string) => string {
  const names = new Map<string, string>(catalogs.stimulus_classes.entries.map((e) => [e.key, e.name]));
  for (const e of catalogs.chat_stances.entries) names.set(`conv.${e.key}`, `responder: ${e.name.toLowerCase()}`);
  for (const e of catalogs.life_domains.entries) names.set(e.key, `valor: ${e.name.toLowerCase()}`);
  const one = (k: string) => RESPONSE[k] ?? names.get(k) ?? k;
  return (k) => (k.includes('~') ? `relaciona ${one(k.split('~')[0]!)} con ${one(k.split('~')[1]!)}` : one(k));
}

const col = (world: World, name: string, id: string) => (world.components.i32[name] ?? world.components.u8[name])?.[idNumber(id as EntityId)] ?? 0;
const yearOf = (world: World, at: number) => Number(dateOf(world, at).slice(0, 4));

/** CA-006: parientes conocidos hasta los bisabuelos, y hermanos, tíos, primos, pareja e hijos, con su generación. */
export function relatives(world: World, id: EntityId): Map<string, { generation: number; relation: (sex: 'F' | 'M') => string }> {
  const out = new Map<string, { generation: number; relation: (sex: 'F' | 'M') => string }>();
  const g = (f: string, m: string) => (sex: 'F' | 'M') => (sex === 'F' ? f : m);
  const put = (x: string | undefined, generation: number, relation: (sex: 'F' | 'M') => string) => {
    if (x && !out.has(x) && world.citizens.has(x as EntityId)) out.set(x, { generation, relation });
  };
  const all = [...world.citizens.values()];
  const parentsOf = (x: string) => {
    const c = world.citizens.get(x as EntityId);
    return [c?.motherId, c?.fatherId].filter((y): y is EntityId => !!y);
  };
  const childrenOf = (xs: readonly string[]) => all.filter((c) => xs.includes(c.motherId ?? '') || xs.includes(c.fatherId ?? '')).map((c) => c.id as string);
  out.set(id, { generation: 0, relation: () => 'yo' });
  const parents = parentsOf(id);
  for (const p of parents) put(p, -1, g('madre', 'padre'));
  const grand = parents.flatMap(parentsOf);
  for (const p of grand) put(p, -2, g('abuela', 'abuelo'));
  for (const p of grand.flatMap(parentsOf)) put(p, -3, g('bisabuela', 'bisabuelo'));
  for (const s of childrenOf(parents)) put(s, 0, g('hermana', 'hermano'));
  const aunts = childrenOf(grand).filter((x) => !parents.includes(x as EntityId));
  for (const a of aunts) put(a, -1, g('tía', 'tío'));
  for (const c of childrenOf(aunts)) put(c, 0, g('prima', 'primo'));
  const me = world.citizens.get(id)!;
  const h = me.householdId ? world.households.get(me.householdId) : undefined;
  const k = h?.kinship.find((x) => x.kind === 'partner' && (x.from === id || x.to === id));
  if (k) put(k.from === id ? k.to : k.from, 0, () => 'pareja');
  for (const c of childrenOf([id])) put(c, 1, g('hija', 'hijo'));
  return out;
}

/** Calidad de la relación por los episodios en que intervino esa persona (041 R-009) [M]. */
function qualityOf(ep: { n: number; sum: number } | undefined): Quality {
  if (!ep || ep.n === 0) return 'sin_datos';
  if (ep.n < 3) return 'distante';
  const score = ep.sum / ep.n;
  return score > 0.15 ? 'cercana' : score < -0.15 ? 'conflictiva' : 'distante';
}

export function lifeView(world: World, id: EntityId, years: readonly WorldEvent[], causes: ReadonlyMap<string, WorldEvent>, catalogs: Catalogs): LifeView | undefined {
  const me = world.citizens.get(id);
  if (!me?.name) return undefined;
  const defs = new Map(catalogs.development_episodes.entries.map((e) => [e.key, { title: e.name, text: String((e.attrs as { text?: string } | undefined)?.text ?? e.name) }]));
  const label = learnedLabels(catalogs);
  const withSpeaker = new Map<string, { n: number; sum: number }>();
  const stages = new Map<string, EpisodeView[]>();
  for (const y of years) {
    const p = y.payload as { citizenId: string; age: number; stage: string; episodes: DevelopmentEpisode[] };
    if (p.citizenId !== id) continue;
    for (const [at, kind, speaker, speakerId, valence, cause, learned] of p.episodes) {
      if (speakerId) {
        const s = withSpeaker.get(speakerId) ?? { n: 0, sum: 0 };
        withSpeaker.set(speakerId, { n: s.n + 1, sum: s.sum + valence });
      }
      const def = defs.get(kind);
      const c = cause ? causes.get(cause) : undefined;
      const view: EpisodeView = {
        date: dateOf(world, at).slice(0, 10), age: p.age, stage: p.stage, kind, title: def?.title ?? kind, text: def?.text ?? kind,
        speaker: ROLE[speaker] ?? speaker, speakerName: speakerId ? nameOf(world, speakerId) : null, valence,
        learned: learned.map(([k, d]) => ({ label: label(k), delta: d })),
        cause: c ? eventText(c) : null,
      };
      stages.set(p.stage, [...(stages.get(p.stage) ?? []), view]);
    }
  }
  const nodes: GenoNode[] = [];
  const family = relatives(world, id);
  for (const [rid, r] of family) {
    const c = world.citizens.get(rid as EntityId)!;
    const died = col(world, 'demo.deathMinute', rid);
    const born = col(world, 'demo.birthMinute', rid);
    nodes.push({
      id: rid, name: c.name ? `${c.name.given} ${c.name.family.join(' ')}` : rid, sex: c.sex ?? 'F',
      born: born ? yearOf(world, born) : null, died: died ? yearOf(world, died) : null, outside: c.ancestor === true,
      generation: r.generation, relation: r.relation(c.sex ?? 'F'), quality: rid === id ? 'sin_datos' : qualityOf(withSpeaker.get(rid)),
      motherId: c.motherId && family.has(c.motherId) ? c.motherId : null, fatherId: c.fatherId && family.has(c.fatherId) ? c.fatherId : null,
    });
  }
  nodes.sort((a, b) => a.generation - b.generation || (a.born ?? 0) - (b.born ?? 0) || (a.id < b.id ? -1 : 1));
  // Parejas: los padres de cada hijo del familiograma y la pareja de la persona.
  const partners = new Map<string, [string, string]>();
  for (const n of nodes) if (n.motherId && n.fatherId) partners.set(`${n.motherId}|${n.fatherId}`, [n.motherId, n.fatherId]);
  const mine = nodes.find((n) => n.relation === 'pareja');
  if (mine) partners.set(`${id}|${mine.id}`, [id, mine.id]);
  return {
    id, name: `${me.name.given} ${me.name.family.join(' ')}`,
    genogram: { nodes, partners: [...partners.values()] },
    stages: STAGE_ORDER.filter((s) => stages.has(s)).map((s) => ({ stage: s, episodes: stages.get(s)! })),
    ...memoriesOf(world, id, causes, defs),
  };
}

/** 013: los capítulos y los recuerdos de la persona, en orden de fecha, con su texto. */
function memoriesOf(world: World, id: EntityId, events: ReadonlyMap<string, WorldEvent>, defs: ReadonlyMap<string, { title: string; text: string }>): Pick<LifeView, 'chapters' | 'memories'> {
  const mem = world.citizens.get(id)?.memory;
  if (!mem) return { chapters: [], memories: [] };
  const birth = col(world, 'demo.birthMinute', id);
  const ageAt = (at: number) => Math.max(0, Math.floor((at - birth) / (365.25 * 1440)));
  const person = (m: { stims: string[] }) => m.stims.find((s) => s.startsWith('cit.'))?.slice(4);
  const text = (m: (typeof mem.episodes)[number]): string => {
    const e = m.event ? events.get(m.event) : undefined;
    if (m.source === 'told') return `Le contaron que ${nameOf(world, person(m) ?? '') ?? 'alguien'}: ${m.kind.replace(/_/g, ' ')}`;
    if (e && e.type !== 'DEVELOPMENT_YEAR') return withNames(world, eventText(e));
    const who = person(m);
    const base = defs.get(m.kind)?.text ?? m.kind.replace(/_/g, ' ');
    return who ? `${base.replace(/\.$/, '')} (${nameOf(world, who) ?? who}).` : base;
  };
  return {
    chapters: [...mem.chapters].sort((a, b) => a.from - b.from).map((c) => ({
      id: c.id, theme: c.theme, from: dateOf(world, c.from).slice(0, 10), to: c.to !== undefined ? dateOf(world, c.to).slice(0, 10) : null,
      fromAge: ageAt(c.from), tone: c.tone, openedBy: c.openedBy && events.get(c.openedBy) ? withNames(world, eventText(events.get(c.openedBy)!)) : null,
    })),
    memories: [...mem.episodes].sort((a, b) => a.at - b.at).map((m) => ({
      id: m.id, date: dateOf(world, m.at).slice(0, 10), age: ageAt(m.at), source: m.source, text: text(m), valence: m.valence, valence0: m.valence0,
      intensity: m.intensity, rehearsals: m.rehearsals, chapter: m.chapter ?? null,
    })),
  };
}

/** Los ids de personas del texto de un evento, cambiados por sus nombres. */
const withNames = (world: World, s: string) => s.replace(/CIT-\d+/g, (x) => nameOf(world, x) ?? x);
