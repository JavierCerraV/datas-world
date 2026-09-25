// Genealogía hacia atrás desde el presente (spec 030 R-002, R-004): padres, abuelos y a veces bisabuelos.
import { addAncestor, defineColumn, idNumber, setParents } from '@datas-world/engine';
import type { EntityId, Rng, World } from '@datas-world/engine';
import type { Catalog } from '../catalogs/schema.ts';
import { seriesAt } from '../country/series.ts';
import type { Clock, HistoryParams } from './params.ts';

const DAY = 1440;
const YEAR = 365 * DAY;

export const HISTORY_COLUMNS = [
  ['i32', 'demo.deathMinute'],
  ['u8', 'demo.generation'],
] as const;

export function defineHistoryColumns(world: World): void {
  const c = world.components;
  for (const [type, name] of HISTORY_COLUMNS) if (!(name in c[type])) defineColumn(c, type, name, 0);
}

export interface GenealogyCatalogs {
  birthplaces: Catalog;
  given_names: Catalog;
  family_names: Catalog;
}

/** Lugar de nacimiento: campo con probabilidad 1 − urbanización del año (030 R-005); el municipio solo tras su fundación. */
export function sampleBirthplace(
  r: Rng,
  birthYear: number,
  catalog: Catalog,
  P: HistoryParams,
  municipalityId: EntityId,
): string {
  const rural = r.chance(1 - seriesAt(P.urbanization, birthYear));
  const pool = catalog.entries.filter((e) => Boolean((e.attrs as { rural?: boolean } | undefined)?.rural) === rural);
  const key = pool[r.int(0, pool.length - 1)]!.key;
  if (key !== 'local.municipio') return key;
  return birthYear > P.foundingYear ? municipalityId : 'rural.campo';
}

/**
 * Crea los antepasados que faltan de cada persona viva, en orden de id. Los padres que viven en el mismo hogar
 * (parentesco `parent` de 008) son los padres reales; el que falta se crea como antepasado y lo comparten los
 * hermanos. Generaciones: 1 padres, 2 abuelos, 3 bisabuelos (con probabilidad `greatGrandparentP`).
 * Flujo `hist:genealogy/<id del hijo>`. Devuelve los antepasados creados, en orden de creación.
 */
export function generateGenealogy(
  world: World,
  livingIds: readonly EntityId[],
  catalogs: GenealogyCatalogs,
  P: HistoryParams,
  clock: Clock,
  municipalityId: EntityId,
  rng: Rng,
): EntityId[] {
  defineHistoryColumns(world);
  // Las columnas se reasignan al crecer (addAncestor → ensureCapacity): se leen en cada acceso.
  const birth = { get: (id: EntityId) => world.components.i32['demo.birthMinute']![idNumber(id)]! };
  const gen = { get: (id: EntityId) => world.components.u8['demo.generation']![idNumber(id)]! };
  const created: EntityId[] = [];
  const shared = new Map<string, EntityId>();
  const given = (sex: 'F' | 'M') =>
    catalogs.given_names.entries.filter((e) => (e.attrs as { sex: string }).sex === sex);
  const families = catalogs.family_names.entries;

  const makeAncestor = (r: Rng, sex: 'F' | 'M', firstSurname: string, born: number, generation: number) => {
    const names = given(sex);
    const id = addAncestor(world, {
      name: { given: names[r.int(0, names.length - 1)]!.name, family: [firstSurname, families[r.int(0, families.length - 1)]!.name] },
      sex,
      birthplace: sampleBirthplace(r, clock.yearOf(born), catalogs.birthplaces, P, municipalityId),
    });
    world.components.i32['demo.birthMinute']![idNumber(id)] = born;
    world.components.u8['demo.generation']![idNumber(id)] = generation;
    created.push(id);
    return id;
  };

  type Known = { mother?: EntityId | undefined; father?: EntityId | undefined; key: string };
  const inHousehold = (childId: EntityId): Known => {
    const child = world.citizens.get(childId)!;
    const h = child.householdId ? world.households.get(child.householdId) : undefined;
    const parents = (h?.kinship ?? []).filter((k) => k.kind === 'parent' && k.to === childId).map((k) => k.from).sort();
    const bySex = (s: 'F' | 'M') => parents.find((p) => world.citizens.get(p)!.sex === s);
    return { mother: bySex('F'), father: bySex('M'), key: parents.length > 0 ? `${h!.id}/${parents.join('+')}` : childId };
  };

  const assignParents = (childId: EntityId, generation: number) => {
    const child = world.citizens.get(childId)!;
    const known: Known = generation === 0 ? inHousehold(childId) : { key: childId };
    const r = rng.fork('hist:genealogy').fork(childId);
    const born = birth.get(childId);
    const ageAt = (id: EntityId) => (born - birth.get(id)) / YEAR;
    const gap = () => r.int(P.fatherAgeGap[0], P.fatherAgeGap[1]);
    // Edad de la madre y del padre al nacer el hijo: datos del presente si viven, si no, del perfil (INV-002).
    let mAge: number;
    if (known.mother) mAge = ageAt(known.mother);
    else if (known.father) mAge = Math.min(45, Math.max(16, ageAt(known.father) - gap()));
    else mAge = r.int(P.motherAgeAtBirth[0], P.motherAgeAtBirth[1]);
    const fAge = known.father ? ageAt(known.father) : Math.min(65, Math.max(16, mAge + gap()));
    const pick = (role: 'F' | 'M', age: number, surname: string): EntityId => {
      const key = `${known.key}/${role}`;
      const hit = shared.get(key);
      if (hit) return hit;
      const id = makeAncestor(r, role, surname, born - Math.round(age * YEAR) - r.int(0, 364) * DAY, generation + 1);
      shared.set(key, id);
      return id;
    };
    const family = child.name!.family;
    const motherId = known.mother ?? pick('F', mAge, family[1]);
    const fatherId = known.father ?? pick('M', fAge, family[0]);
    setParents(world, childId, motherId, fatherId);
    return [motherId, fatherId].filter((id) => created.includes(id) && gen.get(id) === generation + 1);
  };

  const visited = new Set<EntityId>();
  const expand = (id: EntityId, generation: number, r: Rng) => {
    if (visited.has(id)) return;
    visited.add(id);
    if (generation >= 3 || (generation === 2 && !r.chance(P.greatGrandparentP))) return;
    for (const p of assignParents(id, generation)) expand(p, generation + 1, rng.fork('hist:genealogy').fork(`${p}/up`));
  };
  for (const id of livingIds) expand(id, 0, rng.fork('hist:genealogy').fork(`${id}/up`));
  return created;
}

/** Linaje (030 §3): `{ childId, motherId?, fatherId? }` de toda persona con padres conocidos, en orden de id. */
export function lineageOf(world: World): { childId: EntityId; motherId?: EntityId; fatherId?: EntityId }[] {
  return [...world.citizens.values()]
    .filter((c) => c.motherId !== undefined || c.fatherId !== undefined)
    .sort((a, b) => idNumber(a.id) - idNumber(b.id))
    .map((c) => ({
      childId: c.id,
      ...(c.motherId !== undefined ? { motherId: c.motherId } : {}),
      ...(c.fatherId !== undefined ? { fatherId: c.fatherId } : {}),
    }));
}
