// Reglas de la rutina en el mundo (spec 038 R-005, R-010): se dan al generar con el mismo aporte que el número fijo
// de la 040 (sin cambio de conducta al empezar) y cambian con la experiencia: buscar empleo sin conseguirlo acumula
// contraste (desaliento) y `JOB_HIRED` confirma la regla.
import type { ActivityKind } from '../activity.ts';
import { formatId, idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import { emptyNetwork } from '../relations/types.ts';
import type { RelationalNetwork } from '../relations/types.ts';
import type { Patch, System, SystemOutput, TickCtx, WorldView } from '../simulation/system.ts';
import type { World } from '../world.ts';
import { addRule } from './rules.ts';
import type { Rule } from './rules.ts';

const YEAR = 365.25 * 1440;

/** R-005 [M]: contraste por cada vez que se sigue la regla de buscar empleo sin conseguirlo. */
export const JOB_SEARCH_CONTRAST_RATE = 0.004;

/** Respuesta de la rutina para la regla de una actividad. */
export const routineResponse = (activity: ActivityKind | string): string => `rutina.${activity}`;

/** R-010 [M]: reglas de la rutina con su tipo inicial (por quién las dijo), consecuencia y fuerza. */
export const ROUTINE_RULES: readonly { activity: ActivityKind; speaker: string; cons: string; s: number; tracking: boolean }[] = Object.freeze([
  { activity: 'job_search', speaker: 'comunidad', cons: 'verbal.trabajo', s: 0.45, tracking: true },
  { activity: 'chores', speaker: 'familia', cons: 'verbal.aprobacion', s: 0.45, tracking: false },
  { activity: 'care', speaker: 'familia', cons: 'verbal.aprobacion', s: 0.45, tracking: false },
  { activity: 'study', speaker: 'colegio', cons: 'verbal.aprobacion', s: 0.35, tracking: false },
  { activity: 'errands', speaker: 'comunidad', cons: 'verbal.dinero', s: 0.45, tracking: true },
]);

/**
 * R-010: reglas de la rutina para cada persona activa de 12 años o más. Las de tracking empiezan con su historia
 * de contingencia (una confirmación), así que su tipo es tracking aunque las haya dicho otro.
 */
export function initRules(world: World): void {
  const c = world.components;
  for (let row = 1; row <= world.counters.CIT; row++) {
    if (c.u8.active?.[row] !== 1) continue;
    if ((world.now - (c.i32['demo.birthMinute']?.[row] ?? 0)) / YEAR < 12) continue;
    const person = world.citizens.get(formatId('CIT', row));
    if (!person || person.rules?.length) continue;
    const rules: Rule[] = [];
    const net: RelationalNetwork = person.network ?? emptyNetwork();
    for (const x of ROUTINE_RULES) {
      const r = addRule(rules, net, { ante: x.activity, resp: routineResponse(x.activity), cons: x.cons, src: 'speaker', speaker: x.speaker, s: x.s, now: world.now });
      if (x.tracking) r.hist.byContingency = 1;
    }
    person.rules = rules;
    person.network = net;
  }
}

/** Copia de trabajo de las reglas de una persona (por JSON: la vista congelada devuelve Proxies). */
export const rulesOf = (view: WorldView, row: number): Rule[] => {
  const own = view.citizens.get(formatId('CIT', row))?.rules;
  return own ? (JSON.parse(JSON.stringify(own)) as Rule[]) : [];
};

/** Sistema `rules` (fase `memory`, orden 3): `JOB_HIRED` confirma la regla de buscar empleo (R-005). */
export const rulesSystem: System = {
  id: 'rules',
  phase: 'memory',
  order: 3,
  capability: 'learning',
  cadence: 'tick',
  minLevel: 0,
  run: (view: WorldView, ctx: TickCtx): SystemOutput => {
    const patches: Patch[] = [];
    const active = new Set(ctx.citizens);
    for (const e of ctx.events) {
      if (e.type !== 'JOB_HIRED') continue;
      for (const p of e.participants) {
        if (!p.id.startsWith('CIT') || !active.has(idNumber(p.id))) continue;
        const rules = rulesOf(view, idNumber(p.id));
        const r = rules.find((x) => x.resp === routineResponse('job_search'));
        if (!r) continue;
        r.contrast = 0;
        r.hist.byContingency += 1;
        patches.push({ op: 'entity', id: p.id as EntityId, fields: { rules } });
      }
    }
    return patches.length ? { patches } : {};
  },
};
