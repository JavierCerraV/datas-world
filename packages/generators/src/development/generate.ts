// Fase de desarrollo de `generateWorld` (spec 041): la historia de aprendizaje de cada persona, de 0 años al presente.
// Por persona (flujo `gen:development/<id>`, INV-002): los episodios de cada año según su etapa, su hogar, sus hechos
// de infancia y el estilo de su familia (compartido por los hermanos), y los que producen los hechos de la 030
// (duelos, separación, mudanzas, estudios, migración). Se aprenden en orden con los mecanismos de la 036 a la 039, y
// cada uno queda en el registro como `DEVELOPMENT_EPISODE` con quién intervino y lo que aprendió (R-007).
import { AVOIDANCE_W0, PRIVATE_DEFAULTS, emptyStore, learningParams, makeEvent, operant, pair, prune, sensitivityOf, teach } from '@datas-world/engine';
import type {
  DevelopmentEpisode, EntityId, FunctionStore, LearningParams, Ontology, RelationalNetwork, Rng, Sensitivity, World, WorldEvent,
} from '@datas-world/engine';
import type { Catalogs } from '../catalogs/load.ts';
import { STAGES, episodeDefs, stageOf } from './catalog.ts';
import type { Effect, EpisodeDef, Stage } from './catalog.ts';
import { YEAR, aliveAt, devContext, historyIndex, meets } from './context.ts';
import type { DevContext } from './context.ts';

const DAY = 1440;
/** R-001 [M] (decisión 1): episodios por año de 0 a 17 años y de adulto. */
export const EPISODES_PER_YEAR = Object.freeze({ child: 50, adult: 12 });
/** Decisión 4 [M]: balance típico de lo vivido (lo que acercó frente a lo que dolió) y cuánto mueve el ánimo de base. */
export const MOOD_CENTER = 0.3;
export const MOOD_SPREAD = 0.3;

/** Estilo de crianza de una familia [M]: multiplica los episodios que acercan, los conflictivos y hablar de emociones. */
interface FamilyStyle { warmth: number; harshness: number; emotionTalk: number }
const lognormal = (r: Rng) => Math.exp(r.normal(0, 0.5));
const styleOf = (r: Rng): FamilyStyle => ({ warmth: lognormal(r), harshness: lognormal(r), emotionTalk: lognormal(r) * lognormal(r) });

const ROLE_STIM: Readonly<Record<string, string>> = {
  madre: 'rol.madre', padre: 'rol.padre', cuidador: 'rol.cuidador', hermano: 'rol.hermano', docente: 'rol.docente', par: 'rol.par', pareja: 'rol.pareja', jefe: 'rol.jefe',
};

interface Scheduled { at: number; def: EpisodeDef; speakerId?: EntityId; cause?: EntityId }

/** Quién interviene en el episodio en ese minuto (041 R-003): la persona real si existe y vive, y su rol. */
function speakerOf(world: World, c: DevContext, def: EpisodeDef, at: number, r: Rng, given?: EntityId): { role: string; id?: EntityId } {
  const alive = (x: EntityId | undefined) => (aliveAt(world, x, at) ? x : undefined);
  const grand = () => c.kin.grandparents.find((g) => aliveAt(world, g, at));
  const caregiver = (): { role: string; id?: EntityId } => {
    const g = grand();
    if (c.flags.has('abuelos') && g) return { role: 'cuidador', id: g };
    if (alive(c.kin.mother)) return { role: 'madre', id: c.kin.mother! };
    if (alive(c.kin.father)) return { role: 'padre', id: c.kin.father! };
    return g ? { role: 'cuidador', id: g } : { role: 'cuidador' };
  };
  switch (def.speaker) {
    case 'cuidador_principal':
      return caregiver();
    case 'progenitor': {
      const both = [alive(c.kin.mother) ? 'madre' : undefined, alive(c.kin.father) ? 'padre' : undefined].filter((x): x is string => !!x);
      if (both.length === 0) return caregiver();
      const role = both[r.int(0, both.length - 1)]!;
      return { role, id: role === 'madre' ? c.kin.mother! : c.kin.father! };
    }
    case 'padre':
      return c.kin.father ? { role: 'padre', id: c.kin.father } : { role: 'padre' };
    case 'pareja':
      return c.kin.partner ? { role: 'pareja', id: c.kin.partner } : { role: 'pareja' };
    case 'fallecido': {
      const role = given === c.kin.mother ? 'madre' : given === c.kin.father ? 'padre' : given === c.kin.partner ? 'pareja' : c.kin.siblings.includes(given!) ? 'hermano' : 'cuidador';
      return given ? { role, id: given } : { role };
    }
    default:
      return { role: def.speaker };
  }
}

/** Peso de un episodio para esta persona en ese minuto: base × modificadores × estilo de su familia; 0 si no aplica. */
function weightOf(c: DevContext, def: EpisodeDef, at: number, style: FamilyStyle): number {
  if (def.weight <= 0 || !def.requires.every((q) => meets(c, q, at))) return 0;
  let w = def.weight;
  for (const m of def.mods) if (meets(c, m.if, at)) w *= m.x;
  if (at - c.birth < 18 * YEAR) {
    if (def.key === 'crianza.nombrar_emocion') w *= style.emotionTalk;
    else if (def.valence > 0) w *= style.warmth;
    else if (def.valence < 0) w *= style.harshness;
  }
  return w;
}

export interface Learner {
  onto: Ontology;
  P: LearningParams;
  sens: Sensitivity;
  /** Fuerza de partida de cada respuesta antes de su primer ensayo (036 R-002). */
  w0: (response: string) => number;
}

/** Aplica los efectos de un episodio y devuelve lo aprendido (clave y cambio) y el balance respondiente. */
export function applyEffects(store: FunctionStore, net: RelationalNetwork, effects: readonly Effect[], at: number, speakerStim: string | undefined, L: Learner): { learned: [string, number][]; balance: number } {
  const learned: [string, number][] = [];
  let balance = 0;
  const vOf = (s: string) => store.f.find((f) => f.s === s)?.v ?? 0;
  // Lo aprendido con dos decimales; un cambio menor de 0,005 no se anota (no se nota y ocupa disco).
  const note = (k: string, d: number) => {
    if (Math.abs(d) >= 0.005) learned.push([k, Math.round(d * 100) / 100]);
  };
  for (const e of effects) {
    if (e.op === 'pair') {
      const stim = e.stim === '@speaker' ? speakerStim : e.stim;
      if (!stim || !L.onto.classes.has(stim)) continue;
      const before = vOf(stim);
      pair(store, L.onto, { stim, ctx: '', now: at, lambda: e.lambda, ...(e.us ? { us: e.us } : {}), ...(e.social ? { social: true } : {}) }, L.P, L.sens);
      note(stim, vOf(stim) - before);
      balance += e.lambda;
    } else if (e.op === 'operant') {
      let r = store.r.find((x) => x.r === e.response && x.c === '');
      if (!r) store.r.push((r = { r: e.response, c: '', w: L.w0(e.response), n: 0, at }));
      const before = r.w;
      operant(store, e.response, '', e.outcome, at, L.P, L.sens);
      note(e.response, r.w - before);
    } else if (e.op === 'value') {
      // Los dominios vitales (`dominio.*`, 038) no son clases de la ontología: su función se aprende igual (036).
      teach(net, { a: e.stim, b: e.domain, t: 'part_of', s: e.s, now: at });
      const before = vOf(e.domain);
      pair(store, L.onto, { stim: e.domain, ctx: '', now: at, lambda: e.lambda }, L.P, L.sens);
      note(e.domain, vOf(e.domain) - before);
      balance += e.lambda;
    } else {
      teach(net, { a: e.a, b: e.b, t: e.t, s: e.s, now: at });
      note(`${e.a}~${e.b}`, e.s);
    }
  }
  return { learned, balance };
}

/** Anota el episodio como origen (019, 041 INV-001) de lo que cambió, como hace la 036 con los hechos del mundo. */
function addSource(store: FunctionStore, learned: readonly [string, number][], id: string): void {
  for (const [k] of learned) {
    const f = store.f.find((x) => x.s === k);
    if (f && !f.src.includes(id)) f.src = [...f.src, id].slice(-3);
    const r = store.r.find((x) => x.r === k && x.c === '');
    if (r && !r.src?.includes(id)) r.src = [...(r.src ?? []), id].slice(-3);
  }
}

export interface DevelopmentResult {
  events: WorldEvent[];
}

export function generateDevelopment(world: World, citizenIds: readonly EntityId[], prior: readonly WorldEvent[], catalogs: Catalogs, onto: Ontology, rng: Rng): DevelopmentResult {
  const defs = episodeDefs(catalogs.development_episodes);
  const byStage = new Map<Stage, EpisodeDef[]>(STAGES.map((s) => [s, defs.filter((d) => d.stage === s)]));
  const stanceW0 = new Map(catalogs.chat_stances.entries.map((e) => [`conv.${e.key}`, Number((e.attrs as { w0?: number } | undefined)?.w0 ?? 0.3)]));
  const w0 = (resp: string) => stanceW0.get(resp) ?? (resp === 'yo.enmarque' ? PRIVATE_DEFAULTS.selfW0 : resp.startsWith('evit.') ? AVOIDANCE_W0 : 0.2);
  const P = learningParams(world.config.profile, world.config.epoch.slice(0, 10));
  const index = historyIndex(prior);
  const living = [...citizenIds].sort();
  // Hechos de la 030 que producen episodios: por persona (infancia, estudios, migración) o por muerte de un pariente.
  const triggered = new Map<string, { def: EpisodeDef; at: number; cause: EntityId; speakerId?: EntityId }[]>();
  const add = (id: string, x: { def: EpisodeDef; at: number; cause: EntityId; speakerId?: EntityId }) => triggered.set(id, [...(triggered.get(id) ?? []), x]);
  const defsFor = (key: string) => defs.filter((d) => d.triggers.includes(key));
  const contexts = new Map(living.map((id) => [id, devContext(world, id, index, living)]));
  for (const e of prior) {
    if (e.type === 'CHILDHOOD_EVENT') {
      const p = e.payload as { citizenId: string; kind: string };
      // «Perdió a su padre en la adolescencia»: el duelo es por su padre.
      const father = contexts.get(p.citizenId as EntityId)?.kin.father;
      for (const def of defsFor(`CHILDHOOD_EVENT:${p.kind}`))
        add(p.citizenId, { def, at: e.at, cause: e.id, ...(def.speaker === 'fallecido' && father ? { speakerId: father } : {}) });
    } else if (e.type === 'STUDIES_COMPLETED' || e.type === 'MIGRATED') {
      for (const x of e.participants) for (const def of defsFor(e.type)) add(x.id, { def, at: e.at, cause: e.id });
    } else if (e.type === 'CITIZEN_DIED') {
      const dead = (e.payload as { citizenId: EntityId }).citizenId;
      for (const [id, c] of contexts) {
        const kin = [c.kin.mother, c.kin.father, ...c.kin.grandparents, ...c.kin.siblings, c.kin.partner, ...c.kin.children];
        if (kin.includes(dead) && c.birth <= e.at) for (const def of defsFor('CITIZEN_DIED')) add(id, { def, at: e.at + DAY, cause: e.id, speakerId: dead });
      }
    }
  }

  const events: WorldEvent[] = [];
  for (const id of living) {
    const person = world.citizens.get(id)!;
    const c = contexts.get(id)!;
    const r = rng.fork('gen:development').fork(id);
    const style = styleOf(rng.fork('gen:development/familia').fork(c.kin.mother ?? c.kin.father ?? id));
    const L: Learner = { onto, P, sens: sensitivityOf(world, Number(id.slice(4))), w0 };
    const store: FunctionStore = person.functions ? (JSON.parse(JSON.stringify(person.functions)) as FunctionStore) : emptyStore();
    const net: RelationalNetwork = person.network ? (JSON.parse(JSON.stringify(person.network)) as RelationalNetwork) : { e: [], pruned: 0 };

    const plan: Scheduled[] = [];
    for (let y = 0; y <= c.age; y++) {
      const stage = stageOf(y);
      const n = Math.round((y < 18 ? EPISODES_PER_YEAR.child : EPISODES_PER_YEAR.adult) * (0.8 + 0.4 * r.next()));
      for (let i = 0; i < n; i++) {
        const at = c.birth + y * YEAR + r.int(0, 364) * DAY + r.int(0, DAY - 1);
        if (at >= -DAY) continue;
        const pool = byStage.get(stage)!;
        const ws = pool.map((d) => weightOf(c, d, at, style));
        const total = ws.reduce((a, w) => a + w, 0);
        if (total <= 0) continue;
        let x = r.next() * total;
        let k = 0;
        while (k < ws.length - 1 && x >= ws[k]!) x -= ws[k++]!;
        plan.push({ at, def: pool[k]! });
      }
    }
    for (const t of triggered.get(id) ?? []) if (t.at < 0) plan.push({ at: Math.min(t.at, -DAY), def: t.def, cause: t.cause, ...(t.speakerId ? { speakerId: t.speakerId } : {}) });
    plan.sort((a, b) => a.at - b.at || (a.def.key < b.def.key ? -1 : 1));

    let pos = 0;
    let neg = 0;
    const years = new Map<number, { items: DevelopmentEpisode[]; causes: Set<EntityId>; speakers: Map<EntityId, string>; touched: Set<string> }>();
    for (const s of plan) {
      const sp = speakerOf(world, c, s.def, s.at, r, s.speakerId);
      const { learned, balance } = applyEffects(store, net, s.def.effects, s.at, ROLE_STIM[sp.role], L);
      if (balance > 0) pos += balance;
      else neg -= balance;
      const age = Math.max(0, Math.floor((s.at - c.birth) / YEAR));
      let y = years.get(age);
      if (!y) years.set(age, (y = { items: [], causes: new Set(), speakers: new Map(), touched: new Set() }));
      y.items.push([s.at, s.def.key, sp.role, sp.id ?? '', s.def.valence, s.cause ?? '', learned]);
      if (s.cause) y.causes.add(s.cause);
      if (sp.id && sp.id !== id) y.speakers.set(sp.id, sp.role);
      for (const [k] of learned) y.touched.add(k);
    }
    // Un evento por año de vida con todos sus episodios (R-007), fechado en el último. Participa quien intervino y
    // vive en esa fecha (030 INV-002); los demás (un fallecido en su duelo) siguen en el episodio.
    for (const [age, y] of [...years].sort((a, b) => a[0] - b[0])) {
      const at = Math.min(y.items.at(-1)![0], -DAY);
      const stage = stageOf(age);
      const e = makeEvent(world.counters, at, {
        type: 'DEVELOPMENT_YEAR',
        payload: { citizenId: id, age, stage, episodes: y.items },
        participants: [{ id, role: 'protagonista' }, ...[...y.speakers].filter(([sid]) => aliveAt(world, sid, at)).map(([sid, role]) => ({ id: sid, role }))],
        causes: [...[...y.causes].map((x) => ({ event: x, weight: 1 })), { state: `etapa.${stage}`, entity: id, weight: 0.3 }],
      });
      addSource(store, [...y.touched].map((k): [string, number] => [k, 0]), e.id);
      events.push(e);
    }
    prune(store, P);
    person.functions = store;
    person.network = net;
    // Decisión 4 [M]: el ánimo de base sale del balance de lo vivido (lo que acercó frente a lo que dolió),
    // alrededor del balance típico de la población.
    const f = world.components.f32['state.moodBaseline'];
    if (f && pos + neg > 0) f[Number(id.slice(4))] = Math.max(0.3, Math.min(0.8, 0.55 + MOOD_SPREAD * ((pos - neg) / (pos + neg) - MOOD_CENTER)));
  }
  return { events };
}
