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
  // Trayectoria previa (spec 007 R-006, spec 008): eventos con fecha anterior al presente del mundo.
  HOUSEHOLD_FORMED: def<{ householdId: string; template: string; members: string[] }>({
    baseImportance: 0.5,
    spontaneous: false,
    check: (p) =>
      needObj(p, {
        householdId: str,
        template: str,
        members: (v) => Array.isArray(v) && v.length > 0 && v.every(str),
      }),
    text: (e) => `Se forma el hogar ${e.payload.householdId} (${e.payload.members.length} personas).`,
  }),
  STUDIES_COMPLETED: def<{ citizenId: string; level: number; levelName: string }>({
    baseImportance: 0.4,
    spontaneous: false,
    check: (p) => needObj(p, { citizenId: str, level: int, levelName: str }),
    text: (e) => `${e.payload.citizenId} termina sus estudios: ${e.payload.levelName}.`,
  }),
  CHILDHOOD_EVENT: def<{ citizenId: string; kind: string; text: string }>({
    baseImportance: 0.5,
    spontaneous: false,
    check: (p) => needObj(p, { citizenId: str, kind: str, text: str }),
    text: (e) => `Infancia de ${e.payload.citizenId}: ${e.payload.text}.`,
  }),
  // Ocupación (spec 006) y objetos (spec 005). En la generación llevan fecha anterior al presente.
  JOB_HIRED: def<{ citizenId: string; orgId: string; positionId: string; orgName: string }>({
    baseImportance: 0.7,
    spontaneous: false,
    check: (p) => needObj(p, { citizenId: str, orgId: str, positionId: str, orgName: str }),
    text: (e) => `${e.payload.citizenId} empieza a trabajar en ${e.payload.orgName}.`,
  }),
  INFORMAL_WORK_STARTED: def<{ citizenId: string; kind: string; trade: string; tradeName: string }>({
    baseImportance: 0.5,
    spontaneous: false,
    check: (p) =>
      needObj(p, { citizenId: str, kind: (v) => v === 'informal' || v === 'independent', trade: str, tradeName: str }),
    text: (e) =>
      `${e.payload.citizenId} empieza a trabajar por su cuenta (${e.payload.tradeName}${e.payload.kind === 'informal' ? ', informal' : ''}).`,
  }),
  JOB_LOST: def<{ citizenId: string; reason: string }>({
    baseImportance: 0.8,
    spontaneous: false,
    check: (p) => needObj(p, { citizenId: str, reason: str }),
    text: (e) => `${e.payload.citizenId} pierde su empleo (${e.payload.reason}).`,
  }),
  RETIRED: def<{ citizenId: string }>({
    baseImportance: 0.6,
    spontaneous: false,
    check: (p) => needObj(p, { citizenId: str }),
    text: (e) => `${e.payload.citizenId} empieza a recibir su pensión.`,
  }),
  OBJECT_ACQUIRED: def<{ objectId: string; ownerId: string; price: number; name: string }>({
    baseImportance: 0.2,
    spontaneous: false,
    check: (p) => needObj(p, { objectId: str, ownerId: str, price: int, name: str }),
    text: (e) => `${e.payload.ownerId} adquiere ${e.payload.name}.`,
  }),
  OBJECT_INHERITED: def<{ objectId: string; to: string; name: string }>({
    baseImportance: 0.6,
    spontaneous: false,
    check: (p) => needObj(p, { objectId: str, to: str, name: str }),
    text: (e) => `${e.payload.to} hereda ${e.payload.name}.`,
  }),
  // Ficha de salud (spec 031).
  HEALTH_INSURANCE_SET: def<{ citizenId: string; regime: string }>({
    baseImportance: 0.3,
    spontaneous: false,
    check: (p) => needObj(p, { citizenId: str, regime: str }),
    text: (e) => `${e.payload.citizenId} queda afiliado al régimen ${e.payload.regime} de salud.`,
  }),
  CONDITION_DIAGNOSED: def<{ citizenId: string; condition: string; name: string; cie10: string }>({
    baseImportance: 0.6,
    spontaneous: false,
    check: (p) => needObj(p, { citizenId: str, condition: str, name: str, cie10: str }),
    text: (e) => `A ${e.payload.citizenId} le diagnostican ${e.payload.name.toLowerCase()} (${e.payload.cie10}).`,
  }),
  // Ficha de esparcimiento (spec 032).
  LEISURE_TAKEN_UP: def<{ citizenId: string; activity: string; name: string }>({
    baseImportance: 0.3,
    spontaneous: false,
    check: (p) => needObj(p, { citizenId: str, activity: str, name: str }),
    text: (e) => `${e.payload.citizenId} empieza a ${e.payload.name.toLowerCase()}.`,
  }),
  // Historia generada (spec 030), de 1900 al presente.
  TOWN_FOUNDED: def<{ placeId: string; name: string; year: number }>({
    baseImportance: 1,
    spontaneous: false,
    check: (p) => needObj(p, { placeId: str, name: str, year: int }),
    text: (e) => `Se funda ${e.payload.name} (${e.payload.year}).`,
  }),
  DISTRICT_FOUNDED: def<{ placeId: string; name: string }>({
    baseImportance: 0.7,
    spontaneous: false,
    check: (p) => needObj(p, { placeId: str, name: str }),
    text: (e) => `Nace el barrio ${e.payload.name}.`,
  }),
  PLACE_BUILT: def<{ placeId: string; name: string; kind: string }>({
    baseImportance: 0.3,
    spontaneous: false,
    check: (p) => needObj(p, { placeId: str, name: str, kind: str }),
    text: (e) => `Se construye ${e.payload.name}.`,
  }),
  ORG_FOUNDED: def<{ orgId: string; name: string }>({
    baseImportance: 0.4,
    spontaneous: false,
    check: (p) => needObj(p, { orgId: str, name: str }),
    text: (e) => `Se funda ${e.payload.name}.`,
  }),
  CITIZEN_BORN: def<{ citizenId: string; placeName: string }>({
    baseImportance: 0.6,
    spontaneous: false,
    check: (p) => needObj(p, { citizenId: str, placeName: str }),
    text: (e) => `Nace ${e.payload.citizenId} en ${e.payload.placeName}.`,
  }),
  UNION_FORMED: def<{ a: string; b: string }>({
    baseImportance: 0.6,
    spontaneous: false,
    check: (p) => needObj(p, { a: str, b: str }),
    text: (e) => `${e.payload.a} y ${e.payload.b} forman pareja.`,
  }),
  MIGRATED: def<{ citizenId: string; from: string; to: string }>({
    baseImportance: 0.7,
    spontaneous: false,
    check: (p) => needObj(p, { citizenId: str, from: str, to: str }),
    text: (e) => `${e.payload.citizenId} llega a ${e.payload.to} desde ${e.payload.from}.`,
  }),
  CITIZEN_DIED: def<{ citizenId: string; age: number; cause: string }>({
    baseImportance: 0.8,
    spontaneous: false,
    check: (p) => needObj(p, { citizenId: str, age: int, cause: str }),
    text: (e) => `Muere ${e.payload.citizenId} a los ${e.payload.age} años (${e.payload.cause}).`,
  }),
  HISTORICAL_CONTEXT: def<{ key: string; name: string; start: string; end: string }>({
    baseImportance: 0.9,
    spontaneous: true, // hecho externo: su causa está fuera del mundo (fuente citada en el catálogo)
    check: (p) => needObj(p, { key: str, name: str, start: str, end: str }),
    text: (e) => `${e.payload.name} (${e.payload.start}${e.payload.end !== e.payload.start ? ` a ${e.payload.end}` : ''}).`,
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
