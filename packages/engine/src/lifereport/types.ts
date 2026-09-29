// Tipos del informe de vida (spec 020 v0.3 §3).
import type { WhyNode } from '../causality/why.ts';
import type { WorldEvent } from '../events.ts';
import type { EntityId } from '../ids.ts';
import { MEMORY_KINDS } from '../memory/kinds.ts';
import type { DeepReadonly, WorldView } from '../simulation/system.ts';

/** Un día de la trayectoria (020 R-001); la persistencia la guarda con la instantánea diaria. */
export interface DayPoint {
  day: number;
  mood: number;
  stress: number;
  money: number;
  sleepDebt: number;
}

/** Capítulo objetivo (R-004): se deriva de los hechos, no de lo que la persona codificó. */
export interface LifeChapter {
  from: number;
  to?: number;
  theme: string;
  openedBy?: EntityId;
  /** [-1,1]: el valor de sus hechos según su tipo y, donde hay trayectoria, el cambio real de ánimo. */
  tone: number;
  events: EntityId[];
}

export interface Divergence {
  /** Índice del capítulo objetivo. */
  chapter: number;
  kind: 'tone' | 'missing' | 'boundary';
  note: string;
  /** Capítulo recordado con el que se compara (si lo hay). */
  remembered?: string;
}

export interface TurningPoint {
  event: EntityId;
  consequences: number;
  moodDelta?: number;
  moneyDelta?: number;
  why: WhyNode;
}

export type ProfileKey = 'jobStability' | 'relationshipStability' | 'socialNetwork' | 'stressorExposure' | 'economicTrajectory' | 'resilience';

/** Perfil emergente (R-006): cada valor en [0,1] o `null` si la historia no da base para calcularlo. */
export interface EmergentProfile {
  values: Record<ProfileKey, number | null>;
  basis: Record<ProfileKey, EntityId[]>;
}

export interface ReportInput {
  view: WorldView;
  id: EntityId;
  /** Los hechos de la persona (participa) y las muertes de su familia, en orden de id. */
  events: readonly WorldEvent[];
  /** Búsqueda en el registro, para los árboles `why`. */
  get: (id: string) => WorldEvent | undefined;
  trajectory: readonly DayPoint[];
  now: number;
  /** Cambia ids por nombres en los textos. */
  names?: (text: string) => string;
}

export const DAY = 1440;
export const YEAR = 365.25 * DAY;
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const clamp1 = (x: number) => Math.max(-1, Math.min(1, x));
export const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** El valor de un hecho según su tipo (λ de la 013), sin la reconstrucción de la persona; 0 si no tiene. */
export function lambdaOf(e: DeepReadonly<WorldEvent>): number {
  const k = MEMORY_KINDS[e.type];
  if (!k) return 0;
  return typeof k.lambda === 'number' ? k.lambda : k.lambda(e);
}

/** El punto de la trayectoria de ese día o el más cercano anterior. */
export function pointAt(t: readonly DayPoint[], day: number): DayPoint | undefined {
  let best: DayPoint | undefined;
  for (const p of t) {
    if (p.day > day) break;
    best = p;
  }
  return best;
}
