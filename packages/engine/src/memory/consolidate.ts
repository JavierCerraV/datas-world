// Capítulos (spec 013 R-010) y consolidación de episodios repetidos en relaciones de la red (R-009). Puro y sin azar.
import type { EntityId } from '../ids.ts';
import { teach } from '../relations/network.ts';
import type { RelationalNetwork } from '../relations/types.ts';
import { r3 } from './episodes.ts';
import type { Chapter, Memory, MemoryParams, MemoryStore } from './types.ts';

const numberOf = (id: string) => Number(id.slice(4));

/** R-010: cierra el capítulo abierto y abre otro. Devuelve el cerrado (si lo había) y el nuevo. */
export function openChapter(store: MemoryStore, theme: string, at: number, tone: number, openedBy?: EntityId, anchor?: Memory): { closed?: Chapter; opened: Chapter } {
  const closed = store.chapters.find((c) => c.to === undefined);
  if (closed) closed.to = at;
  const opened: Chapter = { id: `CHP-${store.next++}`, from: at, theme, tone: r3(tone), anchors: anchor ? [anchor.id] : [], ...(openedBy ? { openedBy } : {}) };
  store.chapters.push(opened);
  if (anchor) anchor.chapter = opened.id;
  return { ...(closed ? { closed } : {}), opened };
}

/**
 * R-010: el tono de cada capítulo es la media de la valencia actual (reconstruida) de sus episodios; sus anclas, los
 * 3 más intensos. Por encima del tope sale de la persona el más antiguo cerrado (queda su `CHAPTER_OPENED` en el
 * registro).
 */
export function updateChapters(store: MemoryStore, p: MemoryParams): void {
  for (const c of store.chapters) {
    const mine = store.episodes.filter((m) => m.chapter === c.id);
    if (mine.length === 0) continue;
    c.tone = r3(mine.reduce((s, m) => s + m.valence, 0) / mine.length);
    c.anchors = [...mine].sort((a, b) => b.intensity - a.intensity || numberOf(a.id) - numberOf(b.id)).slice(0, 3).map((m) => m.id);
  }
  while (store.chapters.length > p.maxChapters) {
    const oldest = store.chapters.filter((c) => c.to !== undefined).sort((a, b) => a.from - b.from)[0];
    if (!oldest) break;
    store.chapters = store.chapters.filter((c) => c !== oldest);
  }
}

/** Signo de cada consecuencia (para saber qué episodios contradicen una relación consolidada). */
const US_SIGN: Readonly<Record<string, number>> = Object.freeze({
  'verbal.critica': -1, 'verbal.amenaza': -1, 'cuerpo.dolor': -1, 'verbal.aprobacion': 1, 'verbal.dinero': 1, 'cuerpo.disfrute': 1,
});

/** El estímulo principal de un episodio: la primera persona o, si no hay, el lugar. */
const mainOf = (m: Memory) => m.stims.find((s) => s.startsWith('cit.')) ?? m.stims.find((s) => s.startsWith('lugar.'));

export interface SchemaChange {
  a: string;
  b: string;
  before: number;
  after: number;
  created: boolean;
  events: EntityId[];
}

/**
 * R-009: los episodios repetidos con lo mismo presente y la misma consecuencia se generalizan en la relación
 * `principal causes consecuencia` de la red (037, origen observado). Se crea con `SCHEMA_MIN` episodios, cada uno
 * nuevo la refuerza `SCHEMA_GAIN × (1 − s)` y uno de signo contrario la debilita a la mitad de ese ritmo. Marca los
 * episodios que ya contaron.
 */
export function consolidate(store: MemoryStore, net: RelationalNetwork, now: number, p: MemoryParams): SchemaChange[] {
  const changes: SchemaChange[] = [];
  const find = (a: string, b: string) => net.e.find((r) => r.a === a && r.b === b && r.t === 'causes' && r.crel === undefined);
  const note = (a: string, b: string, before: number, after: number, created: boolean, ms: Memory[]) =>
    changes.push({ a, b, before: r3(before), after: r3(after), created, events: [...new Set(ms.flatMap((m) => (m.event ? [m.event] : [])))].slice(-3) });
  const pending = store.episodes.filter((m) => !m.sch && m.us && mainOf(m));
  for (const m of pending) {
    const a = mainOf(m)!;
    const b = m.us!;
    const r = find(a, b);
    if (r) {
      const before = r.s;
      r.s = r3(Math.min(1, r.s + p.schemaGain * (1 - r.s)));
      r.at = now;
      if (m.event && !r.src.includes(m.event)) r.src = [...r.src, m.event].slice(-3);
      m.sch = 1;
      if ((before < 0.5) !== (r.s < 0.5)) note(a, b, before, r.s, false, [m]);
      continue;
    }
    const group = store.episodes.filter((x) => x.us === b && mainOf(x) === a);
    if (group.length < p.schemaMin) continue;
    const s = r3(1 - Math.pow(1 - p.schemaGain, group.length));
    const rel = teach(net, { a, b, t: 'causes', s, now });
    rel.s = s;
    rel.o = 'observed';
    rel.src = [...new Set(group.flatMap((x) => (x.event ? [x.event as string] : [])))].slice(-3);
    for (const x of group) x.sch = 1;
    note(a, b, 0, s, true, group);
  }
  // Lo que contradice: un episodio con la misma persona o lugar y una consecuencia de signo contrario.
  for (const m of store.episodes) {
    if (m.sch || !mainOf(m)) continue;
    const a = mainOf(m)!;
    const sign = Math.sign(m.lambda);
    for (const r of net.e) {
      if (r.a !== a || r.t !== 'causes' || (US_SIGN[r.b] ?? 0) !== -sign || sign === 0) continue;
      const before = r.s;
      r.s = r3(Math.max(0, r.s - (p.schemaGain / 2) * r.s));
      if ((before < 0.5) !== (r.s < 0.5)) note(a, r.b, before, r.s, false, [m]);
    }
    m.sch = 1;
  }
  return changes;
}
