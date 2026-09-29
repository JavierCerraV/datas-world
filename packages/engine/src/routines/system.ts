// Sistema `routines` (spec 011; 010 R-004): escribe la actividad por defecto de cada persona en cada tick.
// Mientras no exista el motor de decisiones (017, bloque E), la persona sigue su rutina.
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import { formatId } from '../ids.ts';
import { sleepCauses } from '../causality/origins.ts';
import { needsParams } from '../needs/params.ts';
import type { Patch, System, SystemEvent, SystemOutput, TickCtx, WorldView } from '../simulation/system.ts';
import type { Rng } from '../rng.ts';
import { discountKOf, discounted } from '../functions/history.ts';
import { dayInfo } from './day.ts';
import { isEarlyDay, planAt } from './plan.ts';

const DAY = 1440;
/** Energía al despertar por debajo de la cual se tiende a quedarse dormido (prototipo `sleepUntil`). */
const OVERSLEEP_ENERGY = 0.72;
/** Minutos de retraso desde los que se registra `OVERSLEPT`. */
const OVERSLEPT_MIN = 10;
/** 040 R-010: demora de la consecuencia de llegar tarde (la advertencia llega días después) [M]. */
const LATE_DELAY_DAYS = 5;

/**
 * 040 R-010: multiplicador del exceso de sueño por falta de energía. Quien descuenta mucho la consecuencia demorada
 * de llegar tarde se queda dormido más: 0,39 con k = 0,02, 0,8 con k = 0,2 y 1,21 con k = 2 (antes, 1,3 − responsabilidad).
 */
export const oversleepFactor = (k: number): number => 1.3 - discounted(1, LATE_DELAY_DAYS, k);

function step(view: WorldView, ctx: TickCtx, rng: Rng): SystemOutput {
  const f = view.components.f32;
  const i = view.components.i32;
  const u = view.components.u8;
  const R = needsParams(view.config.profile!, view.config.epoch.slice(0, 10)).rates;
  const tick = view.config.tickMinutes;
  const minute = ((ctx.now % DAY) + DAY) % DAY;
  const today = dayInfo(view, ctx.now);
  const rows: number[] = [];
  const acts: number[] = [];
  const wakeRows: number[] = [];
  const wakeAt: number[] = [];
  const planned: number[] = [];
  const events: SystemEvent[] = [];

  for (const row of ctx.citizens) {
    const id = formatId('CIT', row);
    let act: number;
    if (u['health.acute']![row]! > 0) act = ACTIVITY.sick;
    else if (ctx.now < i['routine.wakeAt']![row]!) act = ACTIVITY.sleep;
    else {
      const plan = planAt(view, row, today, minute);
      act = ACTIVITY[plan.activity];
      const bed = i['routine.bed']![row]!;
      // Al acostarse se programa el despertar (prototipo `sleepUntil`), con la deuda de sueño de la 010 R-004.
      if (plan.activity === 'sleep' && minute >= bed && minute < bed + tick) {
        const wakeDay = ctx.now - minute + (bed >= 12 * 60 ? DAY : 0);
        const tomorrow = dayInfo(view, wakeDay);
        const wake = wakeDay + (isEarlyDay(view, row, tomorrow) ? i['routine.wakeW']![row]! : i['routine.wakeE']![row]!);
        const stress = f['state.stress']![row]!;
        const proj = Math.min(1, f['need.energy']![row]! + ((wake - ctx.now) / 60) * R.energyRest! * (1 - R.restStress! * stress));
        let over = proj < OVERSLEEP_ENERGY ? Math.round((OVERSLEEP_ENERGY - proj) * 200 * oversleepFactor(discountKOf(view, row))) : 0;
        over += Math.round(i['state.sleepDebt']![row]! * 0.1);
        over = Math.max(0, over + rng.fork(id).int(-5, 8));
        wakeRows.push(row);
        wakeAt.push(wake + over);
        planned.push(wake);
      } else if (plan.flexibility >= 0.2 && f['need.hunger']![row]! < 0.1) act = ACTIVITY.eat; // 011 CA-002
    }
    // Se registra el retraso al llegar la hora prevista (010 R-004).
    const plannedWake = i['routine.plannedWake']![row]!;
    const late = i['routine.wakeAt']![row]! - plannedWake;
    if (plannedWake > ctx.now - tick && plannedWake <= ctx.now && late >= OVERSLEPT_MIN) {
      events.push({
        type: 'OVERSLEPT',
        payload: { citizenId: id, minutes: late },
        participants: [{ id, role: 'persona' }],
        recordAs: { column: 'routine.oversleptEvt', row }, // la llegada tarde lo citará como causa (016 R-004)
        causes: [
          // 019 R-005: la deuda de sueño con lo que le quitó el sueño (o su horario).
          ...sleepCauses(view, row, ctx.now, i['state.sleepDebt']![row]!, 0.5),
          { state: 'energia', entity: id, value: Math.round(f['need.energy']![row]! * 100) / 100, weight: 0.3 },
          { state: 'descuento', entity: id, value: Math.round(discountKOf(view, row) * 100) / 100, weight: 0.2 },
        ],
      });
    }
    rows.push(row);
    acts.push(act);
  }
  const patches: Patch[] = [{ op: 'setMany', type: 'u8', column: ACTIVITY_COLUMN, rows, values: acts }];
  if (wakeRows.length > 0)
    patches.push(
      { op: 'setMany', type: 'i32', column: 'routine.wakeAt', rows: wakeRows, values: wakeAt },
      { op: 'setMany', type: 'i32', column: 'routine.plannedWake', rows: wakeRows, values: planned },
    );
  return { patches, events };
}

export const routinesSystem: System = {
  id: 'routines',
  // En la fase de decisión, antes del motor de decisiones (017), que podrá sustituir la actividad propuesta.
  phase: 'decision',
  order: 0,
  capability: 'routines',
  cadence: 'tick',
  minLevel: 1,
  run: step,
  runCoarse: step,
};
