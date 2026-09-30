// A quién se aplica un instrumento (spec 045 R-007): todos, al azar (simple o estratificado), seleccionados o una
// persona. Determinista: orden por id y el flujo de muestreo de la aplicación.
import { ageInYears } from '../calendar.ts';
import type { EntityId } from '../ids.ts';
import { idNumber } from '../ids.ts';
import type { Rng } from '../rng.ts';
import type { WorldView } from '../simulation/system.ts';
import type { Candidate, ExclusionReason, ResolvedSelection, Selection } from './types.ts';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Grupo de edad de 10 años («30-39»; «80+» desde los 80). */
export const ageGroup = (age: number) => (age >= 80 ? '80+' : `${Math.floor(age / 10) * 10}-${Math.floor(age / 10) * 10 + 9}`);

/**
 * Las personas del mundo (sin antepasados fuera del mundo), con su edad en el minuto actual y sus variables de
 * agrupación. `extra` añade las que el motor no calcula solo (barrio, estrato, ocupación, eventos…).
 */
export function candidatesOf(view: WorldView, extra?: (id: EntityId) => Record<string, string>): Candidate[] {
  const birth = view.components.i32['demo.birthMinute'];
  const out: Candidate[] = [];
  for (const c of view.citizens.values()) {
    if (c.ancestor) continue;
    const age = ageInYears(birth?.[idNumber(c.id)] ?? 0, view.now, view.config.epoch);
    const vars: Record<string, string> = { edad: ageGroup(age) };
    if (c.sex) vars.sexo = c.sex;
    out.push({ id: c.id, age, alive: c.status === 'active', vars: { ...vars, ...(extra?.(c.id) ?? {}) } });
  }
  return out.sort(byId);
}

/** Muestra sin reemplazo de `k` elementos (Fisher-Yates parcial), devuelta en orden de id. */
function sample<T extends { id: string }>(items: readonly T[], k: number, rng: Rng): T[] {
  const a = [...items];
  const n = Math.min(k, a.length);
  for (let i = 0; i < n; i++) {
    const j = rng.int(i, a.length - 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a.slice(0, n).sort(byId);
}

/** Asignación proporcional por restos mayores; empates por nombre de estrato. */
function allocate(sizes: ReadonlyMap<string, number>, n: number): Map<string, number> {
  const total = [...sizes.values()].reduce((s, x) => s + x, 0);
  const keys = [...sizes.keys()].sort();
  const exact = keys.map((k) => ({ k, q: (sizes.get(k)! * n) / total }));
  const out = new Map(exact.map(({ k, q }) => [k, Math.floor(q)]));
  let left = n - [...out.values()].reduce((s, x) => s + x, 0);
  for (const { k } of [...exact].sort((a, b) => b.q - Math.floor(b.q) - (a.q - Math.floor(a.q)) || (a.k < b.k ? -1 : 1))) {
    if (left <= 0) break;
    if (out.get(k)! < sizes.get(k)!) {
      out.set(k, out.get(k)! + 1);
      left--;
    }
  }
  return out;
}

/**
 * CA-008: resuelve la selección. `samples` da los miembros vigentes de una muestra (`from: 'SMP-…'`). Menores de
 * `minAge`, fallecidos e ids inexistentes quedan en `excluded` con su motivo; el resto, en orden de id.
 */
export function resolveSelection(
  sel: Selection,
  candidates: readonly Candidate[],
  minAge: number,
  rng: Rng,
  samples?: (id: string) => readonly EntityId[] | undefined,
): ResolvedSelection {
  const byKey = new Map(candidates.map((c) => [c.id, c]));
  const excluded: { citizen: EntityId; reason: ExclusionReason }[] = [];
  const check = (id: EntityId): Candidate | null => {
    const c = byKey.get(id);
    const reason: ExclusionReason | null = !c ? 'no_existe' : !c.alive ? 'fallecido' : c.age < minAge ? 'menor' : null;
    if (reason) excluded.push({ citizen: id, reason });
    return reason ? null : c!;
  };
  const eligible = () => candidates.filter((c) => c.alive && c.age >= minAge);

  let resolved: Candidate[];
  switch (sel.kind) {
    case 'todos':
      resolved = eligible();
      break;
    case 'individual':
      resolved = [check(sel.citizen)].filter((c): c is Candidate => c !== null);
      break;
    case 'seleccionados': {
      const ids = sel.from ? samples?.(sel.from) ?? [] : sel.citizens;
      if (sel.from && !samples?.(sel.from)) throw new Error(`No existe la muestra ${sel.from}`);
      resolved = [...new Set(ids)].sort().map(check).filter((c): c is Candidate => c !== null);
      break;
    }
    case 'azar': {
      if (!Number.isInteger(sel.n) || sel.n < 1) throw new RangeError(`Tamaño de muestra inválido: ${sel.n}`);
      const pool = eligible();
      const strata = sel.strata ?? [];
      if (!strata.length) {
        resolved = sample(pool, sel.n, rng);
        break;
      }
      const keyOf = (c: Candidate) => strata.map((s) => c.vars[s] ?? '—').join(' · ');
      const groups = new Map<string, Candidate[]>();
      for (const c of pool) groups.set(keyOf(c), [...(groups.get(keyOf(c)) ?? []), c]);
      const quota = allocate(new Map([...groups].map(([k, g]) => [k, g.length])), Math.min(sel.n, pool.length));
      resolved = [...groups.keys()].sort().flatMap((k) => sample(groups.get(k)!, quota.get(k)!, rng.fork(k)));
      break;
    }
  }
  return { resolved: resolved.map((c) => c.id).sort(), excluded };
}
