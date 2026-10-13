// La dosis del protocolo (spec 047 R-004, R-006). El LLM no cambia a la persona: la cambia el motor, con ensayos de
// aprendizaje de los mecanismos que ya existen (036, 039), y solo por los intercambios en que la persona estuvo presente
// según la postura que el motor le eligió (INV-001). Puro y sin azar. Todos los parámetros son [M] y no se ajustan para
// que salga un efecto.
import { operant, pair } from '../functions/learn.ts';
import type { FunctionStore, LearningParams, Ontology, Sensitivity } from '../functions/types.ts';
import { AVOIDANCE_RESPONSES, AVOIDANCE_W0, PRIVATE_DEFAULTS, SELF_RESPONSE } from '../private/params.ts';
import { responseStrength, seedResponse } from '../private/pnr.ts';
import { DOMAIN_PREFIX } from '../rules/values.ts';
import type { ProtocolSession } from './types.ts';

/** Ensayos de aprendizaje por mecanismo. */
export interface Dose {
  yo: number;
  extincion: number;
  valores: number;
}

export const NO_DOSE: Dose = Object.freeze({ yo: 0, extincion: 0, valores: 0 });

export const PROTOCOL_PARAMS = Object.freeze({
  /**
   * Cuánto cuenta un intercambio según la postura de la persona (043): presente del todo si se abre, a medias si
   * responde lo justo, poco si complace (decir que sí no es contactar con el ejercicio) y nada si evade, calla, ataca,
   * pone un límite o se va.
   */
  engagement: Object.freeze({ abrirse: 1, responder_breve: 0.5, aplacar: 0.25 } as Record<string, number>),
  /** Fuerza de un ensayo de práctica con audio frente a uno de sesión (R-004: «media dosis»). */
  practiceStrength: 0.5,
  /** R-006: probabilidad diaria de practicar en las mejores condiciones. */
  practiceBase: 0.6,
  /** R-006: cuánto baja sin valores a su alcance. */
  practiceNoValue: 0.75,
  /** Dominios vitales que se refuerzan como mucho («las cuatro plantas»). */
  maxDomains: 4,
  /** R-013: probabilidad de volver a la sesión siguiente con un terapeuta neutro para ella, y cuánto la mueve su valor. */
  attendBase: 0.9,
  attendValueWeight: 0.3,
  attendMin: 0.3,
});

/** Un turno del terapeuta que la persona respondió: qué componente trabajaba y con qué postura respondió ella. */
export interface Exchange {
  component: string;
  stance: string;
}

const weightOf = (stance: string): number => PROTOCOL_PARAMS.engagement[stance] ?? 0;

/**
 * De la sesión a la dosis. Cada intercambio sobre un componente de un mecanismo con dosis suma el compromiso de la
 * persona en ese turno; la suma, por `scale` (análisis de sensibilidad, R-009), se redondea a ensayos enteros.
 * `engagement` es el compromiso medio de toda la sesión.
 */
export function sessionDose(session: ProtocolSession, exchanges: readonly Exchange[], scale = 1): { dose: Dose; engagement: number } {
  const sum = { yo: 0, extincion: 0, valores: 0 };
  for (const x of exchanges) {
    const m = session.components.find((c) => c.id === x.component)?.mechanism;
    if (m === 'yo' || m === 'extincion' || m === 'valores') sum[m] += weightOf(x.stance);
  }
  const engagement = exchanges.length === 0 ? 0 : exchanges.reduce((a, x) => a + weightOf(x.stance), 0) / exchanges.length;
  return { dose: { yo: Math.round(sum.yo * scale), extincion: Math.round(sum.extincion * scale), valores: Math.round(sum.valores * scale) }, engagement };
}

export interface DoseEffect {
  yo: { from: number; to: number };
  /** Media de las cinco respuestas de evitación. */
  avoidance: { from: number; to: number };
  /** Dominios vitales reforzados. */
  domains: string[];
}

const mean = (xs: readonly number[]) => xs.reduce((a, x) => a + x, 0) / (xs.length || 1);

/**
 * Aplica la dosis al almacén de la persona (lo muta). `strength` 1 es un ensayo de sesión; 0,5, uno de práctica.
 * - `yo`: ensayos reforzados del enmarque con «Yo» (039 R-006).
 * - `extincion`: contacto con el evento privado sin evitarlo: las respuestas de evitación se emiten sin alivio (039 R-004).
 * - `valores`: se refuerzan los dominios vitales que ya son apetitivos para ella (038 R-006). No se le inventa un valor.
 */
export function applyDose(store: FunctionStore, onto: Ontology, P: LearningParams, sens: Sensitivity, dose: Dose, strength: number, now: number, source?: string): DoseEffect {
  const yo0 = responseStrength(store, SELF_RESPONSE, PRIVATE_DEFAULTS.selfW0);
  const av0 = mean(AVOIDANCE_RESPONSES.map((r) => responseStrength(store, r, AVOIDANCE_W0)));
  if (dose.yo > 0) seedResponse(store, SELF_RESPONSE, PRIVATE_DEFAULTS.selfW0, now);
  for (let i = 0; i < dose.yo; i++) {
    const w = responseStrength(store, SELF_RESPONSE, PRIVATE_DEFAULTS.selfW0);
    operant(store, SELF_RESPONSE, '', w + strength * (1 - w), now, P, sens, source);
  }
  if (dose.extincion > 0) for (const r of AVOIDANCE_RESPONSES) seedResponse(store, r, AVOIDANCE_W0, now);
  for (let i = 0; i < dose.extincion; i++)
    for (const r of AVOIDANCE_RESPONSES) operant(store, r, '', responseStrength(store, r, AVOIDANCE_W0) * (1 - strength), now, P, sens, source);
  const domains = dose.valores === 0 ? [] : store.f
    .filter((f) => f.s.startsWith(DOMAIN_PREFIX) && f.c === '' && f.v > 0)
    .sort((a, b) => b.v - a.v || (a.s < b.s ? -1 : 1))
    .slice(0, PROTOCOL_PARAMS.maxDomains)
    .map((f) => f.s);
  for (let i = 0; i < dose.valores; i++) for (const stim of domains) pair(store, onto, { stim, ctx: '', now, lambda: strength }, P, sens);
  return {
    yo: { from: yo0, to: responseStrength(store, SELF_RESPONSE, PRIVATE_DEFAULTS.selfW0) },
    avoidance: { from: av0, to: mean(AVOIDANCE_RESPONSES.map((r) => responseStrength(store, r, AVOIDANCE_W0))) },
    domains,
  };
}

/** Si la persona tiene algún dominio vital apetitivo: lo que sostiene el «Yo» fuera de la sesión (039 R-007). */
export const hasValue = (store: FunctionStore): boolean => store.f.some((f) => f.s.startsWith(DOMAIN_PREFIX) && f.v > 0);

/** R-006: probabilidad de practicar hoy, según el estrés, la energía y si tiene valores a su alcance. */
export function practiceProbability(x: { stress: number; energy: number; hasValue: boolean }): number {
  const p = PROTOCOL_PARAMS.practiceBase * (0.5 + 0.5 * x.energy) * (1 - 0.5 * x.stress) * (x.hasValue ? 1 : PROTOCOL_PARAMS.practiceNoValue);
  return Math.max(0, Math.min(1, p));
}

/** R-013: probabilidad de volver a la sesión siguiente, según lo que el terapeuta vale ya para ella (043 R-006). */
export function attendProbability(therapistValue: number): number {
  return Math.max(PROTOCOL_PARAMS.attendMin, Math.min(1, PROTOCOL_PARAMS.attendBase + PROTOCOL_PARAMS.attendValueWeight * therapistValue));
}
