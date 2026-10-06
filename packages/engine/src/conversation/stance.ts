// Postura del ciudadano (spec 043 R-008): cada postura de `chat_stances` es una candidata del punto de decisión
// (040 R-001) con sus aportes por fuente, y se elige por softmax con la temperatura de la 040 R-004. No lee el
// temperamento (009 R-006; 040 INV-002): la temperatura sale de `hist.variability`.
import { strengthContribution, pickIndex, softmax, temperatureOf } from '../decision/select.ts';
import { directValue } from '../functions/learn.ts';
import type { RelationalNetwork } from '../relations/types.ts';
import type { Rng } from '../rng.ts';
import { applicable, ruleContribution } from '../rules/rules.ts';
import type { Rule } from '../rules/rules.ts';
import { valueContribution } from '../rules/values.ts';
import { familiarity, strangerParams } from './familiarity.ts';
import type { ChatParams } from './params.ts';
import { stanceResponse } from './params.ts';
import { citizenAnswered, stanceStrength, visitorValue } from './tone.ts';
import type { LearnerCtx } from './tone.ts';
import type { ChatCatalog, ChatContribution, ConversationState, LiveState, StanceChoice, StanceOption, ToneDef } from './types.ts';

/** Lo que la selección lee de la persona: reglas, red relacional y variabilidad aprendida (nunca `tmp.*`). */
export interface PersonCtx extends LearnerCtx {
  rules: readonly Rule[];
  net?: RelationalNetwork;
  variability: number;
  /** Edad en años: los menores de `MINOR_STRANGER_AGE` no hablan con extraños (R-025). Sin ella no rige la regla. */
  age?: number;
}

/** R-025: las posturas a las que aporta la regla «no hablar con extraños». */
const MINOR_STANCES: ReadonlySet<string> = new Set(['callar', 'evadir', 'terminar']);

/** R-008 [M]: multiplicador del escape por la operación motivadora (energía baja, estrés alto). */
export const motivation = (live: LiveState, params: ChatParams): number =>
  1 + params.motivationWeight * (Math.max(0, 0.3 - live.energy) / 0.3 + Math.max(0, live.stress - 0.5) / 0.5);

/**
 * Aportes de cada postura ante el último tono (R-007, R-008):
 * - `fuerza`: la fuerza de la postura, en la forma logarítmica de la 040;
 * - `reforzador`: acercarse a lo apetitivo (tono y visitante) en proporción a lo que no escapa, y escapar de lo
 *   aversivo de este turno en proporción a su escape;
 * - `negativo`: alivio de la carga acumulada, `escape × carga`; `motivadora`: lo que le suma la operación motivadora;
 * - `regla`: reglas cuyo antecedente es el estímulo del tono y cuya respuesta es la postura (038 R-004);
 * - `valor`: si el estímulo toca una red de valor (038 R-006), para las posturas de acercamiento.
 */
export function stanceOptions(
  s: ConversationState, pc: PersonCtx, cat: ChatCatalog, tone: ToneDef, live: LiveState, now: number, params: ChatParams,
): StanceOption[] {
  const last = s.turns.at(-1);
  const v = last?.toneValue ?? 0;
  const vv = visitorValue(s);
  const appetitive = Math.max(0, v) * tone.magnitude + Math.max(0, vv);
  const aversive = Math.max(0, -v) * tone.magnitude + Math.max(0, -vv);
  const mo = motivation(live, params);
  const sp = strangerParams(params);
  const caut = 1 - familiarity(s, params);
  const value = valueContribution(pc.net, (x) => directValue(s.store, pc.onto, x, '', now, pc.P), tone.stimulus);
  return cat.stances.map((st) => {
    const e = st.escape;
    const sources: ChatContribution[] = [
      { source: 'fuerza', contribution: strengthContribution(stanceStrength(s.store, st)), ref: stanceResponse(st.key) },
      { source: 'reforzador', contribution: params.reinforcerWeight * ((1 - e) * appetitive + e * aversive), ref: tone.stimulus },
    ];
    const relief = params.escapeWeight * e * s.aversiveLoad;
    if (relief > 0) {
      sources.push({ source: 'negativo', contribution: relief, ref: 'carga' });
      if (mo > 1) sources.push({ source: 'motivadora', contribution: relief * (mo - 1), ref: live.energy < 0.3 ? 'need.energy' : 'state.stress' });
    }
    for (const r of applicable(pc.rules, tone.stimulus, stanceResponse(st.key)))
      sources.push({ source: 'regla', contribution: ruleContribution(r), ref: `${r.resp}:${r.cons}` });
    if (value && e < 0.5) sources.push({ source: 'valor', contribution: (1 - e) * value.value, ref: value.root });
    // R-025: ante un desconocido, exponerse cuesta y callarse, evadir o responder breve alivia; un menor de 14 años
    // además tiene la regla «no hablar con extraños». La cautela decae con la familiaridad (R-024).
    const cautela = sp.exposureCost * caut * (0.5 - (st.exposure ?? 0.5));
    if (Math.abs(cautela) > 1e-9) sources.push({ source: 'cautela', contribution: cautela, ref: 'desconocido' });
    if (pc.age !== undefined && pc.age < sp.minorAge && MINOR_STANCES.has(st.key) && caut > 0)
      sources.push({ source: 'regla', contribution: sp.minorRule * caut, ref: 'regla.no_hablar_con_extranos' });
    return { stance: st.key, value: sources.reduce((a, x) => a + x.contribution, 0), sources };
  });
}

const byMagnitude = (a: ChatContribution, b: ChatContribution) =>
  Math.abs(b.contribution) - Math.abs(a.contribution) || (a.source < b.source ? -1 : 1);

/**
 * Elige la postura (R-008) y la anota en la charla. Con `forced` (fin por compromiso o por tiempo, R-019), la
 * postura es esa y no se consume azar.
 */
export function selectStance(
  s: ConversationState, pc: PersonCtx, cat: ChatCatalog, tone: ToneDef, live: LiveState, now: number, params: ChatParams,
  rng: Rng, forced?: string,
): StanceChoice {
  const options = stanceOptions(s, pc, cat, tone, live, now, params);
  const p = softmax(options.map((o) => o.value), temperatureOf(pc.variability));
  const k = forced !== undefined ? options.findIndex((o) => o.stance === forced) : pickIndex(p, rng.next());
  if (k < 0) throw new Error(`Postura desconocida: ${forced}`);
  const chosen = options[k]!;
  citizenAnswered(s, chosen.stance);
  return {
    stance: chosen.stance,
    sources: [...chosen.sources].sort(byMagnitude),
    probabilities: options.map((o, i) => ({ stance: o.stance, p: p[i]! })),
    forced: forced !== undefined,
  };
}
