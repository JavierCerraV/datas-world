// Métricas por persona y colector de eventos (spec 028 R-006, R-007). Se miden desde el estado del mundo, nunca desde lo
// que la persona cree; el colector cuenta los tipos pedidos y descarta los eventos (presupuesto de memoria).
import type { WorldEvent } from '../events.ts';
import { idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import type { World } from '../world.ts';
import type { MetricId } from './types.ts';

/** 028 §8: umbral de confianza de un vínculo fuerte (012). */
export const STRONG_BOND_TRUST = 0.5;
/** Días de la media móvil de ánimo y estrés (como las ventanas de 045). */
export const ROLLING_DAYS = 7;

/** Media móvil de los últimos `ROLLING_DAYS` valores diarios, por persona. */
export class Rolling {
  #v = new Map<EntityId, number[]>();
  push(id: EntityId, x: number): void {
    const a = this.#v.get(id) ?? [];
    a.push(x);
    if (a.length > ROLLING_DAYS) a.shift();
    this.#v.set(id, a);
  }
  mean(id: EntityId, fallback: number): number {
    const a = this.#v.get(id);
    return a?.length ? a.reduce((s, x) => s + x, 0) / a.length : fallback;
  }
}

/** Cuenta, por persona, los eventos de los tipos pedidos y descarta el resto. */
export class EventCounter {
  readonly #types: ReadonlySet<string>;
  readonly #n = new Map<string, number>();
  constructor(types: Iterable<string>) {
    this.#types = new Set(types);
  }
  add(events: readonly WorldEvent[]): void {
    for (const e of events) {
      if (!this.#types.has(e.type)) continue;
      const who = (e.payload as { citizenId?: string })?.citizenId;
      const ids = who ? [who] : e.participants.map((p) => p.id);
      for (const id of ids) this.#n.set(`${id}|${e.type}`, (this.#n.get(`${id}|${e.type}`) ?? 0) + 1);
    }
  }
  count(id: EntityId, type: string): number {
    return this.#n.get(`${id}|${type}`) ?? 0;
  }
}

/** Los tipos de evento que piden las métricas (`events:<TYPE>` y `pnr_episodes`). */
export const eventTypesOf = (metrics: readonly MetricId[]): string[] => [
  ...new Set(metrics.flatMap((m) => (m.startsWith('events:') ? [m.slice(7)] : m === 'pnr_episodes' ? ['PNR_EPISODE'] : []))),
];

/** Valor de una métrica de estado de una persona (las de eventos y la psicométrica las pone quien llama). */
export function measure(world: World, id: EntityId, metric: MetricId, rolling: { mood: Rolling; stress: Rolling }, counter: EventCounter): number | null {
  const row = idNumber(id);
  const f = world.components.f32;
  const c = world.citizens.get(id);
  switch (metric) {
    case 'mood': return rolling.mood.mean(id, f['state.mood']?.[row] ?? 0.5);
    case 'stress': return rolling.stress.mean(id, f['state.stress']?.[row] ?? 0);
    case 'money': return world.components.i32.money?.[row] ?? 0;
    case 'debt': return (c?.debts ?? []).reduce((s, d) => s + d.balance, 0);
    case 'employed': return c?.occupation && c.occupation.kind !== 'none' ? 1 : 0;
    case 'bonds': return (c?.bonds ?? []).filter((b) => b.trust >= STRONG_BOND_TRUST).length;
    case 'pnr_episodes': return counter.count(id, 'PNR_EPISODE');
    case 'psychometrics': return null;
    default: return metric.startsWith('events:') ? counter.count(id, metric.slice(7)) : null;
  }
}
