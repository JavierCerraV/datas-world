// Eventos: modelo común, catálogo central y creación validada (spec 014).
import type { WorldMinute } from './calendar.ts';
import type { Capability } from './capabilities.ts';
import { CAPABILITIES } from './capabilities.ts';
import { allocateId } from './ids.ts';
import type { Counters, EntityId } from './ids.ts';

export type CauseRef =
  { event: EntityId; weight: number } | { state: string; entity?: EntityId; value?: number; weight: number };

export type EventOrigin = 'engine' | 'external' | 'llm';

export interface WorldEvent<P = unknown> {
  readonly id: EntityId;
  readonly type: EventType;
  readonly at: WorldMinute;
  readonly participants: readonly { readonly id: EntityId; readonly role: string }[];
  readonly placeId?: EntityId;
  readonly importance: number;
  readonly payload: P;
  readonly causes: readonly CauseRef[];
  readonly origin: EventOrigin;
}

interface EventTypeDef<P> {
  baseImportance: number;
  /** Espontáneo = azar puro; puede llevar solo `{ state: 'rng' }` como causa. */
  spontaneous: boolean;
  /** Devuelve el motivo si el payload no es válido. */
  check(p: unknown): string | null;
  /** Plantilla de texto en español (CA-003). */
  text(e: WorldEvent<P>): string;
}

const isObj = (p: unknown): p is Record<string, unknown> => typeof p === 'object' && p !== null && !Array.isArray(p);
const SPEEDS = [0, 1, 10, 100, 1000];
const speedOk = (v: unknown) => typeof v === 'number' && SPEEDS.includes(v);
const needObj = (p: unknown, fields: Record<string, (v: unknown) => boolean>): string | null => {
  if (!isObj(p)) return 'se espera un objeto';
  for (const [k, ok] of Object.entries(fields)) if (!ok(p[k])) return `campo "${k}" inválido`;
  return null;
};
const str = (v: unknown) => typeof v === 'string' && v.length > 0;
const int = (v: unknown) => Number.isSafeInteger(v);

type Def<P> = EventTypeDef<P>;
const def = <P>(d: Def<P>) => Object.freeze(d);

/** Catálogo central (R-001). Tipos en inglés UPPER_SNAKE_CASE; textos en español. */
export const EVENT_TYPES = Object.freeze({
  WORLD_CREATED: def<{ name: string; seed: number }>({
    baseImportance: 1,
    spontaneous: false,
    check: (p) => needObj(p, { name: str, seed: int }),
    text: (e) => `Se crea el mundo «${e.payload.name}» con la semilla ${e.payload.seed}.`,
  }),
  DAY_STARTED: def<{ date: string }>({
    baseImportance: 0.05,
    spontaneous: false,
    check: (p) => needObj(p, { date: (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) }),
    text: (e) => `Comienza el día ${e.payload.date}.`,
  }),
  EXTERNAL_INPUT_APPLIED: def<{ kind: string; seq: number }>({
    baseImportance: 0.3,
    spontaneous: false,
    check: (p) => needObj(p, { kind: str, seq: int }),
    text: (e) => `Se aplica una entrada externa (${e.payload.kind}).`,
  }),
  SPEED_CHANGED: def<{ from: number; to: number }>({
    baseImportance: 0.05,
    spontaneous: false,
    check: (p) => needObj(p, { from: speedOk, to: speedOk }),
    text: (e) => `La velocidad cambia de ${e.payload.from}x a ${e.payload.to}x.`,
  }),
  WORLD_PAUSED: def<{ reason: string }>({
    baseImportance: 0.05,
    spontaneous: false,
    check: (p) => needObj(p, { reason: (v) => typeof v === 'string' }),
    text: (e) => `El mundo se pausa${e.payload.reason ? ` (${e.payload.reason})` : ''}.`,
  }),
  WORLD_RESUMED: def<{ reason: string }>({
    baseImportance: 0.05,
    spontaneous: false,
    check: (p) => needObj(p, { reason: (v) => typeof v === 'string' }),
    text: (e) => `El mundo se reanuda${e.payload.reason ? ` (${e.payload.reason})` : ''}.`,
  }),
  WORLD_CLOSED: def<{ minute: number; hash: string; reason: string }>({
    baseImportance: 0.3,
    spontaneous: false,
    check: (p) => needObj(p, { minute: int, hash: str, reason: (v) => typeof v === 'string' }),
    text: (e) =>
      `El proceso del mundo se detiene en el minuto ${e.payload.minute}${e.payload.reason ? ` (${e.payload.reason})` : ''}.`,
  }),
  CAPABILITY_ENABLED: def<{ capability: Capability }>({
    baseImportance: 0.8,
    spontaneous: false,
    check: (p) => needObj(p, { capability: (v) => (CAPABILITIES as readonly unknown[]).includes(v) }),
    text: (e) => `El mundo activa la capacidad «${e.payload.capability}».`,
  }),
});

export type EventType = keyof typeof EVENT_TYPES;

export interface NewEvent {
  type: EventType;
  payload: unknown;
  causes: CauseRef[];
  participants?: { id: EntityId; role: string }[];
  placeId?: EntityId;
  importance?: number;
  origin?: EventOrigin;
}

const deepFreeze = <T>(v: T): T => {
  if (typeof v === 'object' && v !== null && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) deepFreeze(x);
  }
  return v;
};

/** Crea un evento validado e inmutable y reserva su id EVT. Falla si el payload o las causas no son válidos. */
export function makeEvent(counters: Counters, at: WorldMinute, input: NewEvent): WorldEvent {
  const d = EVENT_TYPES[input.type] as Def<unknown> | undefined;
  if (!d) throw new Error(`Tipo de evento desconocido: ${input.type}`);
  if (!d.spontaneous && input.causes.length === 0)
    throw new Error(`${input.type}: un evento no espontáneo necesita ≥ 1 causa`);
  const bad = d.check(input.payload);
  if (bad) throw new Error(`${input.type}: payload inválido (${bad})`);
  for (const c of input.causes) {
    if (!Number.isFinite(c.weight) || c.weight < 0 || c.weight > 1)
      throw new RangeError(`${input.type}: peso de causa inválido`);
  }
  const importance = input.importance ?? d.baseImportance;
  if (!(importance >= 0 && importance <= 1)) throw new RangeError(`${input.type}: importancia fuera de [0,1]`);
  const event: WorldEvent = {
    id: allocateId(counters, 'EVT'),
    type: input.type,
    at,
    participants: input.participants ?? [],
    ...(input.placeId !== undefined ? { placeId: input.placeId } : {}),
    importance,
    payload: structuredClone(input.payload),
    causes: structuredClone(input.causes),
    origin: input.origin ?? 'engine',
  };
  return deepFreeze(event);
}

export function eventText(e: WorldEvent): string {
  return (EVENT_TYPES[e.type] as Def<unknown>).text(e);
}
