// Registro de causas de cada vínculo (R-009) y trabajo diario de las relaciones (R-003, R-006, R-008): la
// familiaridad decae sin contacto, los conocidos se olvidan, se respeta el tope y las parejas deterioradas se rompen.
import { tensionNow } from '../conversation/encounter.ts';
import type { ClaimParams } from '../conversation/params.ts';
import { storeOf } from '../functions/system.ts';
import { formatId, idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import type { Patch, System, SystemEvent, SystemOutput, TickCtx, WorldView } from '../simulation/system.ts';
import type { Bond } from '../world.ts';
import { affectionFor, bondCauses, decayDay, forgettable, setLabel } from './bonds.ts';
import type { RelationshipParams } from './params.ts';

const DAY = 1440;
const round = (x: number) => Math.round(x * 1000) / 1000;
/** Eventos que forman la historia de un par (012 y 044), con `a` y `b` en el payload. */
const LEDGER = new Set(['MET', 'ENCOUNTER', 'ARGUMENT', 'FRIENDSHIP_FORMED', 'RELATIONSHIP_STARTED', 'CONFRONTATION', 'BOND_STRAINED']);
/** Eventos que se guardan por vínculo: los últimos. */
const KEEP_EVENTS = 5;

const copyBonds = (view: WorldView, id: EntityId): Bond[] => JSON.parse(JSON.stringify(view.citizens.get(id)?.bonds ?? [])) as Bond[];

/** Fase `memory`: cada evento del par queda en los vínculos de ambos lados (lo leen las causas siguientes). */
export function createBondLedgerSystem(): System {
  return {
    id: 'bond_ledger', phase: 'memory', order: 95, capability: 'relationships', cadence: 'tick', minLevel: 0,
    run: (view: WorldView, ctx: TickCtx): SystemOutput => {
      const found = ctx.events.filter((e) => LEDGER.has(e.type));
      if (found.length === 0) return {};
      const bonds = new Map<EntityId, Bond[]>();
      for (const e of found) {
        const { a, b } = e.payload as { a: EntityId; b: EntityId };
        for (const [x, y] of [[a, b], [b, a]] as const) {
          const list = bonds.get(x) ?? bonds.set(x, copyBonds(view, x)).get(x)!;
          const bond = list.find((z) => z.with === y);
          if (!bond || bond.events?.includes(e.id)) continue;
          bond.events = [...(bond.events ?? []), e.id].slice(-KEEP_EVENTS);
        }
      }
      const patches: Patch[] = [...bonds.keys()].sort().map((id) => ({ op: 'entity', id, owned: true, fields: { bonds: bonds.get(id) } }));
      return { patches };
    },
  };
}

/** Fase `end_of_day`: decaimiento, rupturas, olvido y tope. */
export function createBondDailySystem(p: RelationshipParams, claim: ClaimParams): System {
  return {
    id: 'bond_daily', phase: 'end_of_day', order: 50, capability: 'relationships', cadence: 'day', minLevel: 0,
    run: (view: WorldView, ctx: TickCtx): SystemOutput => {
      const now = ctx.now;
      const bonds = new Map<EntityId, Bond[]>();
      const listOf = (id: EntityId) => bonds.get(id) ?? bonds.set(id, copyBonds(view, id)).get(id)!;
      const events: SystemEvent[] = [];
      for (const row of ctx.citizens) {
        const id = formatId('CIT', row) as EntityId;
        if (!view.citizens.get(id)?.bonds?.length) continue;
        const list = listOf(id);
        let store: ReturnType<typeof storeOf> | undefined;
        for (const b of list) {
          decayDay(b, now, p);
          if (!(b.labels ?? []).includes('pareja')) continue;
          // R-006: afecto bajo y tensión alta, sostenidos `breakupDays`, rompen la pareja desde este lado.
          store ??= storeOf(view, row);
          const fn = affectionFor(store, b.with);
          if (!(fn < p.breakupFn && tensionNow(b, now, claim) > p.breakupTension)) {
            delete b.strainedSince;
            continue;
          }
          b.strainedSince ??= now;
          if (now - b.strainedSince < p.breakupDays * DAY) continue;
          const other = listOf(b.with).find((z) => z.with === id);
          for (const z of [b, other]) {
            if (!z) continue;
            setLabel(z, 'pareja', false);
            setLabel(z, 'ex', true);
            delete z.strainedSince;
          }
          events.push({
            type: 'BREAKUP', payload: { a: id, b: b.with, initiator: id },
            causes: [{ state: 'funcion', entity: b.with, value: round(fn), weight: 1 }, ...bondCauses(b, 0.8)],
            participants: [{ id, role: 'rompe' }, { id: b.with, role: 'persona' }],
          });
        }
        // R-008: olvido de los conocidos sin contacto y, por encima del tope, del más débil que no sea familia.
        const forgotten = new Set(list.filter((b) => forgettable(b, tensionNow(b, now, claim), p)).map((b) => b.with));
        const rest = list.filter((b) => !forgotten.has(b.with));
        const spare = rest.filter((b) => !(b.labels ?? []).includes('familia')).sort((x, y) => (x.familiarity ?? 0) - (y.familiarity ?? 0) || (x.with < y.with ? -1 : 1));
        for (const b of spare.slice(0, Math.max(0, rest.length - p.maxBonds))) forgotten.add(b.with);
        if (forgotten.size === 0) continue;
        bonds.set(id, list.filter((b) => !forgotten.has(b.with)));
        for (const other of [...forgotten].sort()) {
          const last = list.find((b) => b.with === other)!.lastEncounter ?? list.find((b) => b.with === other)!.at;
          events.push({
            type: 'BOND_FORGOTTEN', payload: { a: id, b: other },
            causes: [{ state: 'sin_contacto', entity: other, value: Math.round((now - last) / DAY), weight: 1 }],
            participants: [{ id, role: 'persona' }, { id: other, role: 'persona' }],
          });
        }
      }
      const patches: Patch[] = [...bonds.keys()].sort((x, y) => idNumber(x) - idNumber(y)).map((id) => ({ op: 'entity', id, owned: true, fields: { bonds: bonds.get(id) } }));
      return { patches, events };
    },
  };
}
