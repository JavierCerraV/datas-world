// Mecanismos de aprendizaje directo (spec 036 R-001 a R-008, R-011). Funciones puras sobre un `FunctionStore`
// (copia de trabajo): el sistema las aplica y escribe el resultado como parche. Sin azar: el mismo historial da
// el mismo aprendizaje.
import type { FunctionEntry, FunctionStore, LearningParams, Ontology, ResponseEntry, Sensitivity } from './types.ts';

const DAY = 1440;
const clamp1 = (x: number) => Math.max(-1, Math.min(1, x));

/**
 * Distancia normalizada entre dos clases (raíz del error cuadrático medio de sus rasgos); 1 si alguna no existe o
 * si son de tipos distintos: la generalización primaria va por rasgos dentro de un tipo (lugar con lugar, término
 * con término); la transferencia entre tipos es relacional y llega con la capa verbal (037) [M].
 */
export function distance(onto: Ontology, a: string, b: string): number {
  if (a === b) return 0;
  const ca = onto.classes.get(a);
  const cb = onto.classes.get(b);
  if (!ca || !cb || ca.kind !== cb.kind) return 1;
  const fa = ca.features;
  const fb = cb.features;
  let s = 0;
  for (let k = 0; k < onto.dims; k++) s += ((fa[k] ?? 0) - (fb[k] ?? 0)) ** 2;
  return Math.sqrt(s / onto.dims);
}

/** R-004 [E] fenómeno, [M] forma: gradiente gaussiano de la distancia. */
export const gradient = (d: number, sigma: number) => Math.exp(-(d * d) / (2 * sigma * sigma));

/** Inhibición de la extinción vigente en el contexto `ctx` en el minuto `now` (decae: recuperación espontánea, R-003). */
function inhibitionIn(f: FunctionEntry, ctx: string, now: number, P: LearningParams): number {
  let inh = 0;
  for (const i of f.inh) if (i.c === ctx) inh += i.v * Math.exp(-(now - i.at) / (P.inhTauDays * DAY));
  return Math.min(1, inh);
}

/** Valor propio de una función en un contexto: su valor con la inhibición contextual restada (nunca cruza el cero). */
export function ownValue(f: FunctionEntry, ctx: string, now: number, P: LearningParams): number {
  const inh = inhibitionIn(f, ctx, now, P);
  return Math.sign(f.v) * Math.max(0, Math.abs(f.v) - inh);
}

/**
 * Valor neto de un estímulo en un contexto: la suma de las funciones de la persona, cada una por el gradiente de
 * generalización desde su estímulo (R-004). Así el entrenamiento discriminativo, que deja un valor negativo en el
 * estímulo no reforzado, estrecha el gradiente y desplaza su pico (R-005; sumación de Spence, referencia a verificar).
 */
export function netValue(store: FunctionStore, onto: Ontology, stim: string, ctx: string, now: number, P: LearningParams): number {
  let v = 0;
  for (const f of store.f) {
    const own = ownValue(f, ctx, now, P);
    if (own === 0) continue;
    v += own * gradient(distance(onto, stim, f.s), P.sigma);
  }
  return clamp1(v);
}

function entryFor(store: FunctionStore, stim: string, ctx: string, now: number): FunctionEntry {
  let f = store.f.find((x) => x.s === stim);
  if (!f) {
    f = { s: stim, v: 0, c: ctx, inh: [], hab: 0, n: 0, rs: [], o: 'direct', src: [], at: now };
    store.f.push(f);
  }
  return f;
}

const addSource = (f: FunctionEntry, src: string | undefined) => {
  if (src && !f.src.includes(src)) f.src = [...f.src, src].slice(-3);
};

export interface Trial {
  stim: string;
  /** Contexto del ensayo (p. ej. el tipo de lugar). */
  ctx: string;
  now: number;
  /** Consecuencia con signo (λ): > 0 apetitiva, < 0 aversiva, 0 = el estímulo solo. */
  lambda: number;
  /** Estímulo que hace de consecuencia (para los reforzadores generalizados, R-008). */
  us?: string;
  /** Evento que lo originó (019). */
  source?: string;
  /** Estímulo social: su saliencia se multiplica por la sensibilidad social (009, `tmp.socialSalience`). */
  social?: boolean;
}

/**
 * Un ensayo respondiente (R-001, R-003, R-006, R-007):
 * - con consecuencia (λ ≠ 0): Rescorla-Wagner, `ΔV = α·β·sens·(λ − neto)`, con β y la sensibilidad según la valencia;
 * - sin consecuencia (λ = 0): si el estímulo tiene función propia, se extingue creando inhibición en este contexto
 *   (no se borra); si solo la tiene por generalización, gana un valor opuesto (inhibición condicionada, R-005).
 *   Además se habitúa la respuesta elicitada (R-006).
 */
export function pair(store: FunctionStore, onto: Ontology, t: Trial, P: LearningParams, sens: Sensitivity): FunctionEntry {
  const pred = netValue(store, onto, t.stim, t.ctx, t.now, P);
  const f = entryFor(store, t.stim, t.ctx, t.now);
  const alpha = P.alpha * (t.social ? sens.social : 1);
  if (t.lambda !== 0) {
    const aversive = t.lambda < 0;
    const beta = (aversive ? P.betaAv : P.betaApp) * (aversive ? sens.aversive : sens.appetitive);
    f.v = clamp1(f.v + alpha * beta * (t.lambda - pred));
    if (t.us && !f.rs.includes(t.us)) f.rs = [...f.rs, t.us].slice(0, 8);
    f.hab = Math.max(0, f.hab * 0.5); // una consecuencia deshabitúa
  } else if (Math.abs(f.v) > P.ownThreshold && Math.sign(f.v) === Math.sign(pred)) {
    // Extinción de una función propia que produce la expectativa (mismo signo): inhibición en este contexto.
    const own = ownValue(f, t.ctx, t.now, P);
    const sensExt = f.v < 0 ? sens.aversive : sens.appetitive;
    // La extinción se aprende despacio si la persona es muy sensible a esa valencia (la función "pesa" más) [M].
    const step = (alpha * P.betaExt * Math.abs(own)) / sensExt;
    const i = f.inh.find((x) => x.c === t.ctx);
    const current = i ? i.v * Math.exp(-(t.now - i.at) / (P.inhTauDays * DAY)) : 0;
    if (i) {
      i.v = Math.min(1, current + step);
      i.at = t.now;
    } else f.inh = [...f.inh, { c: t.ctx, v: Math.min(1, step), at: t.now }].slice(-4);
  } else if (Math.abs(pred) <= P.ownThreshold) {
    // Sin función aprendida: habituación de la respuesta elicitada (R-006). En un estímulo condicionado la
    // extinción ya reduce la respuesta; habituarlo además contaría dos veces.
    f.hab = f.hab + P.habRate * sens.habituation * (1 - f.hab);
  } else {
    // La expectativa viene de la generalización (o de un valor opuesto ya aprendido): inhibición condicionada,
    // un valor propio de signo contrario (R-005; base del estrechamiento y del desplazamiento del pico).
    f.v = clamp1(f.v + alpha * P.betaExt * (0 - pred));
    f.o = 'discriminated';
  }
  f.n += 1;
  f.at = t.now;
  addSource(f, t.source);
  return f;
}

/** Respuesta elicitada por un estímulo ahora: su valor neto por la habituación que se recupera con el tiempo (R-006). */
export function elicited(store: FunctionStore, onto: Ontology, stim: string, ctx: string, now: number, P: LearningParams, sens: Sensitivity): number {
  const f = store.f.find((x) => x.s === stim);
  const hab = f ? f.hab * Math.exp(-(now - f.at) / (P.habTauDays * DAY)) : 0;
  return clamp1(netValue(store, onto, stim, ctx, now, P) * (1 - hab) * sens.arousal);
}

/** R-008 [T]: reforzador generalizado = emparejado con al menos `min` reforzadores distintos. */
export const isGeneralized = (f: FunctionEntry, min = 3) => f.rs.length >= min;

/**
 * Eficacia de un estímulo como reforzador bajo una operación motivadora (036 R-008, R-010): la de un reforzador
 * generalizado no depende de la operación motivadora; la de uno específico se multiplica por ella (`mo` ∈ [0,1]).
 */
export const reinforcingValue = (f: FunctionEntry, ctx: string, now: number, P: LearningParams, mo: number) =>
  ownValue(f, ctx, now, P) * (isGeneralized(f) ? 1 : mo);

/**
 * R-002 [E]: aprendizaje operante. La fuerza de la respuesta en el contexto se acerca a la consecuencia obtenida
 * (`w += rate·sens·(resultado − w)`); el reforzamiento negativo (alivio) es un resultado positivo.
 */
export function operant(store: FunctionStore, r: string, ctx: string, outcome: number, now: number, P: LearningParams, sens: Sensitivity): ResponseEntry {
  let e = store.r.find((x) => x.r === r && x.c === ctx);
  if (!e) {
    e = { r, c: ctx, w: 0, n: 0, at: now };
    store.r.push(e);
  }
  const s = outcome < 0 ? sens.aversive : sens.appetitive;
  e.w = clamp1(e.w + P.operantRate * s * (clamp1(outcome) - e.w));
  e.n += 1;
  e.at = now;
  return e;
}

/** INV-003: poda por encima de los topes, lo más débil y lo más antiguo primero; deja la cuenta de lo podado. */
export function prune(store: FunctionStore, P: LearningParams): void {
  const cut = <T extends { at: number }>(xs: T[], max: number, weight: (x: T) => number) => {
    if (xs.length <= max) return xs;
    const keep = [...xs].sort((a, b) => weight(b) - weight(a) || b.at - a.at).slice(0, max);
    store.pruned += xs.length - max;
    return xs.filter((x) => keep.includes(x));
  };
  store.f = cut(store.f, P.maxFunctions, (f) => Math.abs(f.v));
  store.r = cut(store.r, P.maxResponses, (r) => Math.abs(r.w));
}
