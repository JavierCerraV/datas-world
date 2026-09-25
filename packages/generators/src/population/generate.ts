// Generador de población (specs 008 y 007): hogares por plantilla hasta la población objetivo, personas con
// sus datos, personalidad (009), apariencia y trayectoria previa.
import { addHousehold, addPerson, completeHousehold, idNumber, parseEpoch } from '@datas-world/engine';
import type { EntityId, Rng, World, WorldEvent } from '@datas-world/engine';
import type { Catalogs } from '../catalogs/load.ts';
import { seriesAt } from '../country/series.ts';
import type { Territory } from '../geography/generate.ts';
import { worldDate } from '../organizations/generate.ts';
import { definePersonalityColumns, generatePersonality, generateTemperament } from '../personality/generate.ts';
import type { PlacesResult } from '../places/generate.ts';
import { householdBackstory, personBackstory, sortBackstories } from './backstory.ts';
import { composeHousehold } from './households.ts';
import { definePeopleColumns, writeAppearance, writeDemographics } from './people.ts';
import { populationParams } from './params.ts';

export interface PopulationResult {
  citizenIds: EntityId[];
  householdIds: EntityId[];
  /** Eventos de la trayectoria previa (at < 0), para guardarlos con la creación del mundo. */
  events: WorldEvent[];
}

type PopulationCatalogs = Pick<
  Catalogs,
  | 'appearance'
  | 'birthplaces'
  | 'childhood_events'
  | 'education_levels'
  | 'family_names'
  | 'given_names'
  | 'personality_traits'
  | 'temperament_params'
>;

/**
 * 007 R-001: la población se genera por hogares. Cada hogar va a una vivienda libre de un barrio sorteado en
 * proporción a sus viviendas libres. Se para al llegar a `population.target` sin partir hogares (008 R-004).
 * Flujos: `gen:households` (composición, por hogar), `gen:people`, `gen:personality`, `gen:temperament`, `gen:appearance`
 * y `gen:backstory` (por persona u hogar).
 */
export function generatePopulation(
  world: World,
  territory: Territory,
  places: PlacesResult,
  catalogs: PopulationCatalogs,
  rng: Rng,
): PopulationResult {
  const profile = world.config.profile;
  if (!profile) throw new Error('El mundo no tiene perfil de país (spec 029)');
  const P = populationParams(profile, worldDate(world));
  const target = world.config.population.target;
  definePeopleColumns(world);
  definePersonalityColumns(world, catalogs.personality_traits, catalogs.temperament_params);

  const free = new Map<EntityId, EntityId[]>(territory.districtIds.map((d) => [d, []]));
  for (const id of places.dwellingIds) free.get(world.places.get(id)!.districtId!)!.push(id);
  const result: PopulationResult = { citizenIds: [], householdIds: [], events: [] };
  const given = (sex: 'F' | 'M') =>
    catalogs.given_names.entries.filter((e) => (e.attrs as { sex: string }).sex === sex);
  const families = catalogs.family_names.entries;

  for (let n = 0; ; n++) {
    const spec = composeHousehold(rng.fork('gen:households').fork(n), P);
    if (result.citizenIds.length + spec.members.length > target) break;
    const totalFree = [...free.values()].reduce((s, l) => s + l.length, 0);
    if (totalFree === 0) break;
    let pick = rng
      .fork('gen:dwellings')
      .fork(n)
      .int(0, totalFree - 1);
    const district = [...free.keys()].find((d) => (pick -= free.get(d)!.length) < 0)!;
    const dwellingId = free.get(district)!.shift()!;
    const stratum = world.places.get(district)!.stratum!;
    const householdId = addHousehold(world, { template: spec.template, dwellingId });

    const ids: EntityId[] = [];
    const surnames: [string, string][] = [];
    spec.members.forEach((m, i) => {
      const r = rng.fork('gen:people').fork(`${householdId}/${i}`);
      const own = (): string => families[r.int(0, families.length - 1)]!.name;
      const from = (k: number | null) => (k === null ? own() : surnames[k]![0]);
      const family: [string, string] = [from(m.surnameFrom[0]), from(m.surnameFrom[1])];
      surnames.push(family);
      const names = given(m.sex);
      // 030 R-005: nacer en el campo es tan probable como no urbana era Colombia el año de nacimiento.
      const birthYear = parseEpoch(world.config.epoch).year - m.age;
      const rural = r.chance(1 - seriesAt(P.urbanization, birthYear));
      const pool = catalogs.birthplaces.entries.filter((e) => Boolean((e.attrs as { rural?: boolean } | undefined)?.rural) === rural);
      const bp = pool[r.int(0, pool.length - 1)]!.key;
      const birthplace = m.age < 18 || bp === 'local.municipio' ? territory.municipalityId : bp;
      const id = addPerson(world, {
        name: { given: names[r.int(0, names.length - 1)]!.name, family },
        sex: m.sex,
        birthplace,
        householdId,
      });
      const level = writeDemographics(
        world,
        id,
        { age: m.age, sex: m.sex, stratum, householdRow: idNumber(householdId) },
        P,
        r,
      );
      generatePersonality(world, id, catalogs.personality_traits, P.personality, rng.fork('gen:personality'));
      generateTemperament(world, id, catalogs.temperament_params, rng.fork('gen:temperament'));
      writeAppearance(world, id, m.age, m.sex, catalogs.appearance, rng.fork('gen:appearance').fork(id));
      personBackstory(
        world,
        id,
        level,
        catalogs.education_levels,
        catalogs.childhood_events,
        rng.fork('gen:backstory').fork(id),
        result.events,
      );
      ids.push(id);
    });
    completeHousehold(world, householdId, {
      headId: ids[spec.head]!,
      kinship: spec.kinship.map((k) => ({ from: ids[k.from]!, to: ids[k.to]!, kind: k.kind })),
      caregiverIds: spec.caregivers.map((c) => ids[c]!),
    });
    householdBackstory(world, householdId, rng.fork('gen:backstory').fork(householdId), result.events);
    result.householdIds.push(householdId);
    result.citizenIds.push(...ids);
  }
  sortBackstories(world, result.events);
  return result;
}
