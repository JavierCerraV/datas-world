// Aplicación de parches (spec 021 R-007): la única vía por la que un sistema cambia el mundo.
import { idKind } from '../ids.ts';
import type { World } from '../world.ts';
import type { Account, Patch } from './system.ts';

const LISTS = { CIT: 'citizens', HOU: 'households', PLC: 'places', ORG: 'organizations', OBJ: 'objects' } as const;

const I32_MIN = -(2 ** 31);
const I32_MAX = 2 ** 31 - 1;

/** Saldo de una cuenta (015 §3). Lanza si la cuenta no existe. */
export function balanceOf(world: World, a: Account): number {
  switch (a.kind) {
    case 'citizen': {
      const money = world.components.i32.money;
      if (!money || a.row < 1 || a.row >= money.length) throw new Error(`Cuenta de persona inexistente (fila ${a.row})`);
      return money[a.row]!;
    }
    case 'household': {
      const h = world.households.get(a.id);
      if (!h) throw new Error(`Cuenta de hogar inexistente (${a.id})`);
      return h.savings ?? 0;
    }
    case 'org': {
      const o = world.organizations.get(a.id);
      if (!o) throw new Error(`Cuenta de organización inexistente (${a.id})`);
      return o.cash ?? 0;
    }
    case 'rest':
      if (!world.accounts) throw new Error('El mundo no tiene cuentas del sistema (015)');
      return world.accounts.restOfCountry;
  }
}

function setBalance(world: World, a: Account, value: number): void {
  if (a.kind === 'citizen') world.components.i32.money![a.row] = value;
  else if (a.kind === 'household') world.households.get(a.id)!.savings = value;
  else if (a.kind === 'org') world.organizations.get(a.id)!.cash = value;
  else world.accounts!.restOfCountry = value;
}

/** 015 R-006: mueve `amount` de `from` a `to` en un paso. Valida todo antes de cambiar nada. */
function transfer(world: World, from: Account, to: Account, amount: number, source: string): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new RangeError(`${source}: transferencia no entera o no positiva (${amount})`);
  const a = balanceOf(world, from) - amount;
  const b = balanceOf(world, to) + amount;
  // Los saldos de las personas son i32 (015 INV-001): se rechaza el desbordamiento en vez de envolverlo.
  for (const [acc, v] of [[from, a], [to, b]] as const)
    if (acc.kind === 'citizen' && (v < I32_MIN || v > I32_MAX)) throw new RangeError(`${source}: saldo fuera de i32 (${v})`);
  setBalance(world, from, a);
  setBalance(world, to, b);
}

/** Aplica los parches en orden. Lanza (sin aplicar el parche) si uno es inválido: columna o entidad inexistente. */
export function applyPatches(world: World, patches: readonly Patch[], source: string): void {
  const c = world.components;
  for (const p of patches) {
    if (p.op === 'transfer') {
      transfer(world, p.from, p.to, p.amount, source);
      continue;
    }
    if (p.op === 'entity') {
      const list = LISTS[idKind(p.id) as keyof typeof LISTS];
      const entity = list ? (world[list] as Map<string, object>).get(p.id) : undefined;
      if (!entity) throw new Error(`${source}: parche sobre una entidad inexistente (${p.id})`);
      if ('id' in p.fields || 'status' in p.fields) throw new Error(`${source}: un parche no cambia id ni status (${p.id})`);
      Object.assign(entity, p.owned ? p.fields : structuredClone(p.fields));
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
