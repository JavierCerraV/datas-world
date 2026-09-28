// Sistema `learning` (spec 036; bloque MF2.5): en la fase `memory`, las consecuencias del tick (eventos de las
// fases anteriores, `TickCtx.events`) actualizan las funciones de las personas que participan en ellas.
import { formatId, idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import { profileEntry, profileValue } from '../profile.ts';
import type { CountryProfile } from '../profile.ts';
import type { DeepReadonly, Patch, System, SystemOutput, TickCtx, WorldView } from '../simulation/system.ts';
import { pair, prune } from './learn.ts';
import { EVENT_LEARNING } from './rules.ts';
import { histOf, learnSelection } from './selection.ts';
import type { HistState } from './selection.ts';
import { sensitivityOf } from './sensitivity.ts';
import { LEARNING_DEFAULTS, emptyStore } from './types.ts';
import type { FunctionStore, LearningParams, Ontology } from './types.ts';

/** Parámetros del perfil (`learning.params`) sobre los valores por defecto de la 036 §8. */
export function learningParams(profile: CountryProfile | DeepReadonly<CountryProfile> | undefined, date: string): LearningParams {
  const p = profile as CountryProfile | undefined;
  if (!p || !profileEntry(p, 'learning.params', date)) return LEARNING_DEFAULTS;
  return { ...LEARNING_DEFAULTS, ...(profileValue(p, 'learning.params', date) as Partial<LearningParams>) };
}

/** Copia de trabajo del almacén de una persona (por JSON: con la vista congelada, lo anidado son Proxies). */
export const storeOf = (view: WorldView, row: number): FunctionStore => {
  const own = view.citizens.get(formatId('CIT', row))?.functions;
  return own ? (JSON.parse(JSON.stringify(own)) as FunctionStore) : emptyStore();
};

/** Quién aprende de un evento: las personas participantes y, si participa un hogar (`RENT_LATE`), su jefe o jefa. */
export function learners(e: DeepReadonly<{ participants: readonly { id: EntityId }[] }>, view: WorldView): number[] {
  const rows: number[] = [];
  for (const p of e.participants) {
    if (p.id.startsWith('CIT')) rows.push(idNumber(p.id));
    else if (p.id.startsWith('HOU')) {
      const head = view.households.get(p.id)?.headId;
      if (head) rows.push(idNumber(head));
    }
  }
  return rows;
}

export function createLearningSystem(onto: Ontology): System {
  const run = (view: WorldView, ctx: TickCtx): SystemOutput => {
    if (ctx.events.length === 0) return {};
    const P = learningParams(view.config.profile, view.config.epoch.slice(0, 10));
    const active = new Set(ctx.citizens);
    const stores = new Map<number, FunctionStore>();
    const hists = new Map<number, HistState>();
    for (const e of ctx.events) {
      const rule = EVENT_LEARNING[e.type];
      if (!rule) continue;
      const stims = rule.stims(e, view).filter((s) => onto.classes.has(s));
      if (stims.length === 0) continue;
      const lambda = typeof rule.lambda === 'number' ? rule.lambda : rule.lambda(e, view);
      const ctxKey = e.placeId ? `lugar.${view.places.get(e.placeId)?.kind ?? ''}` : '';
      for (const row of learners(e, view)) {
        if (!active.has(row)) continue;
        if (!stores.has(row)) stores.set(row, storeOf(view, row));
        if (!hists.has(row)) hists.set(row, histOf(view, row));
        const store = stores.get(row)!;
        const sens = sensitivityOf(view, row);
        for (const stim of stims)
          pair(store, onto, { stim, ctx: ctxKey, now: ctx.now, lambda, us: rule.us, source: e.id, ...(rule.social ? { social: true } : {}) }, P, sens);
        learnSelection(e, lambda, store, hists.get(row)!, P, sens);
      }
    }
    const patches: Patch[] = [];
    for (const [row, store] of [...stores].sort((a, b) => a[0] - b[0])) {
      prune(store, P);
      patches.push({ op: 'entity', id: formatId('CIT', row) as EntityId, fields: { functions: store } });
      const h = hists.get(row)!;
      const f = view.components.f32;
      if (f['hist.discountK'] && h.k !== f['hist.discountK'][row]) patches.push({ op: 'set', type: 'f32', column: 'hist.discountK', row, value: h.k });
      if (f['hist.variability'] && h.variability !== f['hist.variability'][row])
        patches.push({ op: 'set', type: 'f32', column: 'hist.variability', row, value: h.variability });
    }
    return { patches };
  };
  return {
    id: 'learning',
    // Después de la movilidad, la economía y el trabajo: aprende de las consecuencias del tick.
    phase: 'memory',
    order: 1,
    capability: 'learning',
    cadence: 'tick',
    minLevel: 0,
    run,
  };
}
