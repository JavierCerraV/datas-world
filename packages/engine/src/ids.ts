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

const ID_RE = /^([A-Z]{3})-(\d+)$/;

export function formatId(kind: EntityKind, n: number): EntityId {
  const width = ID_WIDTH[kind];
  if (!Number.isSafeInteger(n) || n < 1 || String(n).length > width) {
    throw new RangeError(`Id fuera de rango para ${kind}: ${n} (ancho ${width})`);
  }
  return `${kind}-${String(n).padStart(width, '0')}`;
}

function parse(id: string): [EntityKind, number] {
  const m = ID_RE.exec(id);
  if (!m || !(m[1]! in ID_WIDTH)) throw new RangeError(`Id inválido: ${id}`);
  return [m[1] as EntityKind, Number(m[2])];
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
