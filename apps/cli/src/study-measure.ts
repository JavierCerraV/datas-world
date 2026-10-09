// Una toma de medidas del estudio (spec 047 R-007, R-008): para cada persona, lo verdadero (lo calcula el motor con su
// estado), lo que el motor decidió que dirá (según cuánto se sincera) y, si hay LLM, lo que dijo en la charla con la
// evaluadora. También los indicadores que el protocolo intenta mover, y sus episodios de rumia. No cambia el mundo.
import { INSTRUMENTS, createRng, dispose, indicatorsOf, scoreInstrument, truthfulResponses } from '@datas-world/engine';
import type { EntityId, InstrumentId, WorldEvent } from '@datas-world/engine';
import { administerBattery, buildPersonView, chatCatalogs, meteredGateway } from '@datas-world/llm-gateway';
import type { Gateway, ItemPlan } from '@datas-world/llm-gateway';
import { loadCatalogs } from '@datas-world/generators';
import { WorldRepository, openReadonly, queryEvents, trajectoryOf } from '@datas-world/persistence';
import { dateOf, withDb } from './common.ts';
import { reportFor } from './life.ts';
import type { LoadedWorld, UsageByPurpose } from './study-core.ts';

export const STUDY_INSTRUMENTS: readonly InstrumentId[] = ['AAQ-II', 'DASS-21', 'SWLS', 'GPQ-9'];

export interface ItemRow {
  n: number;
  truthful: number;
  /** Lo que el motor decidió que diría. */
  target: number;
  /** Lo que dijo (con LLM) o lo decidido por el motor (sin LLM). */
  said: number;
  disposition: string;
  reply?: string;
  source: 'llm' | 'corregida' | 'plantilla' | 'motor';
}

export interface InstrumentRow {
  truthful: number;
  target: number;
  said: number;
  /** Subescalas del DASS-21: verdadero y dicho. */
  subscales?: Record<string, { truthful: number; said: number }>;
  items: ItemRow[];
}

/** Indicadores del motor que el protocolo intenta mover (R-004), y el contexto de ánimo y estrés. */
export interface Mechanisms {
  selfFraming: number;
  avoidance: number;
  valueImportance: number;
  pnrRecent: number;
  mood: number;
  stress: number;
}

export interface Episode {
  at: number;
  date: string;
  trigger: string;
  steps: number;
  minutes: number;
  ended: string;
}

export interface Measure {
  citizenId: string;
  arm: string;
  take: number;
  label: string;
  day: number;
  date: string;
  /** Minuto del mundo de la toma. */
  minute: number;
  alive: boolean;
  /** Días que hizo la práctica hasta esta toma (`PRACTICE_DONE`, R-006). */
  practices: number;
  /** Si lo dicho pasó por el LLM o es lo que decidió el motor. */
  mode: 'llm' | 'motor';
  instruments: Record<string, InstrumentRow>;
  mechanisms?: Mechanisms;
  /** Todos sus episodios de rumia hasta la fecha de la toma (R-012). */
  episodes: Episode[];
  usage: UsageByPurpose;
}

const round = (x: number) => Math.round(x * 1000) / 1000;

export interface TakeOptions {
  /** Base del brazo (se abre en solo lectura). */
  db: string;
  /** El mundo ya cargado, si lo hay: solo hace falta para la charla con el LLM. */
  loaded?: LoadedWorld;
  ids: readonly string[];
  arm: string;
  take: number;
  label: string;
  day: number;
  instruments: readonly InstrumentId[];
  /** Con pasarela, la persona responde con el LLM; sin ella, vale lo que decidió el motor. */
  gateway?: Gateway;
  /** Con un proveedor real, que el LLM no responda es un fallo y no un dato. */
  strict?: boolean;
}

/** Mide a las personas en el estado actual de la base. Las dos ramas usan el mismo azar de medida (mismo ruido). */
export async function takeMeasures(o: TakeOptions): Promise<Measure[]> {
  const base = withDb(openReadonly(o.db), (db) => {
    const world = o.loaded?.world ?? new WorldRepository(db).loadWorld();
    return {
      world,
      per: new Map(o.ids.map((id) => [id, {
        alive: world.citizens.get(id as EntityId)?.status === 'active',
        events: queryEvents(db, { participant: id as EntityId, limit: 1_000_000 }) as WorldEvent[],
        trajectory: trajectoryOf(db, id),
        profile: reportFor(world, db, id as EntityId).profile,
      }])),
    };
  });
  const { world } = base;
  const root = createRng(world.config.seed);
  const date = dateOf(world.now, world.config.epoch);
  const cats = o.gateway ? chatCatalogs(loadCatalogs()) : undefined;
  return Promise.all(o.ids.map(async (id): Promise<Measure> => {
    const info = base.per.get(id)!;
    const head = {
      citizenId: id, arm: o.arm, take: o.take, label: o.label, day: o.day, date, minute: world.now, mode: (o.gateway ? 'llm' : 'motor') as Measure['mode'],
      practices: info.events.filter((e) => e.type === 'PRACTICE_DONE').length,
    };
    const episodes = info.events.filter((e) => e.type === 'PNR_EPISODE' && (e.payload as { citizenId?: string }).citizenId === id).map((e): Episode => {
      const p = e.payload as { trigger: string; steps: number; minutes: number; ended: string };
      return { at: e.at, date: dateOf(e.at, world.config.epoch), trigger: p.trigger, steps: p.steps, minutes: p.minutes, ended: p.ended };
    });
    if (!info.alive) return { ...head, alive: false, instruments: {}, episodes, usage: {} };
    const ind = indicatorsOf({ world, id: id as EntityId, profile: info.profile, trajectory: info.trajectory, events: info.events });
    // Lo verdadero y cuánto se sincera salen del motor; el LLM solo lo expresa (046 R-011, R-012).
    const truth = Object.fromEntries(o.instruments.map((k) => [k, truthfulResponses(k, ind, root.fork(`measure:${k}:${id}:${o.take}`))]));
    const shown = Object.fromEntries(o.instruments.map((k) => [k, dispose(k, truth[k]!.t, ind, root.fork(`measure:candor:${id}:${o.take}:${k}`), 0)]));
    const plans = Object.fromEntries(o.instruments.map((k) => [k, truth[k]!.t.map((_, i): ItemPlan => ({ n: i + 1, target: shown[k]!.r[i]!, disposition: shown[k]!.disposition[i]! }))]));

    let answers: Awaited<ReturnType<typeof administerBattery>> | undefined;
    let usage: UsageByPurpose = {};
    if (o.gateway && o.loaded && cats) {
      const meter = meteredGateway(o.gateway);
      const pv = buildPersonView({ view: world, citizenId: id, now: world.now, events: o.loaded.events, memoryText: (k) => cats.memories?.[k], topicText: (k) => cats.topics?.[k] });
      answers = await administerBattery(meter.gateway, pv, o.instruments.map((k) => ({ ins: INSTRUMENTS[k], plan: plans[k]! })));
      usage = meter.usage();
      const flat = o.instruments.flatMap((k) => answers![k] ?? []);
      const bad = flat.filter((a) => a.source === 'plantilla');
      if (o.strict && bad.length > 0.15 * flat.length) throw new Error(`el LLM no respondió las pruebas de ${id} (${bad[0]!.why ?? 'sin motivo'})`);
    }

    const instruments: Record<string, InstrumentRow> = {};
    for (const k of o.instruments) {
      const t = truth[k]!.t, target = shown[k]!.r;
      const said = answers ? answers[k]!.map((a) => a.option) : target;
      const st = scoreInstrument(k, t), ss = scoreInstrument(k, said);
      instruments[k] = {
        truthful: st.total, target: scoreInstrument(k, target).total, said: ss.total,
        ...(st.subscales ? { subscales: Object.fromEntries(Object.keys(st.subscales).map((s) => [s, { truthful: st.subscales![s]!, said: ss.subscales![s]! }])) } : {}),
        items: t.map((x, i): ItemRow => ({
          n: i + 1, truthful: x, target: target[i]!, said: said[i]!, disposition: shown[k]!.disposition[i]!,
          ...(answers ? { reply: answers[k]![i]!.reply, source: answers[k]![i]!.source } : { source: 'motor' as const }),
        })),
      };
    }
    const mechanisms: Mechanisms = {
      selfFraming: round(ind.selfFraming), avoidance: round(ind.avoidance), valueImportance: round(ind.valueImportance), pnrRecent: round(ind.pnrRecent), mood: round(ind.mood), stress: round(ind.stress),
    };
    return { ...head, alive: true, instruments, mechanisms, episodes, usage };
  }));
}
