// Ficha de esparcimiento (spec 032): actividades, afinidad y frecuencia de cada persona viva, con el tiempo libre
// (R-005) y el presupuesto del hogar (R-002) como límites, y `LEISURE_TAKEN_UP` en la trayectoria.
import { ageInYears, idNumber, makeEvent } from '@datas-world/engine';
import type { CauseRef, EntityId, LeisureInterest, Rng, World, WorldEvent } from '@datas-world/engine';
import type { Catalog } from '../catalogs/schema.ts';
import type { ActivityAttrs, LeisureParams } from './params.ts';
import { offerOf, reachOf, selectActivities } from './select.ts';

const DAY = 1440;
const YEAR = 365 * DAY;
const WEEKS_PER_MONTH = 4.33;
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Ingreso mensual del hogar para el presupuesto (aproximado hasta la economía de la 015). */
function householdIncome(world: World, householdId: EntityId, P: LeisureParams): number {
  let total = 0;
  for (const m of world.households.get(householdId)!.memberIds) {
    const occ = world.citizens.get(m)!.occupation;
    if (occ?.kind === 'formal') {
      const pos = world.organizations.get(occ.orgId)!.positions.find((p) => p.id === occ.positionId)!;
      total += pos.wagePeriod === 'month' ? pos.wage : pos.wage * 26;
    } else if (occ?.kind === 'informal' || occ?.kind === 'independent') total += P.incomeProxy.informal! * P.minimumWage;
    else if (world.components.u8['demo.pensioned']![idNumber(m)] === 1) total += P.incomeProxy.pension! * P.minimumWage;
  }
  return total;
}

/** Situación para el tiempo libre (R-005). */
function statusOf(world: World, id: EntityId, age: number): string {
  const occ = world.citizens.get(id)!.occupation;
  if (age < 15 || !occ) return 'minor';
  if (occ.kind !== 'none') return 'employed';
  return occ.reason === 'minor' ? 'minor' : occ.reason;
}

export function generateLeisure(world: World, livingIds: readonly EntityId[], catalog: Catalog, P: LeisureParams, rng: Rng): WorldEvent[] {
  const c = world.components;
  const offer = offerOf(world);
  const attrs = new Map(catalog.entries.map((e) => [e.key, { name: e.name, a: e.attrs as unknown as ActivityAttrs }]));
  const chosen = selectActivities(world, livingIds, catalog, P, offer, rng);
  const localPlace = (kinds: string[]) =>
    [...world.places.values()].filter((p) => p.rect && kinds.includes(p.kind)).sort((x, y) => (x.id < y.id ? -1 : 1))[0];
  const events: WorldEvent[] = [];

  for (const [id, list] of chosen) {
    const row = idNumber(id);
    const birth = c.i32['demo.birthMinute']![row]!;
    const years = ageInYears(birth, world.now, world.config.epoch);
    const person = world.citizens.get(id)!;
    const best = Math.max(...list.map((x) => x.score));
    const interests: (LeisureInterest & { paid: boolean; cost: number; hours: number })[] = list.map((x) => {
      const { a } = attrs.get(x.key)!;
      const affinity = Math.round((0.3 + (0.7 * x.score) / best) * 100) / 100;
      const regional = reachOf(a, offer) === 'regional';
      const perMonth = a.freq * (0.5 + affinity) * (regional ? P.regionalFrequency : 1);
      const level = P.costByLevel[a.cost] ?? 0;
      return {
        key: x.key,
        affinity,
        perMonth,
        since: 0,
        paid: level > 0 || regional,
        // Coste por vez: el nivel (o la mensualidad repartida) más el viaje de ida y vuelta si es regional.
        cost: (a.costPer === 'month' ? level / a.freq : level) + (regional ? 2 * P.travelCost : 0),
        hours: a.hours,
      };
    });

    // R-005: el tiempo semanal no pasa del tiempo libre de su situación (80 % si cuida menores).
    const household = world.households.get(person.householdId!)!;
    const caregiver = household.caregiverIds?.includes(id) ?? false;
    const free = (P.freeHoursWeek[statusOf(world, id, years)] ?? 25) * (caregiver ? 0.8 : 1);
    const weekly = interests.reduce((s, x) => s + (x.perMonth * x.hours) / WEEKS_PER_MONTH, 0);
    if (weekly > free) for (const x of interests) x.perMonth *= free / weekly;

    // R-002: el gasto esperado no pasa de la parte del ingreso del hogar que le toca.
    const budget = leisureBudget(world, id, P);
    const spend = interests.reduce((s, x) => s + x.perMonth * x.cost, 0);
    if (spend > budget) for (const x of interests) if (x.paid) x.perMonth *= budget / spend;

    const r = rng.fork('gen:leisure/since').fork(id);
    person.leisure = interests.map((x) => {
      const { a, name } = attrs.get(x.key)!;
      const minAge = Math.max(a.ageRange[0], 0);
      const start = Math.max(minAge, years - r.int(0, Math.max(0, Math.min(years - minAge, 30))));
      const since = Math.min(Math.max(birth + start * YEAR + r.int(0, 364) * DAY, birth + DAY), -DAY);
      const place = localPlace(a.placeKinds);
      const causes: CauseRef[] = [{ state: 'personalidad', entity: id, weight: 0.5 }];
      if (place) causes.push({ state: 'oferta', entity: place.id, weight: 0.3 });
      const e = makeEvent(world.counters, since, {
        type: 'LEISURE_TAKEN_UP',
        payload: { citizenId: id, activity: x.key, name },
        participants: [{ id, role: 'aficionado' }],
        causes,
      });
      events.push(e);
      person.backstory?.push(e.id);
      // Hacia abajo, para no pasar del presupuesto ni del tiempo por el redondeo.
      return { key: x.key, affinity: x.affinity, perMonth: Math.min(30, Math.floor(x.perMonth * 10) / 10), since };
    });
  }
  return events;
}

/** Gasto mensual esperado de una ficha, en COP (para informes y pruebas de R-002). */
export function expectedSpend(world: World, id: EntityId, catalog: Catalog, P: LeisureParams): number {
  const offer = offerOf(world);
  let s = 0;
  for (const x of world.citizens.get(id)!.leisure ?? []) {
    const a = catalog.entries.find((e) => e.key === x.key)!.attrs as unknown as ActivityAttrs;
    const level = P.costByLevel[a.cost] ?? 0;
    const regional = reachOf(a, offer) === 'regional';
    const cost = (a.costPer === 'month' ? level / a.freq : level) + (regional ? 2 * P.travelCost : 0);
    s += x.perMonth * cost;
  }
  return round1(s);
}

/** Presupuesto mensual de esparcimiento de una persona (R-002). */
export function leisureBudget(world: World, id: EntityId, P: LeisureParams): number {
  const household = world.households.get(world.citizens.get(id)!.householdId!)!;
  const stratum = world.places.get(world.places.get(household.dwellingId)!.districtId!)!.stratum!;
  return ((P.budgetShare[String(stratum)] ?? 0.03) * householdIncome(world, household.id, P)) / household.memberIds.length;
}
