// Tick mínimo de M0 y entradas externas (specs 002, 001 R-007, 023 R-004).
// El bucle completo por fases y el registro de sistemas llegan con la spec 021 (M2).
import { MINUTES_PER_DAY, formatDate, toCalendar } from './calendar.ts';
import type { WorldMinute } from './calendar.ts';
import { canEnable, withCapability } from './capabilities.ts';
import { EVENT_TYPES, makeEvent } from './events.ts';
import type { WorldEvent } from './events.ts';
import type { Rng } from './rng.ts';
import { popDue } from './scheduler.ts';
import type { ScheduledItem } from './scheduler.ts';
import type { World } from './world.ts';

export type ScheduledHandler = (world: World, item: ScheduledItem, rng: Rng) => WorldEvent[];

/**
 * Avanza un tick: suma `tickMinutes`, emite DAY_STARTED al llegar a medianoche y atiende lo que vence
 * en el scheduler en orden (at, id). El azar de cada elemento sale de `rng.fork('sched').fork(item.id)`:
 * el flujo raíz nunca se consume, así que no hay estado de RNG que guardar.
 */
export function tick(world: World, rng: Rng, handlers: Readonly<Record<string, ScheduledHandler>> = {}): WorldEvent[] {
  const events: WorldEvent[] = [];
  world.now += world.config.tickMinutes;
  if (world.now % MINUTES_PER_DAY === 0) {
    const date = formatDate(toCalendar(world.now, world.config.epoch));
    events.push(
      makeEvent(world.counters, world.now, {
        type: 'DAY_STARTED',
        payload: { date },
        causes: [{ state: 'clock', value: world.now, weight: 1 }],
      }),
    );
  }
  const sched = rng.fork('sched');
  for (const item of popDue(world.scheduler, world.now)) {
    const handler = handlers[item.kind];
    if (!handler) throw new Error(`No hay manejador para el elemento programado ${item.id} de tipo ${item.kind}`);
    events.push(...handler(world, item, sched.fork(item.id)));
  }
  return events;
}

export interface ExternalInput {
  at: WorldMinute;
  seq: number;
  kind: string;
  payload: unknown;
}

export type InputResult = { ok: true; events: WorldEvent[] } | { ok: false; reason: string };

const SPEEDS: readonly number[] = [0, 1, 10, 100, 1000];

/**
 * Valida y aplica una entrada externa en el minuto actual. Si se rechaza, el mundo no cambia.
 * Si se aplica, emite EXTERNAL_INPUT_APPLIED y, según el tipo, el evento específico con esa causa.
 */
export function applyExternalInput(world: World, input: ExternalInput): InputResult {
  if (input.at !== world.now) return { ok: false, reason: `la entrada es del minuto ${input.at} y el mundo está en ${world.now}` };
  const p = (typeof input.payload === 'object' && input.payload !== null ? input.payload : {}) as Record<string, unknown>;

  let specific: { type: keyof typeof EVENT_TYPES; payload: unknown; apply: () => void } | undefined;
  switch (input.kind) {
    case 'enable_capability': {
      const cap = p.capability as Parameters<typeof canEnable>[1];
      const why = canEnable(world.capabilities, cap);
      if (why) return { ok: false, reason: why };
      specific = { type: 'CAPABILITY_ENABLED', payload: { capability: cap }, apply: () => (world.capabilities = withCapability(world.capabilities, cap)) };
      break;
    }
    case 'set_speed':
      if (!SPEEDS.includes(p.from as number) || !SPEEDS.includes(p.to as number)) return { ok: false, reason: 'velocidad inválida' };
      specific = { type: 'SPEED_CHANGED', payload: { from: p.from, to: p.to }, apply: () => {} };
      break;
    case 'pause':
    case 'resume': {
      const target = input.kind === 'pause' ? 'paused' : 'running';
      if (world.status === 'closed') return { ok: false, reason: 'el mundo está cerrado' };
      if (world.status === target) return { ok: false, reason: `el mundo ya está ${target}` };
      specific = {
        type: input.kind === 'pause' ? 'WORLD_PAUSED' : 'WORLD_RESUMED',
        payload: { reason: typeof p.reason === 'string' ? p.reason : '' },
        apply: () => (world.status = target),
      };
      break;
    }
    default:
      return { ok: false, reason: `tipo de entrada desconocido: ${input.kind}` };
  }

  const applied = makeEvent(world.counters, world.now, {
    type: 'EXTERNAL_INPUT_APPLIED',
    payload: { kind: input.kind, seq: input.seq },
    causes: [{ state: 'external_input', value: input.seq, weight: 1 }],
    origin: 'external',
  });
  specific.apply();
  const event = makeEvent(world.counters, world.now, {
    type: specific.type,
    payload: specific.payload,
    causes: [{ event: applied.id, weight: 1 }],
    origin: 'external',
  });
  return { ok: true, events: [applied, event] };
}
