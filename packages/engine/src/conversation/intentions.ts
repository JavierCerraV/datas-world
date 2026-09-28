// Intenciones tras la charla (spec 044 R-006): llamar, confrontar, rumiar o preguntar, elegidas con la selección de
// la 040 (softmax con la temperatura de `hist.variability`). Las fuentes salen de su historia en las charlas: lo
// reforzado al confrontar (contraatacar, poner un límite), al evitar (callar, evadir) y al abrirse. Sin temperamento.
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import { pickIndex, softmax, strengthContribution, temperatureOf } from '../decision/select.ts';
import type { FunctionStore } from '../functions/types.ts';
import { idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import type { Rng } from '../rng.ts';
import type { WorldView } from '../simulation/system.ts';
import type { Intention } from '../world.ts';
import type { ClaimParams } from './params.ts';
import { stanceStrength } from './tone.ts';
import type { ChatCatalog, ChatContribution } from './types.ts';

export type IntentionKind = Intention['kind'];
/** Candidatas en orden de clave (el orden de la selección, 023). */
export const INTENTION_KINDS: readonly IntentionKind[] = Object.freeze(['confrontar', 'llamar', 'preguntar', 'rumiar']);

/** El estrato de la vivienda de la persona (029), si se conoce. */
export function stratumOf(view: WorldView, citizenId: EntityId): number | undefined {
  const h = view.citizens.get(citizenId)?.householdId;
  const dwelling = h ? view.places.get(view.households.get(h)?.dwellingId ?? ('' as EntityId)) : undefined;
  const district = dwelling?.districtId ? view.places.get(dwelling.districtId) : undefined;
  return district?.stratum ?? dwelling?.stratum;
}

/** Tiene un celular activo (044 P2). */
export function hasPhone(view: WorldView, citizenId: EntityId, cat: ChatCatalog): boolean {
  const kind = cat.phone?.kind;
  if (!kind) return false;
  for (const o of view.objects.values()) if (o.ownerId === citizenId && o.kind === kind && o.status === 'active') return true;
  return false;
}

/** Puede llamar ahora: tiene celular y saldo o datos, con la probabilidad de su estrato (`callAccess`). */
export function canCall(view: WorldView, citizenId: EntityId, cat: ChatCatalog, rng: Rng): boolean {
  if (!hasPhone(view, citizenId, cat)) return false;
  const p = cat.phone?.callAccess[String(stratumOf(view, citizenId) ?? '')] ?? 1;
  return rng.chance(p);
}

const i32 = (view: WorldView, col: string, id: EntityId) => view.components.i32[col]?.[idNumber(id)] ?? 0;
export const placeOf = (view: WorldView, id: EntityId): number => i32(view, 'loc.place', id);
export const awake = (view: WorldView, id: EntityId): boolean => (view.components.u8[ACTIVITY_COLUMN]?.[idNumber(id)] ?? 0) !== ACTIVITY.sleep;
export const together = (view: WorldView, a: EntityId, b: EntityId): boolean => placeOf(view, a) !== 0 && placeOf(view, a) === placeOf(view, b);

/** La mayor fuerza vigente entre varias posturas de la charla (043 R-009). */
function strongest(store: FunctionStore, cat: ChatCatalog, keys: readonly string[]): number {
  let w = 0;
  for (const k of keys) {
    const st = cat.stances.find((x) => x.key === k);
    if (st) w = Math.max(w, stanceStrength(store, st));
  }
  return w;
}

export interface IntentionOption {
  kind: IntentionKind;
  value: number;
  sources: ChatContribution[];
}

/**
 * R-006: aportes de cada respuesta. `llamar` solo si puede llamar y no están juntos.
 * - fuerza: lo reforzado en su historia (confrontar: contraatacar o poner un límite; rumiar: callar o evadir;
 *   preguntar: abrirse);
 * - urgencia: el impacto empuja a llamar (entero) y a confrontar (la mitad); su falta, a rumiar;
 * - duda: la credibilidad media empuja a preguntar.
 */
export function intentionOptions(
  store: FunctionStore, cat: ChatCatalog, impact: number, credibility: number, call: boolean, near: boolean, p: ClaimParams,
): IntentionOption[] {
  const confront = strengthContribution(strongest(store, cat, ['contraatacar', 'poner_limite']));
  const avoid = strengthContribution(strongest(store, cat, ['callar', 'evadir']));
  const open = strengthContribution(strongest(store, cat, ['abrirse']));
  const doubt = 1 - Math.abs(2 * credibility - 1);
  const opt = (kind: IntentionKind, sources: ChatContribution[]): IntentionOption => ({ kind, value: sources.reduce((a, s) => a + s.contribution, 0), sources });
  const out = [
    opt('confrontar', [{ source: 'fuerza', contribution: confront, ref: 'conv.contraatacar' }, { source: 'motivadora', contribution: 0.5 * p.urgencyWeight * impact, ref: 'urgencia' }]),
    opt('llamar', [{ source: 'fuerza', contribution: confront, ref: 'conv.contraatacar' }, { source: 'motivadora', contribution: p.urgencyWeight * impact, ref: 'urgencia' }]),
    opt('preguntar', [{ source: 'fuerza', contribution: open, ref: 'conv.abrirse' }, { source: 'reforzador', contribution: p.doubtWeight * doubt, ref: 'duda' }]),
    opt('rumiar', [{ source: 'fuerza', contribution: avoid, ref: 'conv.evadir' }, { source: 'motivadora', contribution: 0.5 * p.urgencyWeight * (1 - impact), ref: 'urgencia' }]),
  ];
  return out.filter((o) => o.kind !== 'llamar' || (call && !near));
}

export interface IntentionChoice {
  kind: IntentionKind;
  sources: ChatContribution[];
  probabilities: { kind: IntentionKind; p: number }[];
}

/** R-006: elige la respuesta por softmax con la temperatura de su variabilidad aprendida (040 R-004). */
export function chooseIntention(options: readonly IntentionOption[], variability: number, rng: Rng): IntentionChoice {
  const ps = softmax(options.map((o) => o.value), temperatureOf(variability));
  const k = pickIndex(ps, rng.next());
  const chosen = options[k]!;
  return {
    kind: chosen.kind,
    sources: [...chosen.sources].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
    probabilities: options.map((o, i) => ({ kind: o.kind, p: ps[i]! })),
  };
}
