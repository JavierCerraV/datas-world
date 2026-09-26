// Valores como subredes jerárquicas (spec 038 R-006, R-007, R-009) y aparición de pensamientos (CA-002).
import { derive } from '../relations/derive.ts';
import { CFUNC_DEFAULT } from '../relations/types.ts';
import type { Derived, RelationalNetwork } from '../relations/types.ts';

/** Prefijo de las raíces posibles de un valor: los dominios vitales del catálogo `life_domains` (R-009). */
export const DOMAIN_PREFIX = 'dominio.';

/** Umbral de aparición de un pensamiento: fuerza de la relación que lo evoca (038 §8, PA-133) [M]. */
export const THOUGHT_THRESHOLD = 0.6;

/**
 * R-006: aporte apetitivo de un estímulo que "señala" un valor: la función de la raíz (dominio vital con función
 * apetitiva aprendida) transformada por el camino jerárquico `part_of` (fuerza y Cfunc, 037 R-003). El mayor de
 * los valores alcanzables, o `undefined`.
 */
export function valueContribution(
  net: RelationalNetwork | undefined,
  directOf: (stim: string) => number,
  stim: string,
  ctx = '',
): { value: number; root: string; derived: Derived } | undefined {
  if (!net || net.e.length === 0) return undefined;
  let best: { value: number; root: string; derived: Derived } | undefined;
  for (const d of derive(net, stim, ctx, true)) {
    if (d.t !== 'part_of' || !d.to.startsWith(DOMAIN_PREFIX)) continue;
    const root = directOf(d.to);
    if (root <= 0) continue;
    const value = root * d.s * (d.cfunc ? 1 : CFUNC_DEFAULT);
    if (!best || value > best.value) best = { value, root: d.to, derived: d };
  }
  return best;
}

/**
 * CA-002: el pensamiento `thought` aparece ante el estímulo `trigger` si la relación de coordinación que los une
 * (enseñada o derivada) alcanza el umbral.
 */
export function thoughtAppears(net: RelationalNetwork, trigger: string, thought: string, ctx = ''): boolean {
  return derive(net, trigger, ctx).some((d) => d.to === thought && d.t === 'coordination' && d.s >= THOUGHT_THRESHOLD);
}
