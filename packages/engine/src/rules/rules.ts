// Reglas (spec 038 R-002 a R-005, INV-001, INV-003): adquisición con su arista en la red relacional, tipo según la
// historia, aporte a la selección y cambio por el contraste entre lo especificado y lo experimentado.
import { teach } from '../relations/network.ts';
import type { RelationalNetwork } from '../relations/types.ts';

export interface Rule {
  id: number;
  /** Contexto en que aplica (actividad de la rutina, 'lab'…). */
  ante: string;
  /** Respuesta especificada. */
  resp: string;
  /** Consecuencia especificada (estímulo; puede ser verbal). */
  cons: string;
  src: 'speaker' | 'self';
  speaker?: string;
  s: number;
  contrast: number;
  hist: { followed: number; byContingency: number; bySpeaker: number };
  /** Augmental formativo (R-008): la consecuencia solo tiene función derivada. */
  aug?: boolean;
  at: number;
}

export type RuleKind = 'pliance' | 'tracking' | 'augmenting';

/** 038 §8 [M]. */
export const MAX_RULES = 32;
export const PLIANCE_DISCOUNT = 0.3;
export const LAB_CONTRAST_RATE = 0.1;
export const SPEAKER_APPROVAL_BONUS = 0.5;

/** R-003: tipo según la historia de seguimiento (o, sin historia, según quién la formuló). */
export function kindOf(r: Rule): RuleKind {
  if (r.aug) return 'augmenting';
  const { byContingency, bySpeaker } = r.hist;
  if (bySpeaker > byContingency) return 'pliance';
  if (byContingency > 0) return 'tracking';
  return r.src === 'speaker' ? 'pliance' : 'tracking';
}

/** R-004: aporte de una regla a la respuesta que especifica, `s × (1 − contraste × d)`. */
export const ruleContribution = (r: Rule): number => r.s * (1 - r.contrast * (kindOf(r) === 'pliance' ? PLIANCE_DISCOUNT : 1));

/** Reglas aplicables a una respuesta en un contexto. */
export const applicable = (rules: readonly Rule[] | undefined, ante: string, resp: string): Rule[] => (rules ?? []).filter((r) => r.ante === ante && r.resp === resp);

export interface NewRule {
  ante: string;
  resp: string;
  cons: string;
  src: 'speaker' | 'self';
  speaker?: string;
  s: number;
  aug?: boolean;
  /** Valor de la aprobación del hablante (036), si es reforzador generalizado: bonifica la fuerza (R-002). */
  approval?: number;
  now: number;
  source?: string;
}

/**
 * R-002, INV-001, INV-003: añade una regla con su arista `resp causes cons` (crel = antecedente) en la red y poda
 * por encima de 32 (la de menor aporte y más antigua). Devuelve la regla.
 */
export function addRule(rules: Rule[], net: RelationalNetwork, x: NewRule): Rule {
  const s = Math.min(1, x.s * (1 + SPEAKER_APPROVAL_BONUS * Math.max(0, x.approval ?? 0)));
  const r: Rule = {
    id: rules.reduce((m, y) => Math.max(m, y.id), 0) + 1,
    ante: x.ante,
    resp: x.resp,
    cons: x.cons,
    src: x.src,
    ...(x.speaker ? { speaker: x.speaker } : {}),
    s,
    contrast: 0,
    hist: { followed: 0, byContingency: 0, bySpeaker: 0 },
    ...(x.aug ? { aug: true } : {}),
    at: x.now,
  };
  rules.push(r);
  teach(net, { a: x.resp, b: x.cons, t: 'causes', s, crel: x.ante, now: x.now, ...(x.source ? { source: x.source } : {}) });
  if (rules.length > MAX_RULES) {
    const drop = [...rules].sort((p, q) => ruleContribution(p) - ruleContribution(q) || p.at - q.at)[0]!;
    rules.splice(rules.indexOf(drop), 1);
  }
  return r;
}

/**
 * R-005: seguir la regla y observar la consecuencia. `discrepancy` ∈ [0,1] entre lo especificado y lo
 * experimentado; `bySpeaker` si el refuerzo vino del hablante (aprobación) y no de la contingencia.
 */
export function observe(r: Rule, discrepancy: number, rate: number, reinforcedBy?: 'contingency' | 'speaker'): void {
  r.hist.followed += 1;
  r.contrast = Math.min(1, Math.max(0, r.contrast + rate * (discrepancy - r.contrast)));
  if (reinforcedBy === 'contingency') r.hist.byContingency += 1;
  if (reinforcedBy === 'speaker') r.hist.bySpeaker += 1;
}
