// Piezas del Resumen del expediente (spec 024 R-027, CA-020): el mazo de conducta, «por qué decidió esto» (las fuentes
// de control de la última decisión y su cadena causal) y el camino de vida. Formateo puro a partir de lo que ya
// entrega la API (ficha y expediente): nada se inventa; lo que falta se muestra bloqueado.
import { esc } from './card-compact.ts';
import type { Dossier } from './dossier-types.ts';
import type { ExpData } from './exp-tabs.ts';
import { evText } from './exp-tabs.ts';
import { SOURCE_ES, stimulusEs } from './format.ts';
import { icon, responseIcon } from './icons.ts';
import { milestones } from './lifecourse.ts';
import type { Milestone } from './lifecourse.ts';
import type { Cause, CitizenDetail, EventView } from './types.ts';
import { whyToggle } from './why.ts';

// ---------- Mazo de conducta ----------

export interface DeckCard {
  response: string;
  label: string;
  /** Fuerza aprendida, de 0 a 9 (la gota de elixir). */
  cost: number;
  rarity: 'c' | 'r' | 'e' | 'l';
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const rarityOf = (s: number): DeckCard['rarity'] => (s >= 0.8 ? 'l' : s >= 0.6 ? 'e' : s >= 0.4 ? 'r' : 'c');

/** CA-020: las conductas con más fuerza aprendida, en orden estable (de más a menos fuerte y, si empatan, por nombre). */
export function deckOf(responses: CitizenDetail['responses'], n = 8): DeckCard[] {
  return [...responses]
    .sort((a, b) => b.strength - a.strength || (a.response < b.response ? -1 : a.response > b.response ? 1 : 0))
    .slice(0, n)
    .map((r) => ({ response: r.response, label: stimulusEs(r.response), cost: Math.round(clamp01(r.strength) * 9), rarity: rarityOf(r.strength) }));
}

export function deckHtml(responses: CitizenDetail['responses']): string {
  const cards = deckOf(responses);
  if (!cards.length) return '<p class="empty">Sin conductas aprendidas todavía.</p>';
  const one = (c: DeckCard) => `<div class="dcard r-${c.rarity}" title="${esc(c.label)} · fuerza ${c.cost} de 9"><span class="cost">${icon('drop', 30, 'var(--dw-elixir)')}<b>${c.cost}</b></span><div class="art">${icon(responseIcon(c.response), 34, 'var(--dw-white)')}</div><div class="nm">${esc(c.label)}</div></div>`;
  return `<div class="deck">${cards.map(one).join('')}</div><p class="note">El número es la fuerza aprendida de cada conducta (0 a 9).</p>`;
}

// ---------- Por qué decidió esto ----------

export interface SourceShare {
  source: string;
  label: string;
  /** Porcentaje entero; todos suman 100. */
  pct: number;
  refs: string[];
}

/** Reparte 100 entre los pesos con el método del mayor resto, para que la suma sea exacta. */
export function percentages(weights: readonly number[]): number[] {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (w / total) * 100);
  const base = raw.map(Math.floor);
  let left = 100 - base.reduce((s, b) => s + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left-- <= 0) break;
    base[i]!++;
  }
  return base;
}

/** Las fuentes de control de una decisión (040 R-006): sus causas `fuente.<fuente>:<ref>` agrupadas por fuente. */
export function sourceShares(causes: readonly Cause[]): SourceShare[] {
  const by = new Map<string, { w: number; refs: string[] }>();
  for (const c of causes) {
    if (!('state' in c) || !c.state.startsWith('fuente.')) continue;
    const [head, ref] = c.state.split(':');
    const source = head!.slice(7);
    const cur = by.get(source) ?? { w: 0, refs: [] };
    cur.w += Math.abs(c.weight);
    if (ref) cur.refs.push(stimulusEs(ref));
    by.set(source, cur);
  }
  const list = [...by.entries()].sort((a, b) => b[1].w - a[1].w || (a[0] < b[0] ? -1 : 1));
  const pct = percentages(list.map(([, v]) => v.w));
  return list.map(([source, v], i) => ({ source, label: SOURCE_ES[source] ?? source, pct: pct[i]!, refs: [...new Set(v.refs)] }));
}

/** La última decisión registrada: el evento más reciente cuyas causas citan fuentes de control. */
export function lastDecision<T extends EventView>(events: readonly T[]): { event: T; shares: SourceShare[] } | null {
  let best: T | null = null;
  for (const e of events) {
    if (!e.causes.some((c) => 'state' in c && c.state.startsWith('fuente.'))) continue;
    if (!best || e.at > best.at || (e.at === best.at && e.id > best.id)) best = e;
  }
  return best ? { event: best, shares: sourceShares(best.causes) } : null;
}

/** Los hechos anteriores que citan las causas del evento, del más cercano al más lejano, con su tipo. */
export function chainOf(event: EventView, known: readonly EventView[], max = 4): string[] {
  const byId = new Map(known.map((e) => [e.id, e]));
  const out: string[] = [event.type];
  for (const c of event.causes) {
    if (!('event' in c) || out.length > max) continue;
    out.push(byId.get(c.event)?.type ?? c.event);
  }
  return out;
}

export function decisionHtml(x: ExpData): string {
  const known = [...x.dos.events, ...x.dos.why];
  const last = lastDecision(known);
  if (!last) return '<p class="empty">Aún no hay decisiones registradas con sus fuentes de control.</p>';
  const { event, shares } = last;
  const bar = shares.map((s) => `<i class="src src-${esc(s.source)}" style="width:${s.pct}%" title="${esc(s.label)} · ${s.pct} %"></i>`).join('');
  const legend = shares.map((s) => `<span class="tag"><i class="swatch src-${esc(s.source)}"></i>${esc(s.label)}${s.refs.length ? ` · ${esc(s.refs.slice(0, 2).join(', '))}` : ''} ${s.pct} %</span>`).join('');
  const chain = chainOf(event, known).map((t, i) => `${i ? '<span class="muted" aria-hidden="true">←</span>' : ''}<span class="tag${i ? '' : ' gold'}">${esc(t)}</span>`).join('');
  return `<p class="decision"><span class="mono">${esc(event.date)}</span> ${evText(event)}</p>`
    + `<div class="srcbar" role="img" aria-label="Fuentes de control de la decisión">${bar}</div><div class="tags">${legend}</div>`
    + `<div class="sep"></div><b class="chain-title">Cadena causal</b><div class="chain">${chain}</div>${whyToggle(event.id)}`;
}

// ---------- Camino de vida ----------

export const STAGES = [
  { id: 'I', name: 'Infancia', from: 0, to: 12 },
  { id: 'II', name: 'Adolescencia', from: 13, to: 17 },
  { id: 'III', name: 'Adultez joven', from: 18, to: 29 },
  { id: 'IV', name: 'Adultez', from: 30, to: 59 },
  { id: 'V', name: 'Vejez', from: 60, to: 130 },
] as const;

export interface RoadStage {
  id: string;
  name: string;
  range: string;
  state: 'past' | 'now' | 'locked';
  items: Milestone[];
}

/** El camino de vida: una etapa por tramo de edad con sus hitos; la actual se marca y las futuras quedan bloqueadas. */
export function lifeRoad(dos: Dossier, age: number): RoadStage[] {
  const born = Number(dos.identity.birthDate.slice(0, 4));
  const ms = milestones(dos);
  return STAGES.map((s) => {
    const items = ms.filter((m) => m.year - born >= s.from && m.year - born <= s.to).sort((a, b) => a.at - b.at);
    const state: RoadStage['state'] = age > s.to ? 'past' : age >= s.from ? 'now' : 'locked';
    return { id: s.id, name: s.name, range: s.to >= 130 ? `${s.from}+` : `${s.from}–${s.to}`, state, items };
  });
}

export function roadHtml(dos: Dossier, age: number): string {
  const node = (s: RoadStage) => {
    const body = s.state === 'locked'
      ? '<span class="muted">Aún sin vivir</span>'
      : s.items.length
        ? s.items.slice(-3).map((m) => `<span class="ms ms-${m.tone}">${esc(m.label)}</span>`).join('')
        : '<span class="muted">Sin hitos registrados</span>';
    const head = `<div class="row"><span class="fd">${s.id} · ${esc(s.name)}</span><span class="muted">${esc(s.range)} años</span><span class="grow"></span>${s.state === 'locked' ? icon('lock', 16, 'var(--line-2)') : s.state === 'now' ? '<span class="tag gold">Hoy</span>' : ''}</div>`;
    return `<div class="nd ${s.state === 'locked' ? 'lock' : ''}">${head}<div class="ms-list">${body}</div></div>`;
  };
  return `<div class="road">${lifeRoad(dos, age).map(node).join('')}</div>`;
}
