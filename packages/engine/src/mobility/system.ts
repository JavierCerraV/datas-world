// Sistema `mobility` (spec 016; 004 R-003 a R-005): lleva a cada persona al lugar de su actividad. Sale con
// tiempo hacia la siguiente obligación, viaja (en tránsito no está en ningún lugar) y al llegar entra si el lugar
// está abierto y cabe; si llega tarde a su turno o al colegio, `ARRIVED_LATE` con sus causas.
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import type { ActivityKind } from '../activity.ts';
import type { CauseRef } from '../events.ts';
import { formatId } from '../ids.ts';
import type { Rng } from '../rng.ts';
import type { DayInfo } from '../routines/day.ts';
import { dayInfo, routineParams } from '../routines/day.ts';
import { planAt } from '../routines/plan.ts';
import { shiftOf } from '../routines/columns.ts';
import type { ColumnType } from '../components.ts';
import type { Patch, System, SystemEvent, SystemOutput, TickCtx, WorldView } from '../simulation/system.ts';
import { homeOf, modeCode } from './columns.ts';
import { enterRefusal, occupancy } from './enter.ts';
import { mobilityParams } from './params.ts';
import type { MobilityParams } from './params.ts';
import { planTrip } from './trip.ts';
import { placeFor, schoolOf, workplaceOf } from './where.ts';

const DAY = 1440;
const NAME = Object.fromEntries(Object.entries(ACTIVITY).map(([k, v]) => [v, k])) as Record<number, ActivityKind>;

/** Acumula parches `setMany` por columna, en orden de emisión. */
class Sets {
  #cols = new Map<string, { type: ColumnType; rows: number[]; values: number[] }>();
  set(type: ColumnType, column: string, row: number, value: number): void {
    const c = this.#cols.get(column) ?? { type, rows: [], values: [] };
    this.#cols.set(column, c);
    c.rows.push(row);
    c.values.push(value);
  }
  patches(): Patch[] {
    return [...this.#cols].map(([column, c]) => ({ op: 'setMany', type: c.type, column, rows: c.rows, values: c.values }));
  }
}

/** Minuto del día en que empieza la obligación a la que llega, si llega a una (turno o colegio). */
function obligationStart(view: WorldView, row: number, dest: number, day: DayInfo, minute: number): number | undefined {
  const plan = planAt(view, row, day, minute);
  if (plan.flexibility > 0.1) return undefined;
  if (plan.activity === 'work' && dest === workplaceOf(view, row)) return shiftOf(view, row)?.start;
  if (plan.activity === 'study' && dest === schoolOf(view, row)) return routineParams(view).school.start;
  return undefined;
}

function step(view: WorldView, ctx: TickCtx, rng: Rng): SystemOutput {
  const P: MobilityParams = mobilityParams(view.config.profile!, view.config.epoch.slice(0, 10));
  const tick = view.config.tickMinutes;
  const now = ctx.now;
  const i = view.components.i32;
  const u = view.components.u8;
  const loc = i['loc.place']!;
  const tripTo = i['trip.to']!;
  const occ = occupancy(view, ctx.citizens);
  const days = new Map<number, DayInfo>();
  const dayOf = (at: number) => {
    const d = Math.floor(at / DAY);
    if (!days.has(d)) days.set(d, dayInfo(view, at));
    return days.get(d)!;
  };
  const minuteOf = (at: number) => ((at % DAY) + DAY) % DAY;
  const lookahead = Math.round(P.habits.lookahead! / tick);
  // Estimación sin ruido del viaje de la persona (su modo y su paso), con el peor caso del ruido (R-001).
  const estimate = (row: number, a: number, b: number) => {
    const trip = planTrip(view, row, a, b, now, null, P);
    return trip === undefined ? undefined : trip.minutes * (1 + P.speeds.noise!);
  };
  const out = new Sets();
  const patches: Patch[] = [];
  const events: SystemEvent[] = [];

  const depart = (row: number, from: number, dest: number, r: Rng): boolean => {
    const trip = planTrip(view, row, from, dest, now, r, P);
    if (!trip) return false;
    out.set('i32', 'loc.place', row, 0);
    out.set('i32', 'trip.from', row, from);
    out.set('i32', 'trip.to', row, dest);
    out.set('i32', 'trip.departAt', row, now);
    out.set('i32', 'trip.arriveAt', row, now + trip.minutes);
    out.set('u8', 'trip.mode', row, modeCode(trip.mode));
    out.set('u8', ACTIVITY_COLUMN, row, ACTIVITY.commute);
    // Pasaje y combustible salen del mundo (015 R-006): transferencia al resto del país. Los mundos sin economía
    // (sin cuentas del sistema) solo descuentan del saldo, como antes.
    if (trip.cost > 0 && i.money)
      patches.push(
        view.accounts
          ? { op: 'transfer', from: { kind: 'citizen', row }, to: { kind: 'rest' }, amount: trip.cost }
          : { op: 'add', type: 'i32', column: 'money', row, delta: -trip.cost },
      );
    occ.set(from, (occ.get(from) ?? 1) - 1);
    if (trip.intercity) {
      const id = formatId('CIT', row);
      events.push({
        type: 'TRIP_TAKEN',
        payload: { citizenId: id, to: formatId('PLC', dest), mode: trip.mode, minutes: trip.minutes, cost: trip.cost },
        participants: [{ id, role: 'viajero' }],
        causes: [{ state: 'actividad', entity: id, value: u[ACTIVITY_COLUMN]![row]!, weight: 1 }],
        ...(trip.via ? { placeId: formatId('PLC', trip.via) } : {}),
      });
    }
    return true;
  };

  for (const row of ctx.citizens) {
    const id = formatId('CIT', row);
    const r = rng.fork(id);
    const home = homeOf(view, row);
    const dest = tripTo[row]!;
    if (dest > 0) {
      if (now < i['trip.arriveAt']![row]!) {
        out.set('u8', ACTIVITY_COLUMN, row, ACTIVITY.commute);
        continue;
      }
      // Llegada (R-001): entra si está abierto y cabe (004 R-004, R-005); si no, vuelve a casa y deja lo que había
      // elegido (el motor de decisiones elegirá otra cosa, 017 R-006).
      if (dest !== home && enterRefusal(view, row, dest, now, occ) !== null && home && depart(row, dest, home, r)) {
        if (i['act.until']) out.set('i32', 'act.until', row, now);
        continue;
      }
      out.set('i32', 'loc.place', row, dest);
      out.set('i32', 'trip.to', row, 0);
      out.set('i32', 'trip.from', row, 0);
      out.set('u8', 'trip.mode', row, 0);
      occ.set(dest, (occ.get(dest) ?? 0) + 1);
      const arrived = i['trip.arriveAt']![row]!;
      const start = obligationStart(view, row, dest, dayOf(now), minuteOf(now));
      const late = start === undefined ? 0 : minuteOf(arrived) - start;
      if (late > 0 && late < DAY / 2) {
        // R-004: la causa es la salida tarde (`OVERSLEPT` de hoy) y, en todo caso, la duración del viaje.
        const evt = i['routine.oversleptEvt']?.[row] ?? 0;
        const planned = i['routine.plannedWake']?.[row] ?? 0;
        const overslept = evt > 0 && planned > now - DAY / 2 && (i['routine.wakeAt']?.[row] ?? 0) - planned >= 10;
        const travel = arrived - i['trip.departAt']![row]!;
        const causes: CauseRef[] = overslept
          ? [{ event: formatId('EVT', evt), weight: 0.7 }, { state: 'duracion_viaje', entity: id, value: travel, weight: 0.3 }]
          : [{ state: 'duracion_viaje', entity: id, value: travel, weight: 1 }];
        // A su trabajo, el retraso lo anota la organización (006 R-005): el evento queda en `work.lastLateEvt`.
        const atWork = dest === workplaceOf(view, row) && i['work.lastLateEvt'] !== undefined;
        if (atWork) out.set('i32', 'work.lastLateMin', row, late);
        events.push({
          type: 'ARRIVED_LATE',
          payload: { citizenId: id, placeId: formatId('PLC', dest), minutes: late },
          participants: [{ id, role: 'persona' }],
          placeId: formatId('PLC', dest),
          causes,
          ...(atWork ? { recordAs: { column: 'work.lastLateEvt', row } } : {}),
        });
      }
      continue;
    }

    const here = loc[row]!;
    const act = u[ACTIVITY_COLUMN]![row]!;
    if ((act === ACTIVITY.sleep || act === ACTIVITY.sick) && here === home) continue; // dormido o enfermo en casa
    // La actividad de ahora, en el lugar elegido si hay una decisión en curso (017); si se hace aquí, la próxima
    // que se haga en otro lugar después de lo elegido, a tiempo de llegar (R-004).
    const until = i['act.until']?.[row] ?? 0;
    const chosen = now < until ? (i['act.place']?.[row] ?? 0) : 0;
    let target = chosen || placeFor(view, row, NAME[act] ?? 'idle');
    if (target === 0 || target === here) {
      target = 0;
      for (let k = 1; k <= lookahead; k++) {
        const at = now + k * tick;
        if (at < until) continue;
        const next = placeFor(view, row, planAt(view, row, dayOf(at), minuteOf(at)).activity);
        if (next === 0 || next === here) continue;
        const est = estimate(row, here, next);
        if (est !== undefined && est + P.habits.margin! >= k * tick) target = next;
        break;
      }
    }
    if (target === 0 || target === here) continue;
    const eta = now + Math.ceil(estimate(row, here, target) ?? 0);
    if (target !== home && enterRefusal(view, row, target, eta, occ) !== null) {
      if (target === chosen) out.set('i32', 'act.until', row, now); // cerrado o lleno: no va y deja lo elegido
      continue;
    }
    depart(row, here, target, r);
  }
  return { patches: [...out.patches(), ...patches], events };
}

export const mobilitySystem: System = {
  id: 'mobility',
  // Después de la rutina y de las decisiones (fase `decision`): mueve a la persona a donde su actividad la lleva.
  phase: 'actions',
  order: 0,
  capability: 'mobility',
  cadence: 'tick',
  minLevel: 1,
  run: step,
  runCoarse: step,
};
