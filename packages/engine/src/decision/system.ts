// Sistema `decision` (spec 017): en los bloques flexibles de la rutina, la persona elige qué hacer con una
// softmax sobre la utilidad de sus opciones y se compromete hasta que termine lo elegido. La acción elegida se
// solicita al bucle, que la valida y la aplica (R-006, 021); si la primera no es posible, se elige otra.
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import { formatId } from '../ids.ts';
import { homeOf } from '../mobility/columns.ts';
import { occupancy } from '../mobility/enter.ts';
import { mobilityParams } from '../mobility/params.ts';
import type { Rng } from '../rng.ts';
import type { DayInfo } from '../routines/day.ts';
import { dayInfo } from '../routines/day.ts';
import { planAt } from '../routines/plan.ts';
import type { ActionRequest, Patch, System, SystemOutput, TickCtx, WorldView } from '../simulation/system.ts';
import type { LeisureTable } from './columns.ts';
import { buildOptions, freeUntil } from './options.ts';
import type { Option } from './options.ts';
import { createActionValidator } from './validate.ts';

const DAY = 1440;
/** Temperatura base de la softmax (017 §8, prototipo) y bloque mínimo de flexibilidad para decidir. */
const BASE_TEMPERATURE = 0.3;
const MIN_FLEXIBILITY = 0.5;

/** Probabilidades de la softmax (INV-001: finitas, en [0,1] y suman 1). */
export function softmax(utilities: readonly number[], temperature: number): number[] {
  const max = Math.max(...utilities);
  const w = utilities.map((u) => Math.exp((u - max) / temperature));
  const total = w.reduce((s, x) => s + x, 0);
  return w.map((x) => x / total);
}

/** Temperatura de la persona: más alta con más impulsividad (R-003). */
export const temperatureOf = (impulsivity: number): number => BASE_TEMPERATURE * (0.6 + 0.8 * impulsivity);

/** Elige una opción; si el validador la rechaza, la quita y vuelve a elegir entre las demás (R-006). */
export function choose(view: WorldView, options: Option[], temperature: number, rng: Rng, validate: ReturnType<typeof createActionValidator>): Option | undefined {
  let left = [...options];
  while (left.length > 0) {
    const p = softmax(left.map((o) => o.utility), temperature);
    let x = rng.next();
    let k = 0;
    while (k < p.length - 1 && x >= p[k]!) x -= p[k++]!;
    const pick = left[k]!;
    if (validate(view, pick.action).ok) return pick;
    left = left.filter((_, j) => j !== k);
  }
  return undefined;
}

export function createDecisionSystem(table: LeisureTable): System {
  const validate = createActionValidator(table);
  const step = (view: WorldView, ctx: TickCtx, rng: Rng): SystemOutput => {
    const now = ctx.now;
    const P = mobilityParams(view.config.profile!, view.config.epoch.slice(0, 10));
    const i = view.components.i32;
    const u = view.components.u8;
    const f = view.components.f32;
    const days = new Map<number, DayInfo>();
    const day = (at: number) => {
      const d = Math.floor(at / DAY);
      if (!days.has(d)) days.set(d, dayInfo(view, at));
      return days.get(d)!;
    };
    let occ: Map<number, number> | undefined;
    const patches: Patch[] = [];
    const actions: ActionRequest[] = [];

    for (const row of ctx.citizens) {
      const until = i['act.until']![row]!;
      const committed = now < until;
      const drop = () => {
        if (committed) patches.push({ op: 'set', type: 'i32', column: 'act.until', row, value: now });
      };
      // Dormida, enferma o en camino: no decide; la enfermedad cancela lo que tenía previsto.
      if ((u['health.acute']?.[row] ?? 0) > 0) {
        drop();
        continue;
      }
      if (now < (i['routine.wakeAt']?.[row] ?? 0) || (i['trip.to']?.[row] ?? 0) > 0) continue;
      const hungry = f['need.hunger']![row]! < 0.1;
      // Con hambre crítica se replantea lo elegido, salvo si ya está comiendo (CA-001).
      if (committed && !(hungry && u['act.choice']![row] !== ACTIVITY.eat + 1)) {
        // Sigue con lo elegido: la rutina escribió su actividad en esta fase; se mantiene la elegida.
        const choice = u['act.choice']![row]!;
        if (choice > 0) patches.push({ op: 'set', type: 'u8', column: ACTIVITY_COLUMN, row, value: choice - 1 });
        continue;
      }
      const plan = planAt(view, row, day(now), ((now % DAY) + DAY) % DAY);
      if (plan.flexibility < MIN_FLEXIBILITY) {
        drop();
        continue;
      }
      const cap = freeUntil(view, row, now, day);
      if (cap <= now + view.config.tickMinutes) continue;
      occ ??= occupancy(view, ctx.citizens);
      const id = formatId('CIT', row);
      const r = rng.fork(id);
      const options = buildOptions(
        { view, row, now, here: i['loc.place']?.[row] ?? 0, home: homeOf(view, row), cap, day, occ, P, table },
        r,
      );
      const pick = choose(view, options, temperatureOf(f['pers.impulsivity']?.[row] ?? 0.5), r, validate);
      if (pick) actions.push(pick.action);
    }
    return { patches, actions };
  };
  return {
    id: 'decision',
    // Después de la rutina (orden 0), en la misma fase: la acción elegida sustituye la actividad por defecto.
    phase: 'decision',
    order: 1,
    capability: 'routines',
    cadence: 'tick',
    minLevel: 2,
    run: step,
  };
}
