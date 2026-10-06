// Muestra de la batería (spec 045 R-005): adultas y vivas, estratificada por sexo y grupo de edad, con asignación
// proporcional (al menos una por estrato no vacío) y elección al azar dentro de cada estrato con un flujo con nombre.
import type { EntityId } from '../ids.ts';
import { idNumber } from '../ids.ts';
import type { Rng } from '../rng.ts';
import type { WorldView } from '../simulation/system.ts';

export const N_SAMPLE = 50;
const YEAR = 365.25 * 1440;
export const AGE_GROUPS: readonly { label: string; from: number; to: number }[] = [
  { label: '18–29', from: 18, to: 29 }, { label: '30–44', from: 30, to: 44 }, { label: '45–59', from: 45, to: 59 }, { label: '60 o más', from: 60, to: 200 },
];

export interface Participant {
  id: EntityId;
  sex: 'F' | 'M';
  age: number;
  stratum: string;
}

/** Personas adultas, vivas y simuladas, en orden de id. */
export function adults(world: WorldView): Participant[] {
  const out: Participant[] = [];
  for (const c of [...world.citizens.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (c.ancestor || !c.sex || world.components.u8.active?.[idNumber(c.id)] !== 1) continue;
    const age = Math.floor((world.now - (world.components.i32['demo.birthMinute']?.[idNumber(c.id)] ?? 0)) / YEAR);
    const g = AGE_GROUPS.find((x) => age >= x.from && age <= x.to);
    if (g) out.push({ id: c.id, sex: c.sex, age, stratum: `${c.sex} ${g.label}` });
  }
  return out;
}

/** Elige `n` personas; `rng` es el flujo `measure:sample`. Devuelve en orden de id. */
export function selectSample(pool: readonly Participant[], n: number, rng: Rng): Participant[] {
  const strata = new Map<string, Participant[]>();
  for (const p of pool) (strata.get(p.stratum) ?? strata.set(p.stratum, []).get(p.stratum)!).push(p);
  const keys = [...strata.keys()].sort();
  if (n < keys.length || pool.length < n) throw new Error(`muestra imposible: ${n} personas para ${keys.length} estratos y ${pool.length} candidatas`);
  const quota = new Map(keys.map((k) => [k, 1]));
  let left = n - keys.length;
  // Resto de la cuota en proporción al tamaño, por mayor resto (empates por clave).
  const extra = keys.map((k) => ({ k, share: ((strata.get(k)!.length - 1) / Math.max(1, pool.length - keys.length)) * left }));
  for (const e of extra) {
    const whole = Math.min(Math.floor(e.share), strata.get(e.k)!.length - 1);
    quota.set(e.k, quota.get(e.k)! + whole);
    left -= whole;
  }
  const byRemainder = extra.map((e) => ({ ...e, rem: e.share - Math.floor(e.share) })).sort((a, b) => b.rem - a.rem || (a.k < b.k ? -1 : 1));
  for (let i = 0; left > 0 && i < 10 * byRemainder.length; i++) {
    const e = byRemainder[i % byRemainder.length]!;
    if (quota.get(e.k)! < strata.get(e.k)!.length) {
      quota.set(e.k, quota.get(e.k)! + 1);
      left--;
    }
  }
  const picked: Participant[] = [];
  for (const k of keys) {
    const r = rng.fork(k);
    const members = [...strata.get(k)!];
    for (let i = 0; i < quota.get(k)!; i++) picked.push(members.splice(Math.floor(r.next() * members.length), 1)[0]!);
  }
  return picked.sort((a, b) => (a.id < b.id ? -1 : 1));
}
