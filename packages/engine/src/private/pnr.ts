// Lógica pura de los eventos privados (spec 039 R-001 a R-005): la carga, la activación de un pensamiento, su
// desvanecimiento fuera de un episodio y el paso de derivación del PNR, que consolida las aristas usadas (la red se
// vuelve más compleja y menos derivada: el siguiente bucle es más rápido). Sin azar y sin E/S.
import type { FunctionStore } from '../functions/types.ts';
import { derive, transformFactor } from '../relations/derive.ts';
import { teach } from '../relations/network.ts';
import type { RelationalNetwork, RelationType } from '../relations/types.ts';
import type { PrivateParams } from './params.ts';
import type { MindState, PrivateEvent } from './types.ts';

const clamp1 = (x: number) => Math.max(-1, Math.min(1, x));

/** Suma de las funciones aversivas de los eventos activos, sin techo (para medir un alivio aunque la carga esté en 1). */
export const rawLoadOf = (m: MindState): number => m.active.reduce((s, e) => s + Math.max(0, -e.fn), 0);

/** PA-116 (decisión 2): suma de las funciones aversivas de los eventos activos, con techo 1. */
export const loadOf = (m: MindState): number => Math.min(1, rawLoadOf(m));

/** El evento activo más aversivo (a igualdad, el de clave menor): el foco del episodio. */
export function focusOf(m: MindState): PrivateEvent | undefined {
  let best: PrivateEvent | undefined;
  for (const e of m.active) if (!best || e.fn < best.fn || (e.fn === best.fn && e.s < best.s)) best = e;
  return best;
}

/**
 * R-001: activa un pensamiento. Si ya estaba activo, queda con la función más aversiva de las dos. Por encima del
 * tope (`maxActive`), sale el de menor magnitud.
 */
export function activate(m: MindState, ev: PrivateEvent, p: PrivateParams): void {
  const cur = m.active.find((x) => x.s === ev.s);
  if (cur) {
    if (ev.fn < cur.fn) Object.assign(cur, ev);
  } else m.active.push({ ...ev });
  if (m.active.length > p.maxActive) {
    const weakest = [...m.active].sort((a, b) => Math.abs(a.fn) - Math.abs(b.fn) || (a.s < b.s ? -1 : 1))[0]!;
    m.active = m.active.filter((x) => x !== weakest);
  }
  m.active.sort((a, b) => (a.s < b.s ? -1 : 1));
}

/** Multiplica la función de todos los activos y retira los que quedan por debajo de `minFn`. */
export function scale(m: MindState, k: number, p: PrivateParams): void {
  for (const e of m.active) e.fn = clamp1(e.fn * k);
  m.active = m.active.filter((e) => Math.abs(e.fn) >= p.minFn);
}

/** Fuera de un episodio, los pensamientos se desvanecen con su media vida. */
export const fade = (m: MindState, minutes: number, p: PrivateParams): void => scale(m, Math.pow(0.5, minutes / p.fadeHalfLifeMin), p);

export interface StepResult {
  kind: 'derived' | 'repeat';
  from: string;
  to: string;
  relation?: RelationType;
  fn: number;
  /** Aristas del camino usado. */
  path: number[];
}

/**
 * R-002: un paso de PNR desde el foco. Deriva por la red (037) los estímulos relacionados que no están activos y
 * elige el de función transformada más aversiva: `factor(tipo) × función del foco × fuerza` (a igualdad, el de clave
 * menor). La fuerza ya favorece las aristas fuertes y los caminos cortos (consolidados). Si no hay a dónde ir, la
 * persona vuelve sobre lo mismo: el foco se habitúa un poco (`repeatHabituation`).
 */
export function derivationStep(m: MindState, net: RelationalNetwork | undefined, p: PrivateParams): StepResult | undefined {
  const focus = focusOf(m);
  if (!focus) return undefined;
  const active = new Set(m.active.map((e) => e.s));
  let best: { to: string; t: RelationType; fn: number; path: number[] } | undefined;
  if (net && net.e.length > 0) {
    for (const d of derive(net, focus.s, '', true)) {
      if (active.has(d.to)) continue;
      const fn = clamp1(transformFactor(d.t) * focus.fn * d.s);
      if (fn > -p.minFn) continue;
      if (!best || fn < best.fn || (fn === best.fn && d.to < best.to)) best = { to: d.to, t: d.t, fn, path: d.path };
    }
  }
  if (best) return { kind: 'derived', from: focus.s, to: best.to, relation: best.t, fn: best.fn, path: best.path };
  return { kind: 'repeat', from: focus.s, to: focus.s, fn: clamp1(focus.fn * (1 - p.repeatHabituation)), path: [] };
}

/**
 * R-005: consolida lo usado en un paso. Un camino de varias aristas queda guardado como relación derivada directa
 * (`derived_stored`) entre el foco y el pensamiento nuevo; si ya existía, se refuerza (`teach`). Devuelve si cambió.
 */
export function consolidate(net: RelationalNetwork, step: StepResult, now: number): boolean {
  if (step.kind !== 'derived' || !step.relation || step.path.length < 2) return false;
  const existed = net.e.some((e) => e.a === step.from && e.b === step.to && e.t === step.relation && !e.crel);
  const s = step.path.reduce((acc, k) => acc * (net.e[k]?.s ?? 0), 1);
  const r = teach(net, { a: step.from, b: step.to, t: step.relation, s, now });
  if (!existed) r.o = 'derived_stored';
  return true;
}

/** Aplica el paso: activa el pensamiento nuevo o habitúa el foco que se repite. */
export function applyStep(m: MindState, step: StepResult, now: number, p: PrivateParams, cause?: string): void {
  if (step.kind === 'repeat') {
    const focus = m.active.find((e) => e.s === step.from);
    if (focus) focus.fn = step.fn;
    m.active = m.active.filter((e) => Math.abs(e.fn) >= p.minFn);
    return;
  }
  activate(m, { s: step.to, fn: step.fn, from: step.from, at: now, ...(cause ? { cause } : {}) }, p);
}

/** Fuerza vigente de una respuesta del almacén (036 R-002), o la de partida si no tiene historia. */
export const responseStrength = (store: FunctionStore | undefined, r: string, w0: number): number =>
  store?.r.find((x) => x.r === r && x.c === '')?.w ?? w0;

/** Crea la respuesta con su fuerza de partida antes de aprender (así el primer ensayo parte de `w0`, no de 0). */
export function seedResponse(store: FunctionStore, r: string, w0: number, now: number): void {
  if (!store.r.some((x) => x.r === r && x.c === '')) store.r.push({ r, c: '', w: w0, n: 0, at: now });
}
