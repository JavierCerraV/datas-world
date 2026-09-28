// Escenario V-10 de la batería 042 (bloque MF6.5): el bucle de PNR con el núcleo de la 039 (`stepMind`), sin mundo.
// Una persona con una historia de desconfianza hacia un amigo y una red en la que la desconfianza lleva al engaño, la
// traición, el abandono y la soledad; 10 disparos («no puedo confiar en él»), uno por día. Tres condiciones:
// - `evitacion`: en pleno episodio se distrae con la probabilidad de su fuerza de evitación aprendida (036 R-002);
// - `exposicion`: se queda con el pensamiento (sin evitar ni tomar distancia);
// - `yo`: enmarque con «Yo» reforzado y un valor (la amistad) al alcance (039 R-006, R-007).
import { ACTIVITY } from '../activity.ts';
import { ownValue } from '../functions/learn.ts';
import { createOntology } from '../functions/sensitivity.ts';
import { LEARNING_DEFAULTS, NEUTRAL, emptyStore } from '../functions/types.ts';
import type { FunctionStore } from '../functions/types.ts';
import type { EntityId } from '../ids.ts';
import { networkMetrics, teach } from '../relations/network.ts';
import type { NetworkMetrics, RelationalNetwork } from '../relations/types.ts';
import { AVOIDANCE_W0, PRIVATE_DEFAULTS, SELF_RESPONSE } from '../private/params.ts';
import { responseStrength } from '../private/pnr.ts';
import { stepMind } from '../private/system.ts';
import type { MindState } from '../private/types.ts';
import { createRng } from '../rng.ts';

export type PnrCondition = 'evitacion' | 'exposicion' | 'yo';

export interface TriggerStats {
  /** Episodios que empezaron tras el disparo. */
  episodes: number;
  /** Minutos con un episodio en curso. */
  minutes: number;
  /** Función aprendida del disparador después del día (su extinción o su conservación). */
  triggerFn: number;
}

export interface PnrResult {
  perTrigger: TriggerStats[];
  before: NetworkMetrics;
  after: NetworkMetrics;
  /** Fuerzas finales de la evitación por distracción y del enmarque con «Yo». */
  avoidance: number;
  self: number;
}

const TRIGGER = 'verbal.desconfianza';
const CHAIN = ['verbal.desconfianza', 'verbal.engano', 'verbal.traicion', 'verbal.abandono', 'verbal.soledad'];
const onto = createOntology([
  ...CHAIN.map((key, i) => ({ key, kind: 'verbal_term' as const, features: [1, i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0, i === 3 ? 1 : 0, i === 4 ? 1 : 0] })),
  { key: 'dominio.amistad', kind: 'verbal_term' as const, features: [0, 0, 0, 0, 0, 0] },
]);

function setup(cond: PnrCondition): { store: FunctionStore; net: RelationalNetwork } {
  const store = emptyStore();
  store.f.push({ s: TRIGGER, v: -0.8, c: '', inh: [], hab: 0, n: 5, rs: [], o: 'direct', src: [], at: 0 });
  store.r.push({ r: SELF_RESPONSE, c: '', w: cond === 'yo' ? 0.5 : 0, n: 0, at: 0 });
  if (cond === 'yo') store.f.push({ s: 'dominio.amistad', v: 0.7, c: '', inh: [], hab: 0, n: 5, rs: [], o: 'direct', src: [], at: 0 });
  const net: RelationalNetwork = { e: [], pruned: 0 };
  for (let i = 0; i + 1 < CHAIN.length; i++) teach(net, { a: CHAIN[i]!, b: CHAIN[i + 1]!, t: 'coordination', s: 0.8, now: 0 });
  return { store, net };
}

/** V-10: 10 disparos, uno por día, en la condición dada. */
export function pnrProtocol(cond: PnrCondition, seed = 42, triggers = 10): PnrResult {
  const p = PRIVATE_DEFAULTS;
  const { store, net } = setup(cond);
  const before = networkMetrics(net);
  const mind: MindState = { active: [] };
  const rng = createRng(seed).fork(`lab:pnr:${cond}`);
  const perTrigger: TriggerStats[] = [];
  let now = 0;
  for (let d = 0; d < triggers; d++) {
    const stats: TriggerStats = { episodes: 0, minutes: 0, triggerFn: 0 };
    let distracted = 0;
    for (let tick = 0; tick < 288; tick++, now += 5) {
      const inEpisode = mind.episode !== undefined;
      if (distracted === 0 && inEpisode && cond === 'evitacion' && rng.next() < responseStrength(store, 'evit.distraccion', AVOIDANCE_W0)) distracted = 6;
      const act = distracted > 0 ? ACTIVITY.leisure : ACTIVITY.idle;
      if (distracted > 0) distracted--;
      stepMind(mind, store, net, { id: 'CIT-000001' as EntityId, onto, P: LEARNING_DEFAULTS, sens: NEUTRAL, now, tickMinutes: 5, level: 2, act },
        tick === 0 ? [{ s: TRIGGER, cause: `EVT-${d}` }] : [], rng.fork(now), p);
      if (!inEpisode && mind.episode) stats.episodes++;
      if (mind.episode) stats.minutes += 5;
    }
    stats.triggerFn = ownValue(store.f.find((f) => f.s === TRIGGER)!, '', now, LEARNING_DEFAULTS); // con su inhibición
    perTrigger.push(stats);
  }
  return { perTrigger, before, after: networkMetrics(net), avoidance: responseStrength(store, 'evit.distraccion', AVOIDANCE_W0), self: responseStrength(store, SELF_RESPONSE, 0) };
}
