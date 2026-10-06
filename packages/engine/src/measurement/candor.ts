// Lo verdadero y lo que dice (spec 045 R-011): según su historia de aprendizaje, una persona puede decir su estado tal
// cual (fiel), decir menos malestar (minimiza), más (exagera), algo muy alejado (miente) o no *tactarlo* bien (impreciso).
// El motor decide la desviación; el LLM solo la expresa con palabras (R-012). Todo [M] (PA-155).
import type { Rng } from '../rng.ts';
import type { Indicators } from './indicators.ts';
import { INSTRUMENTS } from './instruments.ts';
import type { InstrumentId } from './instruments.ts';

export type Disposition = 'fiel' | 'minimiza' | 'exagera' | 'miente' | 'impreciso';

export const CANDOR_PARAMS = Object.freeze({
  baseMinimize: 0.08,
  baseExaggerate: 0.05,
  /** Fracción de las desviaciones que son mentira, con confianza plena y sin ella. */
  lieFracTrusting: 0.1,
  lieFracStranger: 0.25,
  baseImprecise: 0.1,
  /** Tope de la probabilidad de cada disposición. */
  maxP: 0.6,
});

/** Sentido «socialmente deseable» de cada instrumento: bajar la puntuación o subirla. */
const DESIRABLE: Record<InstrumentId, -1 | 1> = { 'AAQ-II': -1, 'GHQ-12': -1, 'GPQ-9': -1, GTQ: 1, 'DASS-21': -1, SWLS: 1 };

/** Ítems de ánimo, valía y soledad (se oculta más) y de síntomas y quejas (se dramatiza más), por instrumento. */
const SELF_ITEMS: Record<InstrumentId, readonly number[]> = {
  'AAQ-II': [2, 6], 'GHQ-12': [3, 9, 10, 11, 12], 'GPQ-9': [3, 4, 8], GTQ: [], 'DASS-21': [3, 10, 13, 16, 17, 21], SWLS: [1, 2, 3, 4, 5],
};
const SYMPTOM_ITEMS: Record<InstrumentId, readonly number[]> = {
  'AAQ-II': [1, 4, 5, 7], 'GHQ-12': [1, 2, 5, 6], 'GPQ-9': [], GTQ: [], 'DASS-21': [1, 2, 4, 6, 7, 8, 11, 12, 14, 15, 18, 19, 20], SWLS: [],
};

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export interface Disposed {
  /** Disposición de cada ítem. */
  disposition: Disposition[];
  /** Lo que la persona va a decir (`r_i`), en la escala del ítem. */
  r: number[];
  /** Probabilidades usadas por ítem, para el informe y las pruebas. */
  p: { minimize: number; exaggerate: number; imprecise: number }[];
}

/** Impulsos de la historia hacia ocultar (deseabilidad social) y hacia dramatizar (R-011). */
export function drives(ind: Indicators): { hide: number; show: number } {
  return {
    hide: 0.35 * ind.approvalValue + 0.25 * ind.avoidance + 0.2 * ind.pliance + 0.2 * ind.shame,
    show: 0.4 * ind.aversiveBurden + 0.3 * ind.lonely + 0.3 * ind.positiveContact * ind.negAffect,
  };
}

/**
 * Disposición y respuesta dicha de cada ítem. `rng` es el flujo `measure:candor:<id>:<toma>:<instrumento>`: siempre
 * se consumen 4 valores por ítem, para que cambiar un ítem no mueva a los demás. `trust` en [0,1]: cuánto confía en
 * quien pregunta (un extraño: 0).
 */
export function dispose(id: InstrumentId, t: readonly number[], ind: Indicators, rng: Rng, trust = 0): Disposed {
  const P = CANDOR_PARAMS;
  const ins = INSTRUMENTS[id];
  const { hide, show } = drives(ind);
  const out: Disposed = { disposition: [], r: [], p: [] };
  const lieFrac = P.lieFracStranger + (P.lieFracTrusting - P.lieFracStranger) * clamp(trust, 0, 1);
  const pImp = clamp(P.baseImprecise * (0.5 + (1 - ind.selfFraming) + ind.avoidance), 0, P.maxP);
  const dir = DESIRABLE[id];
  const range = ins.max - ins.min;
  t.forEach((ti, k) => {
    const n = k + 1;
    const selfy = SELF_ITEMS[id].includes(n), symptom = SYMPTOM_ITEMS[id].includes(n);
    const pMin = clamp(P.baseMinimize * (0.5 + 3 * hide) * (selfy ? 1.5 : 1), 0, P.maxP);
    const pExa = clamp(P.baseExaggerate * (0.5 + 3 * show) * (symptom ? 1.5 : 1), 0, P.maxP);
    const [u1, u2, u3, u4] = [rng.next(), rng.next(), rng.next(), rng.next()] as const;
    out.p.push({ minimize: pMin, exaggerate: pExa, imprecise: pImp });
    let d: Disposition = 'fiel';
    let r = ti;
    if (u1 < pMin || u1 > 1 - pExa) {
      const toward = u1 < pMin ? dir : -dir; // minimizar: hacia lo deseable; exagerar: hacia lo contrario
      const lie = u2 < lieFrac;
      const steps = lie ? Math.max(2, Math.round(range / 2)) : range >= 6 ? (u3 < 0.4 ? 2 : 1) : 1;
      r = clamp(ti + toward * steps, ins.min, ins.max);
      d = r === ti ? 'fiel' : lie ? 'miente' : u1 < pMin ? 'minimiza' : 'exagera';
    } else if (u2 < pImp) {
      const step = range >= 6 ? (u4 < 0.5 ? -1 : 1) * (u3 < 0.3 ? 2 : 1) : u4 < 0.5 ? -1 : 1;
      r = clamp(ti + step, ins.min, ins.max);
      d = r === ti ? 'fiel' : 'impreciso';
    }
    out.disposition.push(d);
    out.r.push(r);
  });
  return out;
}
