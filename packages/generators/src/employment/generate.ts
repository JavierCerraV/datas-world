// Situación laboral inicial (spec 006 R-002, R-004, R-008): ocupados formales e informales, desocupados e
// inactivos, con los eventos de trayectoria que la explican (spec 007 R-006, CA-003).
import { ageInYears, hire, idNumber, makeEvent, profileEntry, profileNumber, profileValue, setOccupation } from '@datas-world/engine';
import type { EntityId, Rng, World, WorldEvent } from '@datas-world/engine';
import type { Catalog } from '../catalogs/schema.ts';
import { limitsWork } from '../health/habits.ts';
import { worldDate } from '../organizations/generate.ts';

const CAUSE = [{ state: 'backstory', weight: 1 }];
const DAY = 1440;
const YEAR = 525_600;

export interface EmploymentResult {
  events: WorldEvent[];
}

/** Probabilidad de estar ocupado según la tabla por tramos de edad del perfil (`{"15": p, "18": p, …}`). */
export function employmentProbability(table: Record<string, number>, age: number): number {
  let p = 0;
  for (const [from, v] of Object.entries(table).sort((a, b) => Number(a[0]) - Number(b[0])))
    if (age >= Number(from)) p = v;
  return p;
}

/**
 * 006 R-002/R-004 y R-008:
 * 1. Se barajan las personas de 15 años o más.
 * 2. Cada una está ocupada con la probabilidad de su edad y sexo.
 * 3. Las ocupadas son informales o independientes con probabilidad `gen.labor.informalShare`, o si son
 *    menores de edad o no queda puesto formal; si no, ocupan un puesto libre elegido con pesos por estrato
 *    (oficina y hospital ×3 en estrato 4, fábrica ×3 en estrato 2), empezando por el del jefe.
 * 4. Las no ocupadas quedan desocupadas o inactivas (estudio, oficios del hogar, pensión, otro).
 * Los menores de 15 años no trabajan (estudiantes desde los 5 años).
 */
export function generateEmployment(
  world: World,
  citizenIds: readonly EntityId[],
  orgIds: readonly EntityId[],
  catalogs: { trades_informal: Catalog },
  rng: Rng,
): EmploymentResult {
  const profile = world.config.profile;
  if (!profile) throw new Error('El mundo no tiene perfil de país (spec 029)');
  const date = worldDate(world);
  const table = {
    F: profileValue(profile, 'gen.labor.employmentByAge.F', date),
    M: profileValue(profile, 'gen.labor.employmentByAge.M', date),
  } as Record<'F' | 'M', Record<string, number>>;
  const informalShare = profileNumber(profile, 'gen.labor.informalShare', date);
  // 031 R-004: la discapacidad para caminar o para el autocuidado baja la probabilidad de empleo.
  const disabilityFactor = profileEntry(profile, 'gen.health.disabilityEmploymentFactor', date)
    ? profileNumber(profile, 'gen.health.disabilityEmploymentFactor', date)
    : 1;
  const unemployedP = profileNumber(profile, 'gen.labor.unemployedP', date);
  const adultStudentP = profileNumber(profile, 'gen.labor.adultStudentP', date);
  const homeDutiesP = {
    F: profileNumber(profile, 'gen.labor.homeDutiesP.F', date),
    M: profileNumber(profile, 'gen.labor.homeDutiesP.M', date),
  };
  const events: WorldEvent[] = [];
  const age = (id: EntityId) =>
    ageInYears(world.components.i32['demo.birthMinute']![idNumber(id)]!, world.now, world.config.epoch);
  const record = (id: EntityId, e: WorldEvent) => {
    events.push(e);
    const b = world.citizens.get(id)!.backstory!;
    b.push(e.id);
  };
  const birthPlus = (id: EntityId, years: number) =>
    world.components.i32['demo.birthMinute']![idNumber(id)]! + years * YEAR;

  // Menores de 15: fuera de la población en edad de trabajar.
  for (const id of citizenIds) {
    const a = age(id);
    if (a < 15) setOccupation(world, id, { kind: 'none', reason: a >= 5 ? 'student' : 'minor', since: 0 });
  }
  // 1. Orden aleatorio (Fisher–Yates) de la población de 15 años o más.
  const pet = citizenIds.filter((id) => age(id) >= 15);
  const shuffle = rng.fork('gen:jobs/order');
  for (let i = pet.length - 1; i > 0; i--) {
    const j = shuffle.int(0, i);
    [pet[i], pet[j]] = [pet[j]!, pet[i]!];
  }
  const freeOf = (orgId: EntityId) => world.organizations.get(orgId)!.positions.filter((p) => p.holderId === undefined);
  const trades = catalogs.trades_informal.entries;

  for (const id of pet) {
    const r = rng.fork('gen:jobs').fork(id);
    const c = world.citizens.get(id)!;
    const a = age(id);
    const pensioned = world.components.u8['demo.pensioned']![idNumber(id)] === 1;
    const pEmp =
      employmentProbability(table[c.sex!], a) * (pensioned ? 0.3 : 1) * (limitsWork(world, id) ? disabilityFactor : 1);
    if (r.chance(pEmp)) {
      const open = orgIds.filter((o) => freeOf(o).length > 0);
      const formal = a >= 18 && open.length > 0 && !r.chance(informalShare);
      if (formal) {
        const stratum = world.places.get(world.households.get(c.householdId!)!.dwellingId)!.districtId!;
        const s = world.places.get(stratum)!.stratum!;
        const weights = open.map((o) => {
          const kind = world.places.get(world.organizations.get(o)!.placeIds[0]!)!.kind;
          if (kind === 'servicios.oficina' || kind === 'salud.hospital') return s >= 4 ? 3 : 1;
          if (kind === 'industria.fabrica') return s <= 2 ? 3 : 1;
          return 1;
        });
        let x = r.next() * weights.reduce((t, w) => t + w, 0);
        let k = 0;
        while (x >= weights[k]!) x -= weights[k++]!;
        const org = world.organizations.get(open[k]!)!;
        const pos = freeOf(org.id)[0]!;
        hire(world, id, org.id, pos.id);
        const tenure = r.int(0, Math.max(0, Math.min(20, a - 18)) * 365) * DAY;
        const at = Math.min(Math.max(-tenure - DAY, birthPlus(id, 18)), -DAY);
        record(
          id,
          makeEvent(world.counters, at, {
            type: 'JOB_HIRED',
            payload: { citizenId: id, orgId: org.id, positionId: pos.id, orgName: org.name },
            participants: [{ id, role: 'contratado' }],
            causes: CAUSE,
          }),
        );
      } else {
        const t = trades[r.int(0, trades.length - 1)]!;
        const kind = (t.attrs as { kind: 'informal' | 'independent' }).kind;
        setOccupation(world, id, { kind, trade: t.key });
        const since = r.int(0, Math.max(0, Math.min(15, a - 15)) * 365) * DAY;
        const at = Math.min(Math.max(-since - DAY, birthPlus(id, 15)), -DAY);
        record(
          id,
          makeEvent(world.counters, at, {
            type: 'INFORMAL_WORK_STARTED',
            payload: { citizenId: id, kind, trade: t.key, tradeName: t.name },
            participants: [{ id, role: 'trabajador' }],
            causes: CAUSE,
          }),
        );
      }
      continue;
    }
    // 4. No ocupados: pensión, estudio, desempleo, oficios del hogar u otro motivo.
    if (pensioned) {
      setOccupation(world, id, { kind: 'none', reason: 'pensioned', since: 0 });
      const pa = profileValue(profile, 'pension.age', date) as Record<string, number>;
      record(
        id,
        makeEvent(world.counters, Math.min(birthPlus(id, pa[c.sex!]!), -DAY), {
          type: 'RETIRED',
          payload: { citizenId: id },
          participants: [{ id, role: 'pensionado' }],
          causes: CAUSE,
        }),
      );
    } else if (a < 18 || (a < 25 && r.chance(adultStudentP))) {
      setOccupation(world, id, { kind: 'none', reason: 'student', since: 0 });
    } else if (a < 65 && r.chance(unemployedP)) {
      const since = -r.int(10, 120) * DAY; // como `genJobs`: desempleado desde hace 10 a 120 días
      setOccupation(world, id, { kind: 'none', reason: 'unemployed', since });
      record(
        id,
        makeEvent(world.counters, since, {
          type: 'JOB_LOST',
          payload: { citizenId: id, reason: 'fin del empleo anterior' },
          participants: [{ id, role: 'desocupado' }],
          causes: CAUSE,
        }),
      );
    } else {
      setOccupation(world, id, {
        kind: 'none',
        reason: r.chance(homeDutiesP[c.sex!]) ? 'home_duties' : 'other_inactive',
        since: 0,
      });
    }
  }
  return { events };
}
