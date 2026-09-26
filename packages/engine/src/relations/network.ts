// Enseñanza de relaciones, poda y propiedades de la red (spec 037 R-007, R-008, INV-004).
import { derive, transformFactor } from './derive.ts';
import { MAX_RELATIONS } from './types.ts';
import type { NetworkMetrics, Relation, RelationType, RelationalNetwork } from './types.ts';

export interface Teaching {
  a: string;
  b: string;
  t: RelationType;
  s: number;
  crel?: string;
  cfunc?: string;
  source?: string;
  now: number;
}

/** R-007 [M]: enseña (o refuerza, `+0,3 × (1 − s)`) una relación; poda por encima del tope (INV-004). */
export function teach(net: RelationalNetwork, x: Teaching): Relation {
  let r = net.e.find((e) => e.a === x.a && e.b === x.b && e.t === x.t && (e.crel ?? '') === (x.crel ?? ''));
  if (r) {
    r.s = Math.min(1, r.s + 0.3 * (1 - r.s));
    r.at = x.now;
  } else {
    r = { a: x.a, b: x.b, t: x.t, s: Math.min(1, Math.max(0, x.s)), o: 'taught', src: [], at: x.now, ...(x.crel ? { crel: x.crel } : {}), ...(x.cfunc ? { cfunc: x.cfunc } : {}) };
    net.e.push(r);
  }
  if (x.source && !r.src.includes(x.source)) r.src = [...r.src, x.source].slice(-3);
  if (net.e.length > MAX_RELATIONS) {
    const keep = [...net.e].sort((p, q) => q.s - p.s || q.at - p.at).slice(0, MAX_RELATIONS);
    net.pruned += net.e.length - MAX_RELATIONS;
    net.e = net.e.filter((e) => keep.includes(e));
  }
  return r;
}

/** R-008 [M]: coherencia, complejidad, nivel de derivación y flexibilidad de la red. */
export function networkMetrics(net: RelationalNetwork): NetworkMetrics {
  const nodes = [...new Set(net.e.flatMap((e) => [e.a, e.b]))].sort();
  if (net.e.length === 0) return { coherence: 1, complexity: 0, derivationLevel: 1, flexibility: 0 };
  // Coherencia: pares (X, Y) derivados sin transformaciones de signo opuesto.
  let pairs = 0;
  let incoherent = 0;
  for (const x of nodes) {
    const signs = new Map<string, Set<number>>();
    for (const d of derive(net, x)) {
      const f = Math.sign(transformFactor(d.t));
      if (f === 0) continue;
      const set = signs.get(d.to) ?? new Set<number>();
      set.add(f);
      signs.set(d.to, set);
    }
    for (const set of signs.values()) {
      pairs++;
      if (set.size > 1) incoherent++;
    }
  }
  // Flexibilidad: pares con tipos distintos bajo claves `crel` distintas.
  const byPair = new Map<string, Set<string>>();
  for (const e of net.e) {
    const key = e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`;
    const set = byPair.get(key) ?? new Set<string>();
    set.add(`${e.crel ?? ''}:${e.a < e.b ? e.t : `inv.${e.t}`}`);
    byPair.set(key, set);
  }
  let flexible = 0;
  for (const set of byPair.values()) {
    const crels = new Set([...set].map((x) => x.split(':')[0]));
    const types = new Set([...set].map((x) => x.split(':')[1]));
    if (crels.size > 1 && types.size > 1) flexible++;
  }
  return {
    coherence: pairs ? 1 - incoherent / pairs : 1,
    complexity: net.e.length / nodes.length,
    derivationLevel: 1 - net.e.filter((e) => e.o === 'derived_stored').length / net.e.length,
    flexibility: byPair.size ? flexible / byPair.size : 0,
  };
}
