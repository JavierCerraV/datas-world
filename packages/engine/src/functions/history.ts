// Estados aprendidos de la selección (036 R-009, R-012; 040 R-009 a R-011): la pendiente del descuento
// (`hist.discountK`, por día) y la variabilidad (`hist.variability`). El temperamento solo da su valor inicial, y
// solo aquí (mecanismo registrado, 035 §5); la selección (040) lee el estado aprendido.
import { defineColumn } from '../components.ts';
import { formatId } from '../ids.ts';
import type { World } from '../world.ts';
import { emptyStore } from './types.ts';
import type { FunctionStore } from './types.ts';

/** Límites de la pendiente del descuento, por día (040 §8) [M]. */
export const K_MIN = 0.02;
export const K_MAX = 2;
/** Valores de un mundo sin las columnas (040 R-011). */
export const DEFAULT_K = 0.2;
export const DEFAULT_VARIABILITY = 0.5;

type Readable = { components: { f32: Readonly<Record<string, ArrayLike<number> | undefined>> } };

export const discountKOf = (view: Readable, row: number): number => view.components.f32['hist.discountK']?.[row] || DEFAULT_K;
export const variabilityOf = (view: Readable, row: number): number => view.components.f32['hist.variability']?.[row] ?? DEFAULT_VARIABILITY;

/** Valor presente de una consecuencia de magnitud `A` dentro de `days` días (036 R-009: hiperbólico). */
export const discounted = (A: number, days: number, k: number): number => A / (1 + k * days);

/** Fuerza inicial de una afición a partir de la afinidad de la ficha (040 R-003) [M]. */
export const leisureStrength0 = (affinity: number): number => 0.2 + 0.4 * affinity;

/** Clave de la respuesta de esparcimiento en el almacén. */
export const leisureResponse = (key: string): string => `ocio.${key}`;

/**
 * 040 R-011: define las columnas `hist.*` y las inicializa desde el temperamento (`tmp.discount0`,
 * `tmp.variability0`); siembra la fuerza de cada afición de la ficha (032) con su afinidad. Solo personas activas.
 */
export function initLearnedStates(world: World): void {
  const c = world.components;
  for (const col of ['hist.discountK', 'hist.variability']) if (!(col in c.f32)) defineColumn(c, 'f32', col, 0);
  const f = c.f32;
  for (let row = 1; row <= world.counters.CIT; row++) {
    if (c.u8.active?.[row] !== 1) continue;
    f['hist.discountK']![row] = K_MIN * (K_MAX / K_MIN) ** (f['tmp.discount0']?.[row] ?? 0.5);
    f['hist.variability']![row] = f['tmp.variability0']?.[row] ?? DEFAULT_VARIABILITY;
    const person = world.citizens.get(formatId('CIT', row));
    if (!person?.leisure?.length) continue;
    const store: FunctionStore = person.functions ?? emptyStore();
    for (const l of person.leisure) {
      const r = leisureResponse(l.key);
      if (!store.r.some((x) => x.r === r)) store.r.push({ r, c: '', w: leisureStrength0(l.affinity), n: 0, at: world.now });
    }
    person.functions = store;
  }
}
