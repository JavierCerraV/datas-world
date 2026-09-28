// Catálogos de la charla (043 §3) en la forma que usan el motor y la pasarela. Llegan ya cargados y validados
// (`@datas-world/generators`, `loadCatalogs`); aquí solo se leen sus atributos.
import type { ChatCatalog } from '@datas-world/engine';

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

export interface ChatCatalogs {
  tones: ToneInfo[];
  stances: StanceInfo[];
  scripts: { key: string; label: string; turns: { text: string; tone: string }[] }[];
  /** La forma que recibe el motor (`@datas-world/engine`, `conversation/`). */
  engine: ChatCatalog;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' ? v : 0);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function chatCatalogs(c: { chat_tones: CatalogLike; chat_stances: CatalogLike; chat_scripts: CatalogLike }): ChatCatalogs {
  const tones = c.chat_tones.entries.map((e) => ({
    key: e.key, label: e.name, description: str(e.attrs?.description), examples: strs(e.attrs?.examples), keywords: strs(e.attrs?.keywords),
    stimulus: str(e.attrs?.stimulus), magnitude: num(e.attrs?.magnitude), prior: num(e.attrs?.prior),
  }));
  const stances = c.chat_stances.entries.map((e) => ({ key: e.key, label: e.name, guidance: str(e.attrs?.guidance), escape: num(e.attrs?.escape), w0: num(e.attrs?.w0) }));
  const scripts = c.chat_scripts.entries.map((e) => ({ key: e.key, label: e.name, turns: (e.attrs?.turns ?? []) as { text: string; tone: string }[] }));
  return {
    tones, stances, scripts,
    engine: {
      tones: tones.map(({ key, stimulus, magnitude, prior }) => ({ key, stimulus, magnitude, prior })),
      stances: stances.map(({ key, escape, w0 }) => ({ key, escape, w0 })),
    },
  };
}
