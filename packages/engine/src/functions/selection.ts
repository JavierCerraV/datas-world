// Aprendizaje de la selección (spec 040 R-009; 036 R-002, R-009, R-011, R-012) [M]: la consecuencia de una
// conducta elegida actualiza su fuerza (contingencia conducta → consecuencia), la variabilidad aprendida y la
// pendiente del descuento. Lo aplica el sistema `learning` (fase `memory`).
import type { WorldEvent } from '../events.ts';
import type { WorldView } from '../simulation/system.ts';
import { K_MAX, K_MIN, discountKOf, leisureResponse, variabilityOf } from './history.ts';
import { operant } from './learn.ts';
import type { FunctionStore, LearningParams, Sensitivity } from './types.ts';

/** Tasas de la 040 §8. */
const VARIABILITY_RATE = 0.01;
const K_TOWARD_MIN = 0.01;
const K_TOWARD_MAX = 0.05;

/** Estados `hist.*` de una persona durante el tick (se escriben al final). */
export interface HistState {
  k: number;
  variability: number;
}

export const histOf = (view: WorldView, row: number): HistState => ({ k: discountKOf(view, row), variability: variabilityOf(view, row) });

export function learnSelection(e: WorldEvent, lambda: number, store: FunctionStore, hist: HistState, P: LearningParams, sens: Sensitivity): void {
  if (e.type === 'LEISURE_DONE') {
    const key = (e.payload as { activity: string }).activity;
    // La actividad reforzada anterior: si es otra, se refuerza la variación; si es la misma, la estabilidad.
    let prev: string | undefined;
    let at = -Infinity;
    for (const r of store.r) if (r.r.startsWith('ocio.') && r.n > 0 && r.at > at) [prev, at] = [r.r, r.at];
    operant(store, leisureResponse(key), '', lambda, e.at, P, sens, e.id);
    if (prev === leisureResponse(key)) hist.variability -= VARIABILITY_RATE * hist.variability;
    else if (prev) hist.variability += VARIABILITY_RATE * (1 - hist.variability);
  } else if (e.type === 'SALARY_PAID') {
    // Una demora larga (un mes de trabajo) reforzada: el descuento baja despacio.
    hist.k = Math.exp(Math.log(hist.k) + K_TOWARD_MIN * (Math.log(K_MIN) - Math.log(hist.k)));
  } else if (e.type === 'JOB_LOST') {
    // La recompensa prometida deja de llegar: el descuento sube.
    hist.k = Math.exp(Math.log(hist.k) + K_TOWARD_MAX * (Math.log(K_MAX) - Math.log(hist.k)));
  }
}
