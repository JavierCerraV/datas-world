// Vínculos dirigidos (spec 012 §3, R-003, R-004, R-008): crearlos, tocarlos en un encuentro, etiquetarlos con
// histéresis y olvidarlos. El afecto es la función de `cit.<otro>` en el almacén (012 INV-003). Sin azar.
import type { FunctionStore } from '../functions/types.ts';
import type { EntityId } from '../ids.ts';
import type { DeepReadonly, WorldView } from '../simulation/system.ts';
import type { Bond, BondLabel } from '../world.ts';
import { personStimulus } from './params.ts';
import type { RelationshipParams } from './params.ts';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const DAY = 1440;

/** Afecto de la persona por otra: la función aprendida de su estímulo, en [−1,1] (0 si nunca la aprendió). */
export const affectionFor = (store: DeepReadonly<FunctionStore> | undefined, other: string): number => store?.f.find((f) => f.s === personStimulus(other))?.v ?? 0;

/** El vínculo con `other` en la lista (en orden de id); lo crea si no existe. */
export function bondWith(list: Bond[], other: EntityId, now: number, trust0: number): { bond: Bond; created: boolean } {
  const found = list.find((b) => b.with === other);
  if (found) return { bond: found, created: false };
  const bond: Bond = { with: other, tension: 0, trust: trust0, at: now, familiarity: 0, labels: [], encounters: 0 };
  list.push(bond);
  list.sort((x, y) => (x.with < y.with ? -1 : 1));
  return { bond, created: true };
}

/** R-003: un encuentro sube la familiaridad hacia 1 y cuenta. */
export function touch(b: Bond, now: number, p: RelationshipParams): void {
  const f = b.familiarity ?? 0;
  b.familiarity = clamp01(f + p.familiarityGain * (1 - f));
  b.encounters = (b.encounters ?? 0) + 1;
  b.lastEncounter = now;
  b.at = now;
}

const withLabel = (b: Bond, l: BondLabel, on: boolean): boolean => {
  const has = (b.labels ?? []).includes(l);
  if (has === on) return false;
  b.labels = on ? [...(b.labels ?? []), l].sort() : (b.labels ?? []).filter((x) => x !== l);
  return true;
};

/**
 * R-004: etiquetas con histéresis. `conocido` desde el primer encuentro; `companero` si comparten organización;
 * `amigo` al superar familiaridad y afecto de entrada, y se pierde por debajo de los de salida. Devuelve si se hizo
 * amigo ahora. `familia`, `pareja` y `ex` no cambian aquí.
 */
export function relabel(b: Bond, affection: number, sameOrg: boolean, p: RelationshipParams): { becameFriend: boolean } {
  withLabel(b, 'conocido', true);
  withLabel(b, 'companero', sameOrg);
  const f = b.familiarity ?? 0;
  const friend = (b.labels ?? []).includes('amigo');
  // La familia ya tiene su etiqueta: la amistad es entre quienes no lo son.
  if ((b.labels ?? []).includes('familia')) return { becameFriend: false };
  if (!friend && f >= p.friendFam && affection >= p.friendFn) return { becameFriend: withLabel(b, 'amigo', true) };
  if (friend && (f < p.friendFamOut || affection < p.friendFnOut)) withLabel(b, 'amigo', false);
  return { becameFriend: false };
}

export const setLabel = withLabel;

/** R-003: un día sin contacto baja la familiaridad. */
export function decayDay(b: Bond, now: number, p: RelationshipParams): void {
  if ((b.lastEncounter ?? b.at) >= now - DAY) return;
  b.familiarity = clamp01((b.familiarity ?? 0) - p.familiarityDecayDay);
}

/**
 * R-008: los conocidos casi olvidados. No se olvida a la familia, la pareja, los amigos ni las exparejas, ni un vínculo
 * con tensión viva (`tension`, ya con su decaimiento): el conflicto de la 044 no se borra por no verse.
 */
export const forgettable = (b: Bond, tension: number, p: RelationshipParams): boolean =>
  (b.familiarity ?? 0) < p.forgetFam && tension < 0.05 && !(b.labels ?? []).some((l) => l === 'familia' || l === 'pareja' || l === 'amigo' || l === 'ex');

/** Las últimas causas de un vínculo (R-009), como referencias de evento. */
export const bondCauses = (b: Bond | undefined, weight: number): { event: EntityId; weight: number }[] =>
  (b?.events ?? []).map((e) => ({ event: e as EntityId, weight }));

/** R-004: la persona ya tiene pareja (por su hogar, 008, o por una etiqueta). */
export function hasPartner(view: WorldView, id: EntityId, bonds: readonly Bond[]): boolean {
  if (bonds.some((b) => (b.labels ?? []).includes('pareja'))) return true;
  const me = view.citizens.get(id);
  const h = me?.householdId ? view.households.get(me.householdId) : undefined;
  return !!h?.kinship.some((k) => k.kind === 'partner' && (k.from === id || k.to === id));
}

/** Comparten organización empleadora (006). */
export function sameOrg(view: WorldView, a: EntityId, b: EntityId): boolean {
  const x = view.citizens.get(a)?.occupation;
  const y = view.citizens.get(b)?.occupation;
  return x?.kind === 'formal' && y?.kind === 'formal' && x.orgId === y.orgId;
}
