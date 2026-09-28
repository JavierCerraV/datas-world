// Sistema `private` (spec 039): en la fase `memory`, después del aprendizaje, los hechos aversivos del tick disparan
// pensamientos; con carga suficiente empieza un episodio de PNR, que avanza por derivación hasta que baja la carga,
// la persona lo corta evitando (se refuerza por el alivio) o toma distancia con «Yo» (se refuerza si hay valor).
// Solo se tocan las personas con algo activo. Azar: el del sistema, por fila (`sys:private`).
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import type { NewEvent } from '../events.ts';
import { directValue, operant, pair } from '../functions/learn.ts';
import { EVENT_LEARNING } from '../functions/rules.ts';
import { sensitivityOf } from '../functions/sensitivity.ts';
import { learners, learningParams, storeOf } from '../functions/system.ts';
import type { FunctionStore, LearningParams, Ontology, Sensitivity } from '../functions/types.ts';
import { formatId } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import { functionalValue } from '../relations/derive.ts';
import { relationalNetworkOf } from '../relations/system.ts';
import type { RelationalNetwork } from '../relations/types.ts';
import type { Rng } from '../rng.ts';
import { DOMAIN_PREFIX } from '../rules/values.ts';
import type { Patch, System, SystemEvent, SystemOutput, TickCtx, WorldView } from '../simulation/system.ts';
import { AVOIDANCE_W0, PRIVATE_DEFAULTS, SELF_RESPONSE } from './params.ts';
import type { AvoidanceResponse, PrivateParams } from './params.ts';
import { activate, applyStep, consolidate, derivationStep, fade, focusOf, loadOf, rawLoadOf, responseStrength, scale, seedResponse } from './pnr.ts';
import type { EpisodeEnd, MindState } from './types.ts';

const round = (x: number) => Math.round(x * 1000) / 1000;

/** R-004 (PA-117): qué actividad del mundo es una respuesta de evitación al emitirse durante un episodio. */
export function avoidanceOf(activity: number): AvoidanceResponse | undefined {
  if (activity === ACTIVITY.sleep) return 'evit.dormir';
  if (activity === ACTIVITY.leisure || activity === ACTIVITY.exercise) return 'evit.distraccion';
  return undefined;
}

/** R-007: hay reforzadores de valor a su alcance si algún dominio vital tiene función apetitiva aprendida (038). */
const hasValue = (store: FunctionStore) => store.f.some((f) => f.s.startsWith(DOMAIN_PREFIX) && f.v > 0);

export interface MindTick {
  mind: MindState;
  store: FunctionStore;
  net: RelationalNetwork;
  storeChanged: boolean;
  netChanged: boolean;
  events: NewEvent[];
}

/** Lo que el núcleo lee de la persona y del momento (sin el mundo: lo usa también el laboratorio, 042 V-10). */
export interface MindCtx {
  id: EntityId;
  onto: Ontology;
  P: LearningParams;
  sens: Sensitivity;
  now: number;
  tickMinutes: number;
  /** Nivel de simulación (021): el pensamiento derivado solo se registra en ≥ 4. */
  level: number;
  /** Actividad actual (código de `act.kind`). */
  act: number;
}

/** Un tick de la mente de una persona en su propio mundo. Sin nada activo ni disparos, no hace nada. */
export function mindTick(
  view: WorldView, row: number, ctx: TickCtx, onto: Ontology, rng: Rng, p: PrivateParams,
  triggers: readonly { s: string; cause: string }[],
): MindTick | undefined {
  const id = formatId('CIT', row) as EntityId;
  const prev = view.citizens.get(id)?.mind as MindState | undefined;
  if (!prev?.active.length && !prev?.episode && triggers.length === 0) return undefined;
  const mind: MindState = JSON.parse(JSON.stringify(prev ?? { active: [] })) as MindState;
  const store = storeOf(view, row);
  const net = relationalNetworkOf(view, row);
  const c: MindCtx = {
    id, onto, P: learningParams(view.config.profile, view.config.epoch.slice(0, 10)), sens: sensitivityOf(view, row), now: ctx.now,
    tickMinutes: view.config.tickMinutes, level: ctx.level(row), act: view.components.u8[ACTIVITY_COLUMN]?.[row] ?? 0,
  };
  return { mind, store, net, ...stepMind(mind, store, net, c, triggers, rng, p) };
}

/**
 * El núcleo de un tick de la mente (muta `mind`, `store` y `net`; puro salvo el `rng`): disparo (R-001), episodio
 * (R-002, R-003), evitación (R-004), consolidación (R-005) y «Yo» (R-006, R-007).
 */
export function stepMind(
  mind: MindState, store: FunctionStore, net: RelationalNetwork, c: MindCtx, triggers: readonly { s: string; cause: string }[], rng: Rng, p: PrivateParams,
): { storeChanged: boolean; netChanged: boolean; events: NewEvent[] } {
  const { id, onto, P, sens, now, act } = c;
  const directOf = (s: string) => directValue(store, onto, s, '', now, P);
  const events: NewEvent[] = [];
  let storeChanged = false;
  let netChanged = false;

  // R-001: cada hecho aversivo del tick activa el pensamiento de su estímulo con la función que ya tiene para ella.
  for (const t of triggers) {
    const fn = functionalValue(net, directOf, t.s).value;
    if (fn < -p.minFn) activate(mind, { s: t.s, fn, from: t.s, at: now, cause: t.cause }, p);
  }

  const who = [{ id, role: 'persona' }];
  const end = (how: EpisodeEnd) => {
    const ep = mind.episode!;
    if (ep.steps >= p.minSteps) {
      events.push({
        type: 'PNR_EPISODE',
        payload: { citizenId: id, trigger: ep.trigger, steps: ep.steps, minutes: now - ep.startedAt, ended: how, peak: round(ep.peak) },
        causes: [
          ...(ep.cause ? [{ event: ep.cause as EntityId, weight: 1 }] : []),
          ...[...new Set(ep.edges)].slice(0, 3).map((k) => ({ state: `fuente.red:${net.e[k]?.a ?? '?'}→${net.e[k]?.b ?? '?'}`, entity: id, weight: 0.3 })),
        ],
        participants: who,
      });
    }
    delete mind.episode;
  };

  if (!mind.episode && loadOf(mind) >= p.pnrEnter && act !== ACTIVITY.sleep) {
    const focus = focusOf(mind)!;
    mind.episode = { trigger: focus.s, ...(focus.cause ? { cause: focus.cause } : {}), startedAt: now, steps: 0, hourSteps: 0, hourAt: now, peak: loadOf(mind), edges: [], lastAct: act };
  }

  const ep = mind.episode;
  if (ep) {
    const avoidance = avoidanceOf(act);
    if (avoidance && ep.lastAct !== act) {
      // R-004: la evitación se emite ahora. Suprime parte de la carga y ese alivio refuerza la respuesta (036 R-002).
      const before = rawLoadOf(mind);
      scale(mind, 1 - p.avoidanceRelief, p);
      seedResponse(store, avoidance, AVOIDANCE_W0, now);
      // El alivio como reforzador: la carga que quita, respecto a la que hace falta para rumiar [M].
      operant(store, avoidance, '', Math.min(1, (before - rawLoadOf(mind)) / p.pnrEnter), now, P, sens, ep.cause);
      storeChanged = true;
      if (loadOf(mind) < p.pnrExit) end('evitacion');
    } else if (avoidance) {
      // Sigue durmiendo o distraída: no piensa en ello, y lo pensado se desvanece sin extinguirse (no hay contacto).
      fade(mind, c.tickMinutes, p);
      if (loadOf(mind) < p.pnrExit) end('evitacion');
    } else if (rng.chance(responseStrength(store, SELF_RESPONSE, p.selfW0))) {
      // R-006: «yo estoy teniendo el pensamiento de…»: los eventos privados pierden control discriminativo.
      scale(mind, p.selfKeep, p);
      seedResponse(store, SELF_RESPONSE, p.selfW0, now);
      operant(store, SELF_RESPONSE, '', hasValue(store) ? p.selfValueOutcome : p.selfNoValueOutcome, now, P, sens, ep.cause);
      storeChanged = true;
      end('yo');
    } else {
      if (now - ep.hourAt >= 60) Object.assign(ep, { hourAt: now, hourSteps: 0 });
      if (ep.hourSteps >= p.maxStepsPerHour) end('tope');
      else {
        // R-002: un paso de derivación; quedarse con el pensamiento es exposición: el disparador se extingue algo.
        const step = derivationStep(mind, net, p)!;
        applyStep(mind, step, now, p, ep.cause);
        if (consolidate(net, step, now)) netChanged = true;
        ep.edges.push(...step.path);
        ep.steps += 1;
        ep.hourSteps += 1;
        ep.peak = Math.max(ep.peak, loadOf(mind));
        if (store.f.some((f) => f.s === ep.trigger)) {
          pair(store, onto, { stim: ep.trigger, ctx: '', now, lambda: 0 }, P, sens); // un ensayo de extinción (036 R-003)
          storeChanged = true;
        }
        if (c.level >= 4 && step.kind === 'derived')
          events.push({ type: 'THOUGHT_DERIVED', payload: { citizenId: id, from: step.from, to: step.to, relation: step.relation ?? '', fn: round(step.fn) }, causes: ep.cause ? [{ event: ep.cause as EntityId, weight: 1 }] : [], participants: who });
        if (loadOf(mind) < p.pnrExit) end('bajo');
      }
    }
    if (mind.episode) mind.episode.lastAct = act;
  } else fade(mind, c.tickMinutes, p);

  return { storeChanged, netChanged, events };
}

/** El sistema: dispara con los hechos del tick y avanza la mente de quien tiene algo activo. */
export function createPrivateSystem(onto: Ontology, p: PrivateParams = PRIVATE_DEFAULTS): System {
  return {
    id: 'private',
    // Después del aprendizaje (1), la red (2) y las reglas: con las funciones del tick ya aprendidas.
    phase: 'memory',
    order: 5,
    capability: 'learning',
    cadence: 'tick',
    minLevel: 0,
    run: (view: WorldView, ctx: TickCtx, rng: Rng): SystemOutput => {
      const active = new Set(ctx.citizens);
      // R-001: los hechos aversivos del tick; cada estímulo presente puede disparar (mindTick se queda con los que
      // tienen función aversiva para esa persona: en un despido, «despido», no «trabajo», que el sueldo hizo apetitivo).
      const triggers = new Map<number, { s: string; cause: string }[]>();
      for (const e of ctx.events) {
        const rule = EVENT_LEARNING[e.type];
        const lambda = rule ? (typeof rule.lambda === 'number' ? rule.lambda : rule.lambda(e, view)) : 0;
        if (!rule || lambda >= 0) continue;
        const stims = rule.stims(e, view).filter((s) => onto.classes.has(s));
        for (const row of learners(e, view))
          if (active.has(row)) triggers.set(row, [...(triggers.get(row) ?? []), ...stims.map((s) => ({ s, cause: e.id }))]);
      }
      const patches: Patch[] = [];
      const events: SystemEvent[] = [];
      for (const row of ctx.citizens) {
        const r = mindTick(view, row, ctx, onto, rng.fork(row), p, triggers.get(row) ?? []);
        if (!r) continue;
        const id = formatId('CIT', row) as EntityId;
        patches.push({
          op: 'entity', id,
          fields: {
            mind: r.mind,
            ...(r.storeChanged ? { functions: r.store } : {}),
            ...(r.netChanged ? { network: r.net } : {}),
          },
          owned: true, // mente, almacén y red son copias propias de `mindTick`
        });
        events.push(...r.events);
      }
      return { patches, events };
    },
  };
}
