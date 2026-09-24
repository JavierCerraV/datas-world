// Componentes numéricos densos de los ciudadanos (spec 001 §3.1, R-009; ADR-005 idea A).
// La fila i corresponde a CIT-i; la fila 0 no se usa porque los ids empiezan en 1.

export type ColumnType = 'f32' | 'i32' | 'u8';

export interface CitizenComponents {
  capacity: number;
  f32: Record<string, Float32Array>;
  i32: Record<string, Int32Array>;
  u8: Record<string, Uint8Array>;
  /** Valor con que nace cada fila de cada columna (también las filas que se añaden al crecer). */
  initial: Record<string, number>;
}

export const COLUMN_TYPES: readonly ColumnType[] = Object.freeze(['f32', 'i32', 'u8']);

const ALLOC = { f32: Float32Array, i32: Int32Array, u8: Uint8Array } as const;

/** Potencia de 2 ≥ n (mínimo 16). */
export function capacityFor(rows: number): number {
  let c = 16;
  while (c < rows) c *= 2;
  return c;
}

export function createComponents(capacity: number): CitizenComponents {
  const c: CitizenComponents = { capacity, f32: {}, i32: {}, u8: {}, initial: {} };
  defineColumn(c, 'u8', 'active', 0);
  return c;
}

/** Columnas en orden canónico: por tipo (f32, i32, u8) y luego por nombre. */
export function columns(c: CitizenComponents): { type: ColumnType; name: string; data: Float32Array | Int32Array | Uint8Array }[] {
  return COLUMN_TYPES.flatMap((type) =>
    Object.keys(c[type])
      .sort()
      .map((name) => ({ type, name, data: c[type][name]! })),
  );
}

export function defineColumn(c: CitizenComponents, type: ColumnType, name: string, initial = 0): void {
  if (COLUMN_TYPES.some((t) => name in c[t])) throw new Error(`Columna duplicada: ${name}`);
  const data = new ALLOC[type](c.capacity);
  data.fill(initial);
  (c[type] as Record<string, typeof data>)[name] = data;
  c.initial[name] = data[0] ?? 0; // valor ya convertido al tipo de la columna
}

/** Amplía todas las columnas (×2) hasta tener al menos `rows` filas. Las filas existentes no cambian. */
export function ensureCapacity(c: CitizenComponents, rows: number): void {
  if (rows <= c.capacity) return;
  const next = Math.max(capacityFor(rows), c.capacity * 2);
  for (const { type, name, data } of columns(c)) {
    const grown = new ALLOC[type](next);
    grown.set(data);
    grown.fill(c.initial[name] ?? 0, c.capacity);
    (c[type] as Record<string, typeof grown>)[name] = grown;
  }
  c.capacity = next;
}
