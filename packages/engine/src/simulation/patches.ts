// Aplicación de parches (spec 021 R-007): la única vía por la que un sistema cambia el mundo.
import { idKind } from '../ids.ts';
import type { World } from '../world.ts';
import type { Patch } from './system.ts';

const LISTS = { CIT: 'citizens', HOU: 'households', PLC: 'places', ORG: 'organizations', OBJ: 'objects' } as const;

/** Aplica los parches en orden. Lanza (sin aplicar el parche) si uno es inválido: columna o entidad inexistente. */
export function applyPatches(world: World, patches: readonly Patch[], source: string): void {
  const c = world.components;
  for (const p of patches) {
    if (p.op === 'entity') {
      const list = LISTS[idKind(p.id) as keyof typeof LISTS];
      const entity = list ? (world[list] as Map<string, object>).get(p.id) : undefined;
      if (!entity) throw new Error(`${source}: parche sobre una entidad inexistente (${p.id})`);
      if ('id' in p.fields || 'status' in p.fields) throw new Error(`${source}: un parche no cambia id ni status (${p.id})`);
      Object.assign(entity, structuredClone(p.fields));
      continue;
    }
    const col = c[p.type][p.column];
    if (!col) throw new Error(`${source}: columna ${p.type} desconocida (${p.column})`);
    if (p.op === 'setMany') {
      if (p.rows.length !== p.values.length) throw new Error(`${source}: setMany con filas y valores de distinto largo`);
      for (let k = 0; k < p.rows.length; k++) {
        const row = p.rows[k]!;
        const value = p.values[k]!;
        if (!Number.isInteger(row) || row < 1 || row >= col.length) throw new Error(`${source}: fila fuera de rango (${row})`);
        if (!Number.isFinite(value)) throw new RangeError(`${source}: valor no finito en ${p.column}[${row}]`);
        if (p.type !== 'f32' && !Number.isInteger(value)) throw new RangeError(`${source}: ${p.column} es entera (${value})`);
        col[row] = value;
      }
      continue;
    }
    if (!Number.isInteger(p.row) || p.row < 1 || p.row >= col.length) throw new Error(`${source}: fila fuera de rango (${p.row})`);
    const value = p.op === 'set' ? p.value : col[p.row]! + p.delta;
    if (!Number.isFinite(value)) throw new RangeError(`${source}: valor no finito en ${p.column}[${p.row}]`);
    if (p.type !== 'f32' && !Number.isInteger(value)) throw new RangeError(`${source}: ${p.column} es entera (${value})`);
    col[p.row] = value;
  }
}
