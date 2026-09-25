// Validación y aplicación de acciones (spec 017 R-006; CLAUDE.md regla 4): el agente solicita, el motor
// comprueba las precondiciones y, si se cumplen, devuelve los parches y los eventos, con el `explain` como causa.
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import type { ActivityKind } from '../activity.ts';
import { idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import { enterRefusal, occupancy } from '../mobility/enter.ts';
import type { ActionOutcome, ActionRequest, ActionValidator, Patch, WorldView } from '../simulation/system.ts';
import type { LeisureTable } from './columns.ts';
import type { ActionParams } from './options.ts';

/** Tipos de acción de M2 (017 §3). */
export const ACTION_KINDS = Object.freeze(['follow_routine', 'eat', 'rest', 'leisure'] as const);

const reject = (why: string): ActionOutcome => ({ ok: false, rejected: why });

/** Filas activas, para la ocupación de los lugares al validar una entrada. */
function activeRows(view: WorldView): number[] {
  const active = view.components.u8.active!;
  const rows: number[] = [];
  for (let row = 1; row < active.length; row++) if (active[row] === 1) rows.push(row);
  return rows;
}

/** Validador de las acciones de M2; se inyecta en el bucle (`loop.validate`, 021) con la tabla de esparcimiento. */
export function createActionValidator(table: LeisureTable): ActionValidator {
  return (view: WorldView, action: ActionRequest): ActionOutcome => {
    if (!(ACTION_KINDS as readonly string[]).includes(action.kind)) return reject(`acción desconocida: ${action.kind}`);
    const person = view.citizens.get(action.actor);
    if (!person || person.status !== 'active') return reject('la persona no existe o no está activa');
    const row = idNumber(action.actor);
    const i = view.components.i32;
    const p = action.params as ActionParams;
    if (!p || !(p.activity in ACTIVITY) || !Number.isSafeInteger(p.until) || p.until <= view.now) return reject('parámetros inválidos');
    if ((i['trip.to']?.[row] ?? 0) > 0) return reject('en tránsito');
    if ((view.components.u8['health.acute']?.[row] ?? 0) > 0) return reject('enferma');
    const place = action.target ? idNumber(action.target as EntityId) : 0;
    const money = i.money?.[row];
    const events: ActionOutcome['events'] = [];
    const patches: Patch[] = [];

    if (action.kind === 'leisure') {
      const key = p.leisure ?? '';
      const a = table[key];
      if (!a || !person.leisure?.some((x) => x.key === key)) return reject('no es una afición de su ficha');
      if (money !== undefined && money < p.cost + (p.travelCost ?? 0)) return reject('sin dinero');
      const here = i['loc.place']?.[row] ?? 0;
      if (place && place !== here && enterRefusal(view, row, place, view.now, occupancy(view, activeRows(view))) === 'lleno') return reject('lleno');
      // El gasto va a la organización del lugar (sus ventas, 015 R-007) o, si no hay, al resto del país (R-006).
      // Sin cuentas del sistema (mundos sin economía), solo se descuenta del saldo, como antes.
      if (p.cost > 0 && money !== undefined) {
        const org = action.target ? [...view.organizations.values()].find((o) => o.placeIds.includes(action.target as EntityId)) : undefined;
        patches.push(
          view.accounts
            ? { op: 'transfer', from: { kind: 'citizen', row }, to: org ? { kind: 'org', id: org.id } : { kind: 'rest' }, amount: p.cost }
            : { op: 'add', type: 'i32', column: 'money', row, delta: -p.cost },
        );
      }
      // Última vez que la hizo: regula la frecuencia (032 R-006).
      // Copia simple (la vista congelada devuelve Proxies, que no se pueden clonar al aplicar el parche).
      const leisure: Record<string, unknown>[] = [];
      for (const x of person.leisure!) leisure.push(x.key === key ? { ...x, lastDone: view.now } : { ...x });
      patches.push({ op: 'entity', id: action.actor as EntityId, fields: { leisure } });
      events.push({
        type: 'LEISURE_DONE',
        payload: { citizenId: action.actor, activity: key, name: a.name, placeId: action.target ?? '', with: [] },
        participants: [{ id: action.actor as EntityId, role: 'persona' }],
        ...(action.target ? { placeId: action.target as EntityId } : {}),
        causes: action.reason, // R-005: el `explain` de la decisión
      });
    }
    const act = ACTIVITY[p.activity as ActivityKind];
    patches.push(
      { op: 'set', type: 'u8', column: 'act.choice', row, value: act + 1 },
      { op: 'set', type: 'i32', column: 'act.place', row, value: place },
      { op: 'set', type: 'i32', column: 'act.until', row, value: p.until },
      { op: 'set', type: 'u8', column: ACTIVITY_COLUMN, row, value: act },
    );
    return { ok: true, patches, events };
  };
}
