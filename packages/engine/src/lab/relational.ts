// Escenarios relacionales de la batería 042 (bloque MF4): V-7 (vinculación mutua y combinatoria), V-8
// (transformación por comparación) y V-11a (ajedrez → "inteligente" → "soy tonto"). Solo mecanismos de la 037 con
// sus parámetros por defecto (042 R-002).
import { pickIndex, softmax, temperatureOf } from '../decision/select.ts';
import { DEFAULT_VARIABILITY } from '../functions/history.ts';
import { createRng } from '../rng.ts';
import { derive, functionalValue } from '../relations/derive.ts';
import { teach } from '../relations/network.ts';
import { emptyNetwork } from '../relations/types.ts';
import type { Derived, RelationType, RelationalNetwork } from '../relations/types.ts';

/** Relación derivada entre dos estímulos (la más fuerte de ese tipo), o `undefined`. */
export const relationOf = (net: RelationalNetwork, a: string, b: string, t: RelationType, ctx = ''): Derived | undefined =>
  derive(net, a, ctx).find((d) => d.to === b && d.t === t);

/** V-7: enseña A–B y B–C con fuerza `s` en el marco dado y devuelve la red. */
export function trainedPair(t: RelationType, s = 0.9): RelationalNetwork {
  const net = emptyNetwork();
  teach(net, { a: 'A', b: 'B', t, s, now: 0 });
  teach(net, { a: 'B', b: 'C', t, s, now: 1 });
  return net;
}

/**
 * V-8: A con función aversiva directa −0,5; se enseña B > A y C < A en el contexto del laboratorio, que es la
 * clave funcional aprendida (Cfunc presente). Devuelve el valor funcional de A, B y C.
 */
export function comparisonTransform(s = 0.9): { A: number; B: number; C: number } {
  const net = emptyNetwork();
  teach(net, { a: 'B', b: 'A', t: 'more', s, cfunc: 'lab', now: 0 });
  teach(net, { a: 'C', b: 'A', t: 'less', s, cfunc: 'lab', now: 1 });
  const direct = (x: string) => (x === 'A' ? -0.5 : 0);
  const fv = (x: string) => functionalValue(net, direct, x, 'lab').value;
  return { A: fv('A'), B: fv('B'), C: fv('C') };
}

/** Proporción de elección de jugar ajedrez frente a otra actividad de valor 0 (softmax de la 040). */
function playShare(net: RelationalNetwork, direct: (x: string) => number, seed: number, trials = 2000): number {
  const v = functionalValue(net, direct, 'ajedrez').value;
  const p = softmax([v, 0], temperatureOf(DEFAULT_VARIABILITY));
  const rng = createRng(seed).fork('lab:ajedrez');
  let play = 0;
  for (let k = 0; k < trials; k++) if (pickIndex(p, rng.next()) === 0) play++;
  return play / trials;
}

/**
 * V-11a (McHugh): "inteligente" con función apetitiva directa (0,6). (1) Antes de la regla: proporción de jugar.
 * (2) Se enseña "ajedrez = juego de la inteligencia" (coordinación): proporción de jugar. (3) Se enseña ganar
 * opuesto a perder, ganar = inteligente e inteligente opuesto a tonto (si `withOpposition`): relación derivada de
 * "perder" con "tonto" y valor funcional de "perder" y de "tonto".
 */
export function chessScenario(seed = 42, withOpposition = true) {
  const net = emptyNetwork();
  const direct = (x: string) => (x === 'inteligente' ? 0.6 : 0);
  const before = playShare(net, direct, seed);
  teach(net, { a: 'ajedrez', b: 'inteligente', t: 'coordination', s: 0.9, now: 0 });
  const afterRule = playShare(net, direct, seed);
  teach(net, { a: 'ganar', b: 'perder', t: 'opposition', s: 0.9, now: 1 });
  teach(net, { a: 'ganar', b: 'inteligente', t: 'coordination', s: 0.9, now: 2 });
  if (withOpposition) teach(net, { a: 'inteligente', b: 'tonto', t: 'opposition', s: 0.9, now: 3 });
  return {
    before,
    afterRule,
    loseIsDumb: relationOf(net, 'perder', 'tonto', 'coordination'),
    lose: functionalValue(net, direct, 'perder').value,
    dumb: functionalValue(net, direct, 'tonto').value,
  };
}
