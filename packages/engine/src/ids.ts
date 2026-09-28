// Identificadores estables y legibles (spec 001 R-001).

export type EntityKind = 'CIT' | 'HOU' | 'ORG' | 'PLC' | 'OBJ' | 'EVT' | 'MEM' | 'BEL' | 'SCH' | 'CHP' | 'TSK';
export type EntityId = `${EntityKind}-${string}`;
export type WorldId = `WLD-${string}`;
export type Counters = Record<EntityKind, number>;

/** Dígitos del sufijo por tipo. Orden de esta tabla = orden canónico de los tipos. */
export const ID_WIDTH: Readonly<Record<EntityKind, number>> = Object.freeze({
  CIT: 6,
  HOU: 4,
  ORG: 4,
  PLC: 4,
  OBJ: 6,
  EVT: 11,
  MEM: 9,
  BEL: 9,
  SCH: 9,
  CHP: 9,
  TSK: 9,
});

export const ENTITY_KINDS = Object.freeze(Object.keys(ID_WIDTH) as EntityKind[]);

/**
 * Ids ya formateados por tipo y número (MF8.5): los sistemas los piden miles de veces por tick. Solo los tipos de
 * entidades del mundo, no los eventos (ilimitados), para que la memoria quede acotada por el tamaño del mundo.
 */
const FORMATTED: Partial<Record<EntityKind, string[]>> = {};
const CACHED: ReadonlySet<EntityKind> = new Set<EntityKind>(['CIT', 'HOU', 'ORG', 'PLC', 'OBJ']);

export function formatId(kind: EntityKind, n: number): EntityId {
  const hit = FORMATTED[kind]?.[n];
  if (hit !== undefined) return hit as EntityId;
  const width = ID_WIDTH[kind];
  if (!Number.isSafeInteger(n) || n < 1 || String(n).length > width) {
    throw new RangeError(`Id fuera de rango para ${kind}: ${n} (ancho ${width})`);
  }
  const id = `${kind}-${String(n).padStart(width, '0')}`;
  if (CACHED.has(kind)) (FORMATTED[kind] ??= [])[n] = id;
  return id as EntityId;
}

/** Ids de entidades del mundo ya leídos (acotado como `FORMATTED`: sin eventos). */
const PARSED = new Map<string, [EntityKind, number]>();

function parse(id: string): [EntityKind, number] {
  const hit = PARSED.get(id);
  if (hit) return hit;
  const out = parseId(id);
  if (CACHED.has(out[0])) PARSED.set(id, out);
  return out;
}

/** `TIPO-000123`: tres mayúsculas de un tipo conocido, un guion y solo dígitos (sin expresión regular: es caliente). */
function parseId(id: string): [EntityKind, number] {
  const kind = id.slice(0, 3);
  let ok = id.length > 4 && id.charCodeAt(3) === 45 && kind in ID_WIDTH;
  for (let i = 4; ok && i < id.length; i++) {
    const c = id.charCodeAt(i);
    ok = c >= 48 && c <= 57;
  }
  if (!ok) throw new RangeError(`Id inválido: ${id}`);
  return [kind as EntityKind, Number(id.slice(4))];
}

export const idKind = (id: EntityId): EntityKind => parse(id)[0];
export const idNumber = (id: EntityId): number => parse(id)[1];

export function emptyCounters(): Counters {
  return Object.fromEntries(ENTITY_KINDS.map((k) => [k, 0])) as Counters;
}

/** Reserva el siguiente id de un tipo. Los contadores nunca retroceden: los ids no se reutilizan. */
export function allocateId(counters: Counters, kind: EntityKind): EntityId {
  const id = formatId(kind, counters[kind] + 1);
  counters[kind] += 1;
  return id;
}
