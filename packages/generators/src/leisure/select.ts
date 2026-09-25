// Qué actividades practica cada persona (spec 032 R-001, R-003, R-004). Sin frecuencias ni dinero: eso va en
// generate.ts.
import { ageInYears, idNumber } from '@datas-world/engine';
import type { EntityId, Rng, World } from '@datas-world/engine';
import type { Catalog } from '../catalogs/schema.ts';
import { limitsWork } from '../health/habits.ts';
import { stepAt } from '../health/params.ts';
import { legacyColumn } from '../personality/legacy.ts';
import type { ActivityAttrs, LeisureParams } from './params.ts';

export interface Offer {
  /** Tipos de lugar que existen en el municipio (con mapa) y en la ciudad de referencia. */
  local: Set<string>;
  regional: Set<string>;
}

/** Oferta de lugares del mundo (R-004). */
export function offerOf(world: World): Offer {
  const offer: Offer = { local: new Set(), regional: new Set() };
  for (const p of world.places.values()) {
    if (p.kind.startsWith('territorio.')) continue;
    if (p.rect) offer.local.add(p.kind);
    else if (p.travel) offer.regional.add(p.kind);
  }
  return offer;
}

/** Dónde puede hacerse: en casa, en el municipio, solo en la ciudad de referencia o en ningún sitio (R-004). */
export function reachOf(a: ActivityAttrs, offer: Offer): 'home' | 'local' | 'regional' | 'none' {
  if (a.placeKinds.some((k) => offer.local.has(k))) return 'local';
  if (a.home || a.placeKinds.length === 0) return 'home';
  if (a.placeKinds.some((k) => offer.regional.has(k))) return 'regional';
  return 'none';
}

/** Condiciones que limitan el esfuerzo (031): EPOC, artrosis. */
const LIMITING = new Set(['cronica.epoc', 'cronica.artrosis']);

export interface Choice {
  key: string;
  /** Puntuación relativa (factores personales × ruido), para la afinidad. */
  score: number;
}

/**
 * R-001: para cada actividad posible, la probabilidad de practicarla es su popularidad × los factores de la
 * persona (sexo, curva de edad, rasgos y valores de 009, coste frente al estrato), normalizados por su media en
 * el mundo para conservar la popularidad del perfil. R-003: fuera las de esfuerzo que la salud no permite.
 * Después se completa hasta `count.min` con las de más puntuación y se recorta a `count.max`.
 */
export function selectActivities(
  world: World,
  livingIds: readonly EntityId[],
  catalog: Catalog,
  P: LeisureParams,
  offer: Offer,
  rng: Rng,
): Map<EntityId, Choice[]> {
  const c = world.components;
  const age = (id: EntityId) => ageInYears(c.i32['demo.birthMinute']![idNumber(id)]!, world.now, world.config.epoch);
  const stratumOf = (id: EntityId) => {
    const h = world.households.get(world.citizens.get(id)!.householdId!)!;
    return world.places.get(world.places.get(h.dwellingId)!.districtId!)!.stratum!;
  };
  // @deprecated (035 §9): los rasgos y valores que nombra el catálogo, vía el adaptador, hasta MF7.3 (041 R-008).
  const trait = (col: string, id: EntityId) => legacyColumn(world, idNumber(id), col);
  const persons = livingIds.filter((id) => age(id) >= 3);
  const chosen = new Map<EntityId, Choice[]>(persons.map((id) => [id, []]));
  const candidates = new Map<EntityId, Choice[]>(persons.map((id) => [id, []]));

  for (const entry of catalog.entries) {
    const a = entry.attrs as unknown as ActivityAttrs;
    if (reachOf(a, offer) === 'none') continue;
    const pop = P.popularity[entry.key] ?? 0;
    const eligible = persons.filter((id) => {
      const years = age(id);
      if (years < a.ageRange[0] || years > a.ageRange[1]) return false;
      const conds = world.citizens.get(id)!.conditions ?? [];
      if (a.physical >= 1 && limitsWork(world, id)) return false;
      if (a.physical >= 2 && conds.some((h) => LIMITING.has(h.key))) return false;
      return true;
    });
    const factor = (id: EntityId) => {
      let m = (a.sex?.[world.citizens.get(id)!.sex!] ?? 1) * (a.ageCurve ? stepAt(a.ageCurve, age(id)) || 1 : 1);
      for (const [col, w] of Object.entries(a.traits ?? {})) m *= Math.max(0.1, 1 + w * (2 * trait(col, id) - 1));
      for (const [col, w] of Object.entries(a.values ?? {})) m *= Math.max(0.1, 1 + w * (2 * trait(col, id) - 1));
      const s = stratumOf(id);
      if (a.cost === 'medio' || a.cost === 'alto') m *= s <= 1 ? 0.5 : s === 2 ? 0.75 : s === 3 ? 1 : 1.25;
      return m;
    };
    const factors = new Map(eligible.map((id) => [id, factor(id)]));
    const mean = eligible.length ? [...factors.values()].reduce((s, x) => s + x, 0) / eligible.length : 1;
    for (const id of eligible) {
      const r = rng.fork('gen:leisure').fork(id).fork(entry.key);
      const rel = factors.get(id)! / mean;
      const choice = { key: entry.key, score: rel * (0.7 + 0.6 * r.next()) };
      candidates.get(id)!.push(choice);
      if (r.chance(Math.min(0.95, pop * rel))) chosen.get(id)!.push(choice);
    }
  }

  for (const id of persons) {
    const list = chosen.get(id)!.sort((x, y) => y.score - x.score || (x.key < y.key ? -1 : 1));
    for (const extra of candidates.get(id)!.sort((x, y) => y.score - x.score || (x.key < y.key ? -1 : 1))) {
      if (list.length >= P.count.min) break;
      if (!list.includes(extra)) list.push(extra);
    }
    chosen.set(id, list.slice(0, P.count.max));
  }
  return chosen;
}
