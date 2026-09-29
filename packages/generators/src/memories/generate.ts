// Memoria de partida (spec 013 R-002, R-010): con qué recuerdos y capítulos llega cada persona al día 0. Los recuerdos
// salen de su desarrollo (041, desde los 4 años) y de los hechos de su historia (030), con la saliencia que les dan sus
// funciones de hoy y ya olvidados en parte según su antigüedad (ley de potencia de la 013 R-004).
import {
  MEMORY_DEFAULTS, MEMORY_KINDS, addMemory, directValue, emptyMemory, encodeEvent, episodeValue, learningParams, makeEvent, openChapter,
  personStimulus, retention, trimMemory, updateChapters,
} from '@datas-world/engine';
import type { DevelopmentEpisode, EntityId, MemoryParams, MemoryStore, Memory, Ontology, World, WorldEvent, WorldView } from '@datas-world/engine';
import type { Catalogs } from '../catalogs/load.ts';
import { episodeDefs } from '../development/catalog.ts';
import type { EpisodeDef } from '../development/catalog.ts';
import { ROLE_STIM } from '../development/generate.ts';

const DAY = 1440;
const YEAR = 365.25 * DAY;
/** [M] (PA-147): episodios del desarrollo que se recuerdan por año de vida, desde los 4 años (amnesia infantil). */
export const DEV_PER_YEAR = 2;
export const FIRST_MEMORY_AGE = 4;
/** [M] Veces que se ha vuelto a contar o pensar un recuerdo antiguo: lo de la infancia, más que lo reciente. */
const RETOLD_CHILDHOOD = 2;
const RETOLD_ADULT = 1;
/** [M] Recuerdos de partida por tipo de episodio o hecho (lo repetido se recuerda como uno genérico). */
const PER_KIND = 2;

/** Consecuencia de un episodio del desarrollo: lo que emparejó y enseñó, más su valencia de catálogo. */
const lambdaOf = (d: EpisodeDef) =>
  Math.max(-1, Math.min(1, 0.3 * d.valence + d.effects.reduce((s, e) => s + (e.op === 'pair' || e.op === 'value' ? e.lambda : 0), 0)));

/** Quién recuerda un hecho de la historia: como en la vida diaria, salvo la muerte (su familia directa, por genealogía). */
function remembers(world: World, e: WorldEvent, id: EntityId): boolean {
  if (e.type === 'CITIZEN_DIED') {
    const dead = (e.payload as { citizenId: EntityId }).citizenId;
    const me = world.citizens.get(id)!;
    const d = world.citizens.get(dead);
    return dead !== id && (me.motherId === dead || me.fatherId === dead || d?.motherId === id || d?.fatherId === id
      || (!!me.motherId && me.motherId === d?.motherId) || !!world.households.get(me.householdId!)?.kinship.some((k) => k.kind === 'partner' && (k.from === dead || k.to === dead) && (k.from === id || k.to === id)));
  }
  const kind = MEMORY_KINDS[e.type];
  if (!kind) return false;
  if (kind.who) return kind.who(e, world as unknown as WorldView).includes(id);
  return e.participants.some((p) => p.id === id);
}

export function seedMemories(world: World, citizenIds: readonly EntityId[], prior: readonly WorldEvent[], catalogs: Catalogs, onto: Ontology, p: MemoryParams = MEMORY_DEFAULTS): { events: WorldEvent[] } {
  const defs = new Map(episodeDefs(catalogs.development_episodes).map((d) => [d.key, d]));
  const P = learningParams(world.config.profile, world.config.epoch.slice(0, 10));
  const view = world as unknown as WorldView;
  const now = world.now;
  const living = [...citizenIds].filter((id) => world.citizens.get(id)?.status === 'active' && !world.citizens.get(id)?.ancestor).sort();
  const years = new Map<string, WorldEvent[]>();
  for (const e of prior) if (e.type === 'DEVELOPMENT_YEAR') {
    const id = (e.payload as { citizenId: string }).citizenId;
    years.set(id, [...(years.get(id) ?? []), e]);
  }
  const history = prior.filter((e) => e.at < 0 && (MEMORY_KINDS[e.type] || e.type === 'CITIZEN_DIED')).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  const events: WorldEvent[] = [];

  for (const id of living) {
    const person = world.citizens.get(id)!;
    const birth = world.components.i32['demo.birthMinute']?.[Number(id.slice(4))] ?? 0;
    const fn = (s: string) => directValue(person.functions, onto, s, '', now, P);
    const store: MemoryStore = emptyMemory();
    const candidates: Omit<Memory, 'id'>[] = [];
    const devValues: { at: number; v: number }[] = [];
    // Desarrollo: los episodios más salientes de cada año desde los 4.
    for (const y of years.get(id) ?? []) {
      const { age, episodes } = y.payload as { age: number; episodes: DevelopmentEpisode[] };
      const scored = episodes.flatMap((ep) => {
        const d = defs.get(ep[1]);
        if (!d) return [];
        const stims = [ROLE_STIM[ep[2]] ?? `rol.${ep[2]}`, ...(ep[3] && ep[3] !== id && world.citizens.get(ep[3] as EntityId) && !world.citizens.get(ep[3] as EntityId)!.ancestor ? [personStimulus(ep[3])] : []),
          ...ep[6].slice(0, 1).map(([k]) => k)].slice(0, 4);
        const lambda = lambdaOf(d);
        const v = episodeValue(lambda, stims, fn);
        devValues.push({ at: ep[0], v });
        return [{ ep, stims, lambda, v, s: Math.abs(v) * 0.75 }];
      });
      if (age < FIRST_MEMORY_AGE) continue;
      for (const x of scored.sort((a, b) => b.s - a.s || a.ep[0] - b.ep[0] || (a.ep[1] < b.ep[1] ? -1 : 1)).slice(0, DEV_PER_YEAR)) {
        const intensity = x.s * retention((now - x.ep[0]) / DAY, x.v, RETOLD_CHILDHOOD, p);
        if (x.s < p.encodeMin || intensity < p.forget) continue;
        const r3 = (n: number) => Math.round(n * 1000) / 1000;
        candidates.push({
          event: y.id, at: x.ep[0], source: 'lived', kind: x.ep[1], stims: x.stims, lambda: r3(x.lambda), valence: r3(x.v), valence0: r3(x.v),
          intensity: r3(intensity), rehearsals: RETOLD_CHILDHOOD,
        });
      }
    }
    // Hechos de su historia (030): estudios, migración, unión, hijos, muertes, empleos.
    const mine = history.filter((e) => remembers(world, e, id));
    const scratch = emptyMemory();
    for (const e of mine) {
      // Amnesia infantil también para los hechos: antes de los 4 años se sabe (se lo contaron), no se recuerda.
      if (e.at - birth < FIRST_MEMORY_AGE * YEAR) continue;
      const m = encodeEvent(scratch, e, id, view, fn, { ...p, encodeMin: 0 });
      if (!m) continue;
      const intensity = m.intensity * retention((now - e.at) / DAY, m.valence, RETOLD_ADULT, p);
      if (m.intensity < p.encodeMin || intensity < p.forget) continue;
      candidates.push({
        ...(m.event ? { event: m.event } : {}), at: m.at, source: m.source, kind: m.kind, stims: m.stims, ...(m.us ? { us: m.us } : {}),
        lambda: m.lambda, valence: m.valence, valence0: m.valence0, intensity: Math.round(intensity * 1000) / 1000, rehearsals: RETOLD_ADULT,
      });
    }
    // Lo que se repitió se funde en un recuerdo genérico: de cada tipo quedan los `PER_KIND` más intensos.
    const kept = new Map<string, Omit<Memory, 'id'>[]>();
    for (const c of candidates) kept.set(c.kind, [...(kept.get(c.kind) ?? []), c]);
    const chosen = [...kept.values()].flatMap((xs) => xs.sort((a, b) => b.intensity - a.intensity || a.at - b.at).slice(0, PER_KIND));
    for (const c of chosen.sort((a, b) => a.at - b.at || (a.kind < b.kind ? -1 : 1))) addMemory(store, c);

    // Capítulos (R-010): etapas de la edad y hechos que cambian el rol, el lugar o el vínculo principal.
    const marks: { at: number; theme: string; cause?: WorldEvent }[] = [
      { at: birth, theme: 'infancia' }, { at: birth + 12 * YEAR, theme: 'adolescencia' }, { at: birth + 18 * YEAR, theme: 'juventud' },
    ];
    const once = new Set<string>();
    for (const e of mine) {
      const theme = MEMORY_KINDS[e.type]?.theme;
      if (!theme || ((theme === 'trabajo' || theme === 'crianza') && once.has(theme))) continue;
      once.add(theme);
      marks.push({ at: e.at, theme, cause: e });
    }
    const timeline = marks.filter((m) => m.at < now).sort((a, b) => a.at - b.at);
    // Dos cambios en menos de medio año son uno: queda el segundo.
    const merged = timeline.filter((m, i) => !(timeline[i + 1] && timeline[i + 1]!.at - m.at < 182 * DAY));
    for (const m of merged) {
      const opened = openChapter(store, m.theme, m.at, 0, m.cause?.id).opened;
      const next = merged[merged.indexOf(m) + 1]?.at ?? Infinity;
      for (const ep of store.episodes) if (ep.at >= m.at && ep.at < next) ep.chapter = opened.id;
      // Sin episodios recordados, el tono sale de lo vivido en ese tramo (su desarrollo).
      const lived = devValues.filter((x) => x.at >= m.at && x.at < next);
      opened.tone = lived.length ? Math.round((lived.reduce((s, x) => s + x.v, 0) / lived.length) * 1000) / 1000 : 0;
    }
    // Todos los capítulos quedan en el registro; en la persona, los `MAX_CHAPTERS` más recientes.
    updateChapters(store, { ...p, maxChapters: Infinity });
    trimMemory(store, now, p);
    for (const c of [...store.chapters]) {
      const at = Math.min(c.from, now - 1);
      events.push(makeEvent(world.counters, at, {
        type: 'CHAPTER_OPENED',
        payload: { citizenId: id, theme: c.theme, tone: c.tone },
        causes: c.openedBy ? [{ event: c.openedBy, weight: 1 }] : [{ state: `etapa.${c.theme}`, entity: id, weight: 1 }],
        participants: [{ id, role: 'persona' }],
      }));
    }
    updateChapters(store, p);
    person.memory = store;
  }
  return { events };
}
