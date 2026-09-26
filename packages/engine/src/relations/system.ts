// Sistema `relations` (spec 037 R-007; bloque MF4.1): en la fase `memory`, la comunidad verbal enseña relaciones en
// los eventos del tick que ya tienen un hablante. Sin conversaciones hasta M3 (025): es el enganche mínimo.
import type { EventType, WorldEvent } from '../events.ts';
import { formatId, idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import type { Patch, System, SystemOutput, TickCtx, WorldView } from '../simulation/system.ts';
import { teach } from './network.ts';
import { emptyNetwork } from './types.ts';
import type { RelationType, RelationalNetwork } from './types.ts';

export interface TeachingRule {
  /** Quién habla (para la explicación). */
  speaker: string;
  /** Rol del participante que aprende. */
  learner: string;
  a: string;
  b: string;
  t: RelationType;
  s: number;
  /** Solo si el evento cumple la condición. */
  when?: (e: WorldEvent) => boolean;
}

/** 037 R-007 [M]: qué relación enseña cada evento con hablante, y con qué fuerza. */
export const EVENT_TEACHING: Readonly<Partial<Record<EventType, readonly TeachingRule[]>>> = Object.freeze({
  JOB_WARNING: [{ speaker: 'rol.jefe', learner: 'empleado', a: 'verbal.llegar_tarde', b: 'verbal.despido', t: 'causes', s: 0.6 }],
  DEBT_TAKEN: [
    {
      speaker: 'gota_a_gota',
      learner: 'deudor',
      a: 'verbal.no_pagar',
      b: 'cuerpo.dolor',
      t: 'causes',
      s: 0.7,
      when: (e) => (e.payload as { creditor?: string }).creditor === 'gota_a_gota',
    },
  ],
});

/** Copia de trabajo de la red de una persona (por JSON: la vista congelada devuelve Proxies). */
export const relationalNetworkOf = (view: WorldView, row: number): RelationalNetwork => {
  const own = view.citizens.get(formatId('CIT', row))?.network;
  return own ? (JSON.parse(JSON.stringify(own)) as RelationalNetwork) : emptyNetwork();
};

export const relationsSystem: System = {
  id: 'relations',
  // Después del aprendizaje directo (orden 1): enseña con las consecuencias del tick ya aprendidas.
  phase: 'memory',
  order: 2,
  capability: 'learning',
  cadence: 'tick',
  minLevel: 0,
  run: (view: WorldView, ctx: TickCtx): SystemOutput => {
    if (ctx.events.length === 0) return {};
    const active = new Set(ctx.citizens);
    const nets = new Map<number, RelationalNetwork>();
    for (const e of ctx.events) {
      for (const rule of EVENT_TEACHING[e.type] ?? []) {
        if (rule.when && !rule.when(e)) continue;
        for (const p of e.participants) {
          if (p.role !== rule.learner || !p.id.startsWith('CIT')) continue;
          const row = idNumber(p.id);
          if (!active.has(row)) continue;
          if (!nets.has(row)) nets.set(row, relationalNetworkOf(view, row));
          teach(nets.get(row)!, { a: rule.a, b: rule.b, t: rule.t, s: rule.s, source: e.id, now: ctx.now });
        }
      }
    }
    const patches: Patch[] = [...nets]
      .sort((a, b) => a[0] - b[0])
      .map(([row, network]) => ({ op: 'entity', id: formatId('CIT', row) as EntityId, fields: { network } }));
    return { patches };
  },
};
