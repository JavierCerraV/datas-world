// Origen de los estados (spec 019 R-005): el último hecho detrás de cada estado de una persona, para que quien cite el
// estado como causa cite también el hecho. Un sistema lo apunta al final de cada tick con lo que emitieron las fases.
import type { CauseRef, WorldEvent } from '../events.ts';
import { formatId, idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import type { DeepReadonly, Patch, System, SystemOutput, TickCtx, WorldView } from '../simulation/system.ts';

export type OriginKey = 'desempleo' | 'dinero' | 'enfermedad' | 'malestar' | 'sueno' | 'conflicto';
export type StateOrigins = Partial<Record<OriginKey, { event: EntityId; at: number }>>;

const DAY = 1440;

/** R-005 [M]: qué clave apunta cada tipo de evento y cuáles borra. `sueno` va aparte (depende de la hora). */
export const ORIGIN_RULES: Readonly<Record<string, { set?: OriginKey[]; clear?: OriginKey[] }>> = Object.freeze({
  JOB_LOST: { set: ['desempleo', 'dinero'] },
  JOB_HIRED: { clear: ['desempleo'] },
  INFORMAL_WORK_STARTED: { clear: ['desempleo'] },
  DEBT_TAKEN: { set: ['dinero'] },
  PAYMENT_MISSED: { set: ['dinero'] },
  RENT_LATE: { set: ['dinero'] },
  FELL_ILL: { set: ['enfermedad'] },
  CONDITION_DIAGNOSED: { set: ['enfermedad'] },
  RECOVERED: { clear: ['enfermedad'] },
  PNR_EPISODE: { set: ['malestar'] },
  CHAT_CLAIM_BELIEVED: { set: ['malestar'] },
  BREAKUP: { set: ['malestar', 'conflicto'] },
  CONFRONTATION: { set: ['malestar', 'conflicto'] },
  ARGUMENT: { set: ['conflicto'] },
  BOND_STRAINED: { set: ['conflicto'] },
});

/** R-005: lo que le quita horas de sueño si pasa dentro de su horario de dormir. */
const SLEEP_THIEVES = new Set(['LEISURE_DONE', 'PNR_EPISODE', 'ARGUMENT', 'CONFRONTATION']);

/** Minuto del día dentro de [desde, hasta), con el paso por medianoche. */
const within = (m: number, from: number, to: number) => (from <= to ? m >= from && m < to : m >= from || m < to);

/** Personas a las que toca un evento: las participantes y, si participa un hogar, su jefe o jefa. */
function peopleOf(e: DeepReadonly<WorldEvent>, view: WorldView): EntityId[] {
  const out = new Set<EntityId>();
  for (const p of e.participants) {
    if (p.id.startsWith('CIT-')) out.add(p.id);
    else if (p.id.startsWith('HOU-')) {
      const head = view.households.get(p.id)?.headId;
      if (head) out.add(head);
    }
  }
  return [...out].sort();
}

export function createOriginsSystem(): System {
  return {
    id: 'origins', phase: 'end_of_day', order: 5, capability: 'needs', cadence: 'tick', minLevel: 0,
    run: (view: WorldView, ctx: TickCtx): SystemOutput => {
      if (ctx.events.length === 0) return {};
      const changed = new Map<EntityId, StateOrigins>();
      const of = (id: EntityId) => changed.get(id) ?? changed.set(id, { ...(view.citizens.get(id)?.origins ?? {}) } as StateOrigins).get(id)!;
      const bed = view.components.i32['routine.bed'];
      const wakeW = view.components.i32['routine.wakeW'];
      for (const e of ctx.events) {
        const rule = ORIGIN_RULES[e.type];
        const thief = SLEEP_THIEVES.has(e.type);
        if (!rule && !thief) continue;
        for (const id of peopleOf(e, view)) {
          if (view.citizens.get(id)?.status !== 'active') continue;
          const o = of(id);
          for (const k of rule?.clear ?? []) delete o[k];
          for (const k of rule?.set ?? []) o[k] = { event: e.id, at: e.at };
          const row = idNumber(id);
          if (thief && bed && wakeW && within(((e.at % DAY) + DAY) % DAY, bed[row]!, wakeW[row]!)) o.sueno = { event: e.id, at: e.at };
        }
      }
      const patches: Patch[] = [...changed.keys()].sort().map((id) => ({ op: 'entity', id, owned: true, fields: { origins: changed.get(id) } }));
      return { patches };
    },
  };
}

/** Claves que explican el estrés y ventana en que su hecho sigue contando [M]. */
export const STRESS_KEYS: readonly OriginKey[] = ['conflicto', 'malestar', 'dinero', 'desempleo', 'enfermedad'];
const WINDOW_DAYS: Readonly<Record<OriginKey, number>> = { desempleo: 365, dinero: 90, enfermedad: 30, malestar: 14, conflicto: 14, sueno: 3 };

/**
 * R-001, R-005: la causa de evento que acompaña a un estado citado: el hecho más reciente de las claves dadas que siga
 * en su ventana, con el peso del estado. Vacío si no hay ninguno.
 */
export function originCause(view: WorldView, row: number, keys: readonly OriginKey[], now: number, weight: number): CauseRef[] {
  const o = view.citizens.get(formatId('CIT', row) as EntityId)?.origins;
  if (!o) return [];
  let best: { event: EntityId; at: number } | undefined;
  for (const k of keys) {
    const x = o[k];
    if (x && now - x.at <= WINDOW_DAYS[k] * DAY && x.at <= now && (!best || x.at > best.at)) best = x;
  }
  return best ? [{ event: best.event, weight }] : [];
}

/**
 * R-005: la deuda de sueño citada como causa, con lo que le quitó el sueño en los últimos días o, si no hubo nada,
 * su horario (la cadena termina ahí con esa explicación).
 */
export function sleepCauses(view: WorldView, row: number, now: number, debt: number, weight: number): CauseRef[] {
  const id = formatId('CIT', row) as EntityId;
  // Sin deuda de sueño no hay nada que citar (la revisión de cierre de M3 encontró «deuda de sueño de 0 h»).
  if (debt <= 0) return [];
  const origin = originCause(view, row, ['sueno'], now, weight);
  return [{ state: 'deuda_de_sueno', entity: id, value: debt, weight }, ...(origin.length ? origin : [{ state: 'horario_de_sueno', entity: id, weight }])];
}
