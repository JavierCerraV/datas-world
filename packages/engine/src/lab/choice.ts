// Escenarios de elección de la batería 042 (bloque MF3): V-4 (igualación) y V-5 (descuento e inversión). Usan
// solo la selección de la 040 y el aprendizaje operante de la 036 con sus parámetros por defecto (042 R-002).
import { pickIndex, softmax, strengthContribution, temperatureOf } from '../decision/select.ts';
import { DEFAULT_K, DEFAULT_VARIABILITY, discounted } from '../functions/history.ts';
import { operant } from '../functions/learn.ts';
import { LEARNING_DEFAULTS, NEUTRAL, emptyStore } from '../functions/types.ts';
import { createRng } from '../rng.ts';

const P = LEARNING_DEFAULTS;

/**
 * V-4: dos respuestas concurrentes con intervalo variable. En cada ensayo, el reforzador de cada una se arma con su
 * probabilidad y espera hasta que se emita esa respuesta. Elección por softmax sobre el aporte de la fuerza
 * (040 R-003, R-004); la consecuencia actualiza la fuerza de la respuesta emitida (036 R-002).
 */
export function concurrentChoice(ratio: number, seed: number, trials = 1000, total = 0.2): { responses: [number, number]; reinforcers: [number, number] } {
  const arm = [(total * ratio) / (ratio + 1), total / (ratio + 1)];
  const s = emptyStore();
  for (const r of ['A', 'B']) s.r.push({ r, c: 'lab', w: 0.5, n: 0, at: 0 });
  const rng = createRng(seed).fork('lab:igualacion');
  const T = temperatureOf(DEFAULT_VARIABILITY);
  const armed = [false, false];
  const responses: [number, number] = [0, 0];
  const reinforcers: [number, number] = [0, 0];
  for (let t = 0; t < trials; t++) {
    for (let k = 0; k < 2; k++) if (!armed[k] && rng.next() < arm[k]!) armed[k] = true;
    const p = softmax(s.r.map((e) => strengthContribution(e.w)), T);
    const k = pickIndex(p, rng.next());
    responses[k]! += 1;
    const out = armed[k] ? 1 : 0;
    if (armed[k]) {
      reinforcers[k]! += 1;
      armed[k] = false;
    }
    operant(s, k === 0 ? 'A' : 'B', 'lab', out, t, P, NEUTRAL);
  }
  return { responses, reinforcers };
}

/**
 * V-5: elegir entre una consecuencia menor y más próxima (`a` en `da` días) y una mayor y más lejana (`b` en `db`).
 * Su valor es la magnitud relativa descontada (036 R-009) con la pendiente por defecto; devuelve la proporción de
 * elecciones de la menor en `trials` ensayos.
 */
export function delayChoice(a: number, da: number, b: number, db: number, seed = 42, trials = 10_000, k = DEFAULT_K): number {
  const max = Math.max(a, b);
  const p = softmax([discounted(a / max, da, k), discounted(b / max, db, k)], temperatureOf(DEFAULT_VARIABILITY));
  const rng = createRng(seed).fork('lab:descuento');
  let smaller = 0;
  for (let t = 0; t < trials; t++) if (pickIndex(p, rng.next()) === 0) smaller++;
  return smaller / trials;
}
