// Derivación y transformación de funciones (spec 037 R-001 a R-006). Funciones puras sobre la red de una persona:
// sin azar y en orden fijo (INV-003); la memoria de consultas es opcional y no cambia el resultado (INV-002).
import { ATTENUATION, CFUNC_DEFAULT, COMP_FACTOR, MAX_DEPTH } from './types.ts';
import type { Derived, RelationType, RelationalNetwork } from './types.ts';

/** R-001: relación inversa (vinculación mutua). */
export const INVERSE: Readonly<Record<RelationType, RelationType>> = Object.freeze({
  coordination: 'coordination',
  distinction: 'distinction',
  opposition: 'opposition',
  more: 'less',
  less: 'more',
  contains: 'part_of',
  part_of: 'contains',
  causes: 'caused_by',
  caused_by: 'causes',
  before: 'after',
  after: 'before',
  deictic: 'deictic',
});

/** Tipos que se componen consigo mismos (R-002). */
const TRANSITIVE: ReadonlySet<RelationType> = new Set(['more', 'less', 'contains', 'part_of', 'causes', 'caused_by', 'before', 'after']);

/** R-002: de A x B y B y C, A (x∘y) C; `null` si no deriva nada. */
export function compose(x: RelationType, y: RelationType): RelationType | null {
  if (x === 'coordination') return y;
  if (y === 'coordination') return x;
  if (x === 'opposition' && y === 'opposition') return 'coordination';
  // 038 R-007 [M]: lo opuesto a un miembro de una clase es opuesto a la clase (red opuesta de un valor).
  if (x === 'opposition' && y === 'part_of') return 'opposition';
  if (x === y && TRANSITIVE.has(x)) return x;
  return null;
}

/** R-003: factor con el que X recibe la función de Y si X <t> Y (0 = no transforma en MF4). */
export function transformFactor(t: RelationType): number {
  switch (t) {
    case 'coordination':
    case 'part_of':
    case 'contains':
    case 'causes':
      return 1;
    case 'opposition':
      return -1;
    case 'more':
      return COMP_FACTOR;
    case 'less':
      return 1 / COMP_FACTOR;
    default:
      return 0;
  }
}

/** Paso por una arista (la fuerza se lee de la arista al recorrer: puede cambiar sin cambiar la adyacencia). */
interface Step {
  to: string;
  t: RelationType;
  inverted: boolean;
  edge: number;
  cfunc: string | undefined;
}

/**
 * Caché de adyacencias por arreglo de aristas y contexto. Es válida mientras el arreglo tenga la misma longitud:
 * `teach` solo añade aristas al final o sustituye el arreglo al podar, y los extremos, el tipo y las claves de una
 * arista no cambian después de creada (INV-002). No cambia el resultado: solo evita reconstruirla.
 */
const ADJ_CACHE = new WeakMap<object, { len: number; byCtx: Map<string, Map<string, Step[]>> }>();

/**
 * Adyacencia en el contexto `ctx` (R-005: una relación con `crel` solo vale en su contexto), en el orden de las
 * aristas en la red (orden de inserción, documentado: INV-003) y, en cada arista, primero la directa.
 */
function adjacency(net: RelationalNetwork, ctx: string): Map<string, Step[]> {
  const e = net.e;
  let cached = ADJ_CACHE.get(e);
  if (!cached || cached.len !== e.length) ADJ_CACHE.set(e, (cached = { len: e.length, byCtx: new Map() }));
  const hit = cached.byCtx.get(ctx);
  if (hit) return hit;
  const adj = new Map<string, Step[]>();
  const push = (from: string, st: Step) => {
    const list = adj.get(from);
    if (list) list.push(st);
    else adj.set(from, [st]);
  };
  for (let edge = 0; edge < e.length; edge++) {
    const r = e[edge]!;
    if (r.crel && r.crel !== ctx) continue;
    push(r.a, { to: r.b, t: r.t, inverted: false, edge, cfunc: r.cfunc });
    push(r.b, { to: r.a, t: INVERSE[r.t], inverted: true, edge, cfunc: r.cfunc });
  }
  cached.byCtx.set(ctx, adj);
  return adj;
}

/**
 * R-001, R-002: relaciones de `from` con los demás estímulos en el contexto `ctx`, por caminos simples de hasta
 * `MAX_DEPTH` aristas. Fuerza `Π s × ATTENUATION^pasos`, con pasos = (aristas − 1) + aristas invertidas. Para cada
 * (destino, tipo) queda la más fuerte (a igualdad, la de menos pasos; después, la primera encontrada). Orden del
 * resultado: destino y tipo. Con `transformingOnly`, no sigue los caminos cuyo tipo no transforma: un tipo que no
 * transforma solo se compone en sí mismo, así que ningún camino que pase por él transforma (poda sin pérdida para
 * `functionalValue`).
 */
export function derive(net: RelationalNetwork, from: string, ctx = '', transformingOnly = false): Derived[] {
  const adj = adjacency(net, ctx);
  const best = new Map<string, Map<RelationType, Derived>>();
  const path: number[] = [];
  const seen = new Set<string>([from]);
  const visit = (node: string, t: RelationType | null, s: number, inverted: number, cf: boolean) => {
    const edges = path.length;
    if (edges >= MAX_DEPTH) return;
    for (const st of adj.get(node) ?? []) {
      if (seen.has(st.to)) continue;
      const nt = t === null ? st.t : compose(t, st.t);
      if (nt === null || (transformingOnly && transformFactor(nt) === 0)) continue;
      const ni = inverted + (st.inverted ? 1 : 0);
      const steps = edges + ni;
      const ns = s * net.e[st.edge]!.s;
      const ncf = cf && ctx !== '' && st.cfunc === ctx;
      const ds = ns * ATTENUATION ** steps;
      path.push(st.edge);
      let byType = best.get(st.to);
      if (!byType) best.set(st.to, (byType = new Map()));
      const prev = byType.get(nt);
      if (!prev || ds > prev.s || (ds === prev.s && steps < prev.steps)) byType.set(nt, { to: st.to, t: nt, s: ds, steps, path: [...path], cfunc: ncf });
      seen.add(st.to);
      visit(st.to, nt, ns, ni, ncf);
      seen.delete(st.to);
      path.pop();
    }
  };
  visit(from, null, 1, 0, true);
  const out: Derived[] = [];
  for (const to of [...best.keys()].sort()) for (const t of [...best.get(to)!.keys()].sort()) out.push(best.get(to)!.get(t)!);
  return out;
}

/** Valor funcional de un estímulo (R-006) y de dónde sale. */
export interface FunctionalValue {
  value: number;
  source: 'direct' | 'derived';
  derived?: Derived;
}

/**
 * R-003, R-004, R-006: la derivada más fuerte (valor transformado × fuerza × Cfunc) salvo que la función directa sea
 * de mayor magnitud. `directOf` da la función directa de un estímulo (036: valor neto aprendido o primario). La
 * memoria `memo` guarda las derivaciones por estímulo y contexto dentro de una consulta o un tick (INV-002).
 */
export function functionalValue(
  net: RelationalNetwork | undefined,
  directOf: (stim: string) => number,
  stim: string,
  ctx = '',
  memo?: Map<string, Derived[]>,
): FunctionalValue {
  const direct = directOf(stim);
  if (!net || net.e.length === 0) return { value: direct, source: 'direct' };
  const key = `${stim}|${ctx}`;
  let ds = memo?.get(key);
  if (!ds) {
    ds = derive(net, stim, ctx, true);
    memo?.set(key, ds);
  }
  let best: { value: number; d: Derived } | undefined;
  for (const d of ds) {
    const f = transformFactor(d.t);
    if (f === 0) continue;
    const v = directOf(d.to);
    if (v === 0) continue;
    const value = Math.max(-1, Math.min(1, f * v)) * d.s * (d.cfunc ? 1 : CFUNC_DEFAULT);
    if (!best || Math.abs(value) > Math.abs(best.value)) best = { value, d };
  }
  if (best && Math.abs(best.value) > Math.abs(direct)) return { value: best.value, source: 'derived', derived: best.d };
  return { value: direct, source: 'direct' };
}
