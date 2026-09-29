// Catálogos de la charla (043 §3) en la forma que usan el motor y la pasarela. Llegan ya cargados y validados
// (`@datas-world/generators`, `loadCatalogs`); aquí solo se leen sus atributos.
import type { ChatCatalog, RelationResolve } from '@datas-world/engine';

interface Entry {
  key: string;
  name: string;
  attrs?: Record<string, unknown> | undefined;
}
interface CatalogLike {
  entries: readonly Entry[];
}

export interface ToneInfo {
  key: string;
  label: string;
  description: string;
  examples: string[];
  keywords: string[];
  stimulus: string;
  magnitude: number;
  prior: number;
}

export interface StanceInfo {
  key: string;
  label: string;
  guidance: string;
  escape: number;
  w0: number;
}

/** Afirmación del visitante sobre un tercero (`chat_claims`, 044 R-001). */
export interface ClaimInfo {
  key: string;
  label: string;
  description: string;
  examples: string[];
  keywords: string[];
  stimulus: string;
  magnitude: number;
  prior: number;
  /** Relaciones de `chat_relations` a las que se puede referir. */
  about: string[];
}

/** A quién se refiere el visitante (`chat_relations`, 044 R-001). */
export interface RelationInfo {
  key: string;
  label: string;
  resolve: string;
  closeness: number;
  keywords: string[];
}

export interface ChatCatalogs {
  tones: ToneInfo[];
  stances: StanceInfo[];
  /** Vacíos si no se cargan `chat_claims` y `chat_relations` (la charla funciona sin consecuencias). */
  claims: ClaimInfo[];
  relations: RelationInfo[];
  scripts: { key: string; label: string; turns: { text: string; tone: string }[] }[];
  /** Texto de cada episodio de desarrollo (041), para contar los recuerdos de infancia (013); vacío si no se carga. */
  memories: Record<string, string>;
  /** Nombre de cada tema del que se habla (025 `rumor_topics`, y las afirmaciones de la charla), para lo que cree de otros. */
  topics: Record<string, string>;
  /** La forma que recibe el motor (`@datas-world/engine`, `conversation/`). */
  engine: ChatCatalog;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' ? v : 0);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function chatCatalogs(c: {
  chat_tones: CatalogLike; chat_stances: CatalogLike; chat_scripts: CatalogLike; chat_claims?: CatalogLike; chat_relations?: CatalogLike;
  development_episodes?: CatalogLike; rumor_topics?: CatalogLike;
}): ChatCatalogs {
  const memories = Object.fromEntries((c.development_episodes?.entries ?? []).map((e) => [e.key, str(e.attrs?.text)]));
  const topics = Object.fromEntries([...(c.chat_claims?.entries ?? []), ...(c.rumor_topics?.entries ?? [])].map((e) => [e.key, e.name]));
  const tones = c.chat_tones.entries.map((e) => ({
    key: e.key, label: e.name, description: str(e.attrs?.description), examples: strs(e.attrs?.examples), keywords: strs(e.attrs?.keywords),
    stimulus: str(e.attrs?.stimulus), magnitude: num(e.attrs?.magnitude), prior: num(e.attrs?.prior),
  }));
  const stances = c.chat_stances.entries.map((e) => ({ key: e.key, label: e.name, guidance: str(e.attrs?.guidance), escape: num(e.attrs?.escape), w0: num(e.attrs?.w0) }));
  const scripts = c.chat_scripts.entries.map((e) => ({ key: e.key, label: e.name, turns: (e.attrs?.turns ?? []) as { text: string; tone: string }[] }));
  const claims = (c.chat_claims?.entries ?? []).map((e) => ({
    key: e.key, label: e.name, description: str(e.attrs?.description), examples: strs(e.attrs?.examples), keywords: strs(e.attrs?.keywords),
    stimulus: str(e.attrs?.stimulus), magnitude: num(e.attrs?.magnitude), prior: num(e.attrs?.prior), about: strs(e.attrs?.about),
  }));
  const relations = (c.chat_relations?.entries ?? []).map((e) => ({
    key: e.key, label: e.name, resolve: str(e.attrs?.resolve), closeness: num(e.attrs?.closeness), keywords: strs(e.attrs?.keywords),
  }));
  return {
    tones, stances, scripts, claims, relations, memories, topics,
    engine: {
      tones: tones.map(({ key, stimulus, magnitude, prior }) => ({ key, stimulus, magnitude, prior })),
      stances: stances.map(({ key, escape, w0 }) => ({ key, escape, w0 })),
      claims: claims.map(({ key, stimulus, magnitude, prior, about }) => ({ key, stimulus, magnitude, prior, about })),
      relations: relations.map(({ key, resolve, closeness }) => ({ key, resolve: resolve as RelationResolve, closeness })),
    },
  };
}
