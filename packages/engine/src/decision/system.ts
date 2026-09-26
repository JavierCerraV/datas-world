// Sistema `decision` (spec 040): en los bloques flexibles de la rutina, la persona elige qué hacer con una softmax
// sobre el valor de sus candidatas (suma de aportes por fuente de control) y se compromete hasta que termine lo
// elegido. La acción elegida se solicita al bucle, que la valida y la aplica (R-008, 021); si la primera no es
// posible, se elige otra, y ese fracaso de la respuesta dominante sube la variabilidad aprendida (R-009).
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import { variabilityOf } from '../functions/history.ts';
import { learningParams } from '../functions/system.ts';
import type { Ontology } from '../functions/types.ts';
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
import { pickIndex, softmax, temperatureOf } from './select.ts';
import { createActionValidator } from './validate.ts';

const DAY = 1440;
/** Bloque mínimo de flexibilidad para decidir. */
const MIN_FLEXIBILITY = 0.5;
/** 040 R-009: subida de la variabilidad cuando se rechaza la opción elegida [M]. */
const VARIABILITY_ON_FAILURE = 0.05;

/**
 * Elige una opción; si el validador la rechaza, la quita y vuelve a elegir entre las demás (R-008). Devuelve
 * también cuántas se rechazaron.
 */
export function choose(
  view: WorldView,
  options: Option[],
  temperature: number,
  rng: Rng,
  validate: ReturnType<typeof createActionValidator>,
): { pick: Option | undefined; rejected: number } {
  let left = [...options];
  let rejected = 0;
  while (left.length > 0) {
    const k = pickIndex(softmax(left.map((o) => o.value), temperature), rng.next());
    const pick = left[k]!;
    if (validate(view, pick.action).ok) return { pick, rejected };
    rejected++;
    left = left.filter((_, j) => j !== k);
  }
  return { pick: undefined, rejected };
}

export function createDecisionSystem(table: LeisureTable, onto?: Ontology): System {
  const validate = createActionValidator(table);
  /** `coarse` (nivel 1, 021 R-011): mantiene lo elegido cada tick, pero solo decide algo nuevo en punto cada hora. */
  const step = (view: WorldView, ctx: TickCtx, rng: Rng, coarse = false): SystemOutput => {
    const now = ctx.now;
    const P = mobilityParams(view.config.profile!, view.config.epoch.slice(0, 10));
    const learning = learningParams(view.config.profile, view.config.epoch.slice(0, 10));
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
      if (coarse && now % 60 !== 0 && !hungry) continue;
      const plan = planAt(view, row, day(now), ((now % DAY) + DAY) % DAY);
      if (plan.flexibility < MIN_FLEXIBILITY) {
        drop();
        continue;
      }
      // El tiempo libre termina `lookahead` minutos antes de la próxima obligación: así la movilidad (016 R-004) ve el
      // turno o el colegio a tiempo de salir. Sin ese margen, lo elegido duraba hasta la hora de entrada y se llegaba tarde.
      const cap = freeUntil(view, row, now, day) - P.habits.lookahead!;
      if (cap <= now + view.config.tickMinutes) continue;
      occ ??= occupancy(view, ctx.citizens);
      const id = formatId('CIT', row);
      const r = rng.fork(id);
      const options = buildOptions(
        { view, row, now, here: i['loc.place']?.[row] ?? 0, home: homeOf(view, row), cap, day, occ, P, table, ...(onto ? { onto, learning } : {}) },
        r,
      );
      const variability = variabilityOf(view, row);
      const { pick, rejected } = choose(view, options, temperatureOf(variability), r, validate);
      if (pick) actions.push(pick.action);
      if (rejected > 0 && f['hist.variability'])
        patches.push({ op: 'set', type: 'f32', column: 'hist.variability', row, value: 1 - (1 - variability) * (1 - VARIABILITY_ON_FAILURE) ** rejected });
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
    run: (view, ctx, rng) => step(view, ctx, rng),
    // Nivel 1 (021 R-011, CA-001): decisiones por horas, con la misma utilidad; da un gasto y un ánimo parecidos.
    runCoarse: (view, ctx, rng) => step(view, ctx, rng, true),
  };
}
