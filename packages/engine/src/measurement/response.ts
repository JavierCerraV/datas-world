// Respuesta verdadera de cada ítem (spec 045 R-003, R-004, §4 bis): cómo está la persona, antes de decidir qué dice.
// Todo [M] (PA-155): constructos con pesos fijos, sesgos por ítem y un ruido pequeño con semilla.
import type { Rng } from '../rng.ts';
import type { Indicators } from './indicators.ts';
import { INSTRUMENTS } from './instruments.ts';
import type { InstrumentId } from './instruments.ts';

export const MEASURE_PARAMS = Object.freeze({
  /** Ruido de respuesta de un ítem a otro (R-003). */
  epsItem: 0.05,
  /** GHQ-12 (R-004): ganancia del cambio frente a lo habitual, del nivel de malestar y referencia del nivel. */
  changeGain: 4,
  levelGain: 2.5,
  negRef: 0.3,
  /** Peso del constructo en cada ítem: el resto lo ponen los indicadores propios del ítem. */
  construct: 0.75,
  /**
   * Origen de la escala [M] (PA-155): desplazamiento de `p` fijado una vez para que una persona de indicadores medios del
   * mundo quede cerca del promedio NO clínico de la ficha (GPQ-9: 20–25; GTQ: 58; AAQ-II: 18–23). Sin él, las escalas
   * salen lejos de su rango y todo el mundo caería del mismo lado del corte. Lo que se interpreta son las diferencias
   * entre personas y entre tomas, no el nivel absoluto.
   */
  origin: { 'AAQ-II': 0.05, 'GPQ-9': -0.29, GTQ: 0.27 } as Readonly<Record<string, number>>,
});

const c1 = (x: number) => Math.max(0, Math.min(1, x));
type Ind = keyof Indicators;
type Extra = Partial<Record<Ind, number>>;

// --- Constructos (§4 bis): cada uno, un valor en [0,1] ---
const inflexibility = (i: Indicators) => 0.25 * i.avoidance + 0.2 * i.pnrRecent + 0.15 * (1 - i.selfFraming) + 0.2 * i.negAffect + 0.1 * i.aversiveBurden + 0.1 * i.valueGap;
const pliance = (i: Indicators) => 0.35 * i.pliance + 0.3 * i.approvalValue + 0.15 * i.aversiveBurden + 0.1 * (1 - i.sensitivity) + 0.1 * i.lonely;
const trackingTrait = (i: Indicators) => 0.3 * i.tracking + 0.25 * i.sensitivity + 0.15 * i.selfFraming + 0.15 * (1 - i.pliance) + 0.15 * (1 - i.avoidance);
const depression = (i: Indicators) => 0.3 * (1 - i.mood) + 0.2 * i.sadness + 0.15 * i.funLack + 0.15 * i.aversiveBurden + 0.1 * i.energyLack + 0.1 * i.valueGap;
const anxiety = (i: Indicators) => 0.35 * i.stress + 0.3 * i.fear + 0.15 * i.pnrLoad + 0.1 * (1 - i.health) + 0.1 * i.shame;
const tension = (i: Indicators) => 0.4 * i.stress + 0.2 * i.anger + 0.15 * i.energyLack + 0.15 * i.pnrRecent + 0.1 * i.negAffect;
export const satisfaction = (i: Indicators) =>
  0.25 * i.mood + 0.15 * (1 - i.stress) + 0.15 * i.economicTrajectory + 0.1 * i.jobStability + 0.1 * i.relationshipStability + 0.1 * i.valueContact + 0.05 * i.health + 0.1 * i.positiveContact;

interface ItemModel {
  construct: (i: Indicators) => number;
  extra?: Extra;
  /** Sesgo del ítem, en [−0,1; 0,1]. */
  o?: number;
}
const m = (construct: ItemModel['construct'], extra?: Extra, o = 0): ItemModel => ({ construct, ...(extra ? { extra } : {}), o });

// Sesgo base de cada instrumento: un puntaje medio ligeramente por debajo del centro de la escala en lo clínico (lo común en la población).
const MODELS: Readonly<Record<Exclude<InstrumentId, 'GHQ-12'>, readonly ItemModel[]>> = {
  'AAQ-II': [
    m(inflexibility, { aversiveBurden: 0.15 }), m(inflexibility, { negAffect: 0.15, fear: 0.1 }), m(inflexibility, { pnrRecent: 0.15, stress: 0.1 }),
    m(inflexibility, { aversiveBurden: 0.15 }), m(inflexibility, { negAffect: 0.15 }),
    (() => ({ construct: (i: Indicators) => 0.5 * inflexibility(i) + 0.5 * (1 - satisfaction(i)), o: 0 }))(), m(inflexibility, { pnrRecent: 0.15, stress: 0.1 }),
  ],
  'GPQ-9': [
    m(pliance, { approvalValue: 0.15 }), m(pliance, { approvalValue: 0.15 }), m(pliance, { approvalValue: 0.15, lonely: 0.05 }), m(pliance, { approvalValue: 0.15, shame: 0.1 }),
    m(pliance, { pliance: 0.15, tracking: -0.1 }), m(pliance, { approvalValue: 0.1, pliance: 0.1 }), m(pliance, { approvalValue: 0.1, pliance: 0.1 }),
    m(pliance, { approvalValue: 0.15, shame: 0.05 }), m(pliance, { pliance: 0.15, tracking: -0.1 }),
  ],
  GTQ: [
    m(trackingTrait, { sensitivity: 0.2 }), m(trackingTrait, { selfFraming: 0.15 }), m(trackingTrait, { selfFraming: 0.1, sensitivity: 0.1 }), m(trackingTrait, { selfFraming: 0.15 }),
    m(trackingTrait, { tracking: 0.15 }, 0.05), m(trackingTrait, { selfFraming: 0.15 }), m(trackingTrait, { selfFraming: 0.1, tracking: 0.1 }), m(trackingTrait, { sensitivity: 0.2 }),
    m(trackingTrait, { sensitivity: 0.2 }), m(trackingTrait, { sensitivity: 0.2 }), m(trackingTrait, { tracking: 0.15 }),
  ],
  'DASS-21': [
    m(tension, { stress: 0.1 }), m(anxiety, { fear: 0.05 }, -0.05), m(depression, { joy: -0.15, mood: -0.1 }), m(anxiety, { fear: 0.1 }, -0.1), m(depression, { energyLack: 0.15 }),
    m(tension, { anger: 0.1 }), m(anxiety, {}, -0.1), m(tension, { energyLack: 0.1 }), m(anxiety, { pnrRecent: 0.1, shame: 0.1 }), m(depression, { funLack: 0.1, valueGap: 0.1 }),
    m(tension, { stress: 0.1 }), m(tension, { stress: 0.1 }), m(depression, { sadness: 0.15 }), m(tension, { anger: 0.1 }), m(anxiety, { pnrLoad: 0.15 }, -0.05),
    m(depression, { funLack: 0.1, valueGap: 0.1 }), m(depression, { aversiveBurden: 0.15 }), m(tension, { anger: 0.15 }), m(anxiety, {}, -0.1), m(anxiety, { fear: 0.15 }, -0.05),
    m(depression, { valueGap: 0.1, valueContact: -0.1 }, 0),
  ],
  SWLS: [
    m(satisfaction), m(satisfaction, { valueContact: 0.1, economicTrajectory: 0.1 }), m(satisfaction),
    m(satisfaction, { resilience: 0.1, stressorExposure: -0.1 }), m(satisfaction, { economicTrajectory: 0.1, health: 0.1 }),
  ],
};

const SCALE_MAX: Record<string, number> = { 'AAQ-II': 7, 'GPQ-9': 7, GTQ: 7, SWLS: 7, 'DASS-21': 3 };

/** `p` en [0,1] → opción de la escala: 1–7 `1 + round(6p)`; 0–3 `min(3, floor(4p))` (R-003). */
export function likert(id: InstrumentId, p: number): number {
  return SCALE_MAX[id] === 7 ? 1 + Math.round(6 * c1(p)) : Math.min(3, Math.floor(4 * c1(p)));
}

/** Los ítems del GHQ-12 por grupo (R-004): concentración, sueño y decisión pesan estrés y sueño; ánimo y valía, el ánimo y la carga aversiva. */
function ghqLevel(n: number, i: Indicators): number {
  if (n === 1 || n === 4) return 0.5 * i.negAffect + 0.3 * i.stress + 0.2 * i.sleepDebt;
  if (n === 2) return 0.4 * i.negAffect + 0.3 * i.stress + 0.3 * i.sleepDebt;
  if (n === 5 || n === 6) return 0.6 * i.negAffect + 0.4 * i.stress;
  if (n === 9 || n === 12) return 0.5 * i.negAffect + 0.5 * (1 - i.mood);
  if (n === 10 || n === 11) return 0.4 * i.negAffect + 0.3 * (1 - i.mood) + 0.3 * i.aversiveBurden;
  return 0.5 * i.negAffect + 0.25 * (1 - i.mood) + 0.25 * i.valueGap; // 3, 7, 8
}

export interface Truthful {
  /** Respuesta verdadera por ítem (`t_i`). */
  t: number[];
  /** `p_i` por ítem (para el informe). */
  p: number[];
}

/**
 * Respuesta verdadera del instrumento para una persona (R-003, R-004). `rng` es el flujo `measure:<instrumento>:<id>:<toma>`:
 * un valor por ítem, en orden.
 */
export function truthfulResponses(id: InstrumentId, ind: Indicators, rng: Rng): Truthful {
  const P = MEASURE_PARAMS;
  const n = INSTRUMENTS[id].items.length;
  const t: number[] = [], p: number[] = [];
  for (let k = 0; k < n; k++) {
    const eps = rng.normal(0, P.epsItem);
    if (id === 'GHQ-12') {
      const z = P.changeGain * (ind.coreNow - ind.coreBase) + P.levelGain * (ghqLevel(k + 1, ind) - P.negRef) + 4 * eps;
      t.push(Math.max(0, Math.min(3, 1 + Math.round(z))));
      p.push(c1((1 + z) / 3));
      continue;
    }
    const item = MODELS[id][k]!;
    const extra = Object.entries(item.extra ?? {}).reduce((s, [key, w]) => s + w * ind[key as Ind], 0);
    const pi = c1(P.construct * item.construct(ind) + extra + (item.o ?? 0) + (P.origin[id] ?? 0) + eps);
    p.push(pi);
    t.push(likert(id, pi));
  }
  return { t, p };
}
