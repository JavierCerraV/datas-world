// Escenarios de reglas y valores de la batería 042 (bloque MF5): V-9 (insensibilidad por reglas), V-11b (rechazos →
// "no quieren pasar tiempo conmigo") y 038 CA-003 (una acción que señala un valor). Solo mecanismos de la 036–040
// con sus parámetros por defecto (042 R-002).
import { pickIndex, softmax, strengthContribution, temperatureOf } from '../decision/select.ts';
import { DEFAULT_VARIABILITY } from '../functions/history.ts';
import { operant } from '../functions/learn.ts';
import { NEUTRAL, LEARNING_DEFAULTS, emptyStore } from '../functions/types.ts';
import { createRng } from '../rng.ts';
import { functionalValue } from '../relations/derive.ts';
import { teach } from '../relations/network.ts';
import { emptyNetwork } from '../relations/types.ts';
import { LAB_CONTRAST_RATE, addRule, applicable, observe, ruleContribution } from '../rules/rules.ts';
import type { Rule } from '../rules/rules.ts';
import { DOMAIN_PREFIX, thoughtAppears, valueContribution } from '../rules/values.ts';

export type RuleGroup = 'moldeado' | 'pliance' | 'tracking';

/**
 * V-9: dos respuestas (A y B) con probabilidad de refuerzo 0,8 y 0,2 durante 100 ensayos; después se invierten.
 * El grupo instruido recibe la regla "responde A" (dicha por el experimentador) con fuerza `s`: en pliance, seguirla
 * se refuerza por el hablante en cada ensayo; en tracking, solo por la contingencia. Devuelve los ensayos de la fase
 * invertida hasta ajustarse (8 de las últimas 10 respuestas a B), con un máximo de 300.
 */
export function ruleInsensitivity(group: RuleGroup, seed: number, s = 0.8): number {
  const store = emptyStore();
  for (const r of ['A', 'B']) store.r.push({ r, c: 'lab', w: 0.3, n: 0, at: 0 });
  const rules: Rule[] = [];
  const net = emptyNetwork();
  if (group !== 'moldeado') addRule(rules, net, { ante: 'lab', resp: 'A', cons: 'refuerzo', src: group === 'pliance' ? 'speaker' : 'self', s, now: 0 });
  const rng = createRng(seed).fork('lab:reglas');
  const T = temperatureOf(DEFAULT_VARIABILITY);
  const recent: number[] = [];
  for (let t = 0; t < 400; t++) {
    const inverted = t >= 100;
    const values = ['A', 'B'].map((r, k) => strengthContribution(store.r[k]!.w) + applicable(rules, 'lab', r).reduce((a, x) => a + ruleContribution(x), 0));
    const k = pickIndex(softmax(values, T), rng.next());
    const p = k === 0 ? (inverted ? 0.2 : 0.8) : inverted ? 0.8 : 0.2;
    const out = rng.next() < p ? 1 : 0;
    operant(store, k === 0 ? 'A' : 'B', 'lab', out, t, LEARNING_DEFAULTS, NEUTRAL);
    for (const rule of applicable(rules, 'lab', k === 0 ? 'A' : 'B')) {
      // La regla promete refuerzo: la discrepancia es 1 − resultado.
      observe(rule, 1 - out, LAB_CONTRAST_RATE, out ? 'contingency' : undefined);
      if (group === 'pliance') rule.hist.bySpeaker += 1; // el experimentador presente refuerza obedecer
    }
    if (inverted) {
      recent.push(k);
      if (recent.length > 10) recent.shift();
      if (recent.length === 10 && recent.filter((x) => x === 1).length >= 8) return t - 100;
    }
  }
  return 300;
}

/**
 * V-11b: red de amistad ("quieren pasar tiempo conmigo" es parte de `dominio.amistad`, con función apetitiva 0,8) y
 * su opuesto ("no quieren…"). Cada rechazo a una invitación enseña (o refuerza) "rechazo = no quieren…". Devuelve,
 * tras cada rechazo, si el pensamiento aparece y su valor funcional.
 */
export function rejectionScenario(withValue = true, rejections = 3): { appears: boolean; thought: number }[] {
  const net = emptyNetwork();
  if (withValue) teach(net, { a: 'verbal.quieren_pasar_tiempo', b: 'dominio.amistad', t: 'part_of', s: 0.9, now: 0 });
  teach(net, { a: 'verbal.no_quieren_pasar_tiempo', b: 'verbal.quieren_pasar_tiempo', t: 'opposition', s: 0.9, now: 0 });
  const direct = (x: string) => (withValue && x === 'dominio.amistad' ? 0.8 : 0);
  const out: { appears: boolean; thought: number }[] = [];
  for (let k = 1; k <= rejections; k++) {
    teach(net, { a: 'evento.rechazo_invitacion', b: 'verbal.no_quieren_pasar_tiempo', t: 'coordination', s: 0.4, now: k });
    out.push({
      appears: thoughtAppears(net, 'evento.rechazo_invitacion', 'verbal.no_quieren_pasar_tiempo'),
      thought: functionalValue(net, direct, 'verbal.no_quieren_pasar_tiempo').value,
    });
  }
  return out;
}

/**
 * 038 CA-003: "llamar a un amigo" tiene función aversiva directa (−0,3) y es parte de la amistad (fuerza `s`), con
 * función apetitiva 0,8. Devuelve la fuente `valor` y la aversión (valor funcional) de la acción.
 */
export function valueSignal(s = 0.9): { value: number; aversion: number } {
  const net = emptyNetwork();
  teach(net, { a: 'accion.llamar_amigo', b: 'dominio.amistad', t: 'part_of', s, now: 0 });
  const direct = (x: string) => (x === 'dominio.amistad' ? 0.8 : x === 'accion.llamar_amigo' ? -0.3 : 0);
  // Como en la selección (040): la aversión se calcula sin las raíces de valor, que aporta la fuente `valor`.
  const withoutValues = (x: string) => (x.startsWith(DOMAIN_PREFIX) ? 0 : direct(x));
  return {
    value: valueContribution(net, direct, 'accion.llamar_amigo')?.value ?? 0,
    aversion: Math.min(0, functionalValue(net, withoutValues, 'accion.llamar_amigo').value),
  };
}
