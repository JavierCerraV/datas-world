// Charla casual (spec 043 R-019.1): si la persona puede charlar ahora y hasta cuándo. Dormida, no; en una
// obligación (bloque poco flexible), solo un momento; libre, hasta su próximo compromiso firme.
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import { freeUntil } from '../decision/options.ts';
import type { NewEvent } from '../events.ts';
import { formatId } from '../ids.ts';
import { dayInfo } from '../routines/day.ts';
import { planAt } from '../routines/plan.ts';
import type { WorldView } from '../simulation/system.ts';
import type { ChatParams } from './params.ts';

const DAY = 1440;
const minuteOf = (at: number) => ((at % DAY) + DAY) % DAY;

/** 040 R-001: por debajo de esta flexibilidad, el bloque es una obligación. */
export const FLEXIBLE_FROM = 0.5;

export type Availability =
  | { ok: true; until: number; busy: boolean }
  | { ok: false; reason: 'dormido' | 'inactivo' };

export function chatAvailability(view: WorldView, row: number, now: number, params: ChatParams): Availability {
  const person = view.citizens.get(formatId('CIT', row));
  if (!person || person.status !== 'active') return { ok: false, reason: 'inactivo' };
  if (view.components.u8[ACTIVITY_COLUMN]?.[row] === ACTIVITY.sleep) return { ok: false, reason: 'dormido' };
  const day = (at: number) => dayInfo(view, at);
  const plan = planAt(view, row, day(now), minuteOf(now));
  if (plan.flexibility < FLEXIBLE_FROM) return { ok: true, until: now + params.busyWindowMin, busy: true };
  return { ok: true, until: freeUntil(view, row, now, day), busy: false };
}

/** Evento de la apertura (R-019.1, R-019.2): `CONVERSATION_STARTED` o `CONVERSATION_DECLINED`, con sus causas. */
export function openingEvent(
  view: WorldView, row: number, visitorId: string, sessionId: string, a: Availability, cause: NewEvent['causes'],
): NewEvent {
  const citizenId = formatId('CIT', row);
  const participants = [{ id: citizenId, role: 'persona' }];
  if (!a.ok) {
    const state = a.reason === 'dormido' ? { state: 'act.kind', entity: citizenId, value: ACTIVITY.sleep, weight: 1 } : undefined;
    return {
      type: 'CONVERSATION_DECLINED',
      payload: { citizenId, visitorId, reason: a.reason },
      causes: [...cause, ...(state ? [state] : [])],
      participants,
    };
  }
  const here = view.components.i32['loc.place']?.[row] ?? 0;
  return {
    type: 'CONVERSATION_STARTED',
    payload: { citizenId, visitorId, sessionId, availableUntil: a.until, busy: a.busy },
    causes: [...cause, { state: a.busy ? 'rutina.obligacion' : 'rutina.tiempo_libre', entity: citizenId, weight: 0.5 }],
    participants,
    ...(here > 0 ? { placeId: formatId('PLC', here) } : {}),
  };
}
