// Supervisión de menores (spec 011 v0.3, R-007 y R-008, CA-006): un menor de 12 años solo elige tiempo libre fuera de
// casa donde ya está un adulto de su hogar y, si está fuera sin adulto, vuelve a casa; de 12 a 17 años sale de día,
// hasta el toque de queda y como mucho dos horas seguidas.
import { describe, expect, it } from 'vitest';
import { defineColumn } from '../components.ts';
import { setOccupation } from '../employment.ts';
import { TILE, createGeoMap, setTile } from '../geo.ts';
import { idNumber } from '../ids.ts';
import { initMobility } from '../mobility/columns.ts';
import { mobilityParams } from '../mobility/params.ts';
import { initNeeds } from '../needs/columns.ts';
import { createRng } from '../rng.ts';
import { initRoutines } from '../routines/columns.ts';
import { dayInfo } from '../routines/day.ts';
import { TEST_PROFILE, testConfig } from '../testing.ts';
import { addHousehold, addPerson, addPlace, createWorld } from '../world.ts';
import type { LeisureInterest, World } from '../world.ts';
import { defineDecisionColumns } from './columns.ts';
import type { LeisureTable } from './columns.ts';
import { buildOptions, freeUntil } from './options.ts';
import { MINOR_CURFEW, MINOR_OUTING_MAX_H, ageOf, bandOf, guardianAt, teenStayLimit } from './supervision.ts';

const DAY = 1440;
const P = mobilityParams(TEST_PROFILE, '2027-02-01');
const TABLE: LeisureTable = {
  'deporte.futbol': { name: 'Jugar fútbol', placeKinds: ['espacio_publico.parque'], atHome: false, cost: 0, hours: 4, group: 'ambos', physical: 1 },
  'entretenimiento.tv_series': { name: 'Ver series', placeKinds: [], atHome: true, cost: 0, hours: 2, group: 'solo', physical: 0 },
};
const interest = (key: string): LeisureInterest => ({ key, affinity: 1, perMonth: 30, since: -DAY });

/** Una casa con un menor de `age` años y un adulto, y un parque a pocos pasos. */
function house(age: number) {
  const { world } = createWorld(testConfig({ epoch: '2027-02-01T00:00', initialCapabilities: ['clock', 'needs', 'routines', 'mobility'], profile: TEST_PROFILE, seed: 1 }));
  const geo = createGeoMap(60, 3, 8);
  for (let x = 0; x < 60; x++) setTile(geo, x, 1, TILE.road);
  world.geo = geo;
  const c = world.components;
  defineColumn(c, 'i32', 'demo.birthMinute', 0);
  defineColumn(c, 'i32', 'money', 1_000_000);
  defineColumn(c, 'u8', 'demo.student', 0);
  defineColumn(c, 'u8', 'health.sleepHours', 8);
  for (const col of ['pers.neuroticism', 'pers.extraversion', 'pers.resilience', 'pers.conscientiousness', 'pers.impulsivity']) defineColumn(c, 'f32', col, 0.5);
  const park = addPlace(world, { kind: 'espacio_publico.parque', name: 'Parque', door: { x: 30, y: 1 }, openingHours: '24h' });
  const dwelling = addPlace(world, { kind: 'vivienda.unidad', name: 'Casa', door: { x: 5, y: 1 }, openingHours: null });
  const h = addHousehold(world, { template: 'single', dwellingId: dwelling });
  const mk = (years: number) => {
    const id = addPerson(world, { name: { given: 'Ana', family: ['Rojas', 'Gómez'] }, sex: 'F', birthplace: 'co.cali', householdId: h });
    const row = idNumber(id);
    c.i32['demo.birthMinute']![row] = Math.round(-(years + 0.5) * 365.25 * DAY);
    setOccupation(world, id, { kind: 'none', reason: 'other_inactive', since: 0 });
    world.citizens.get(id)!.leisure = [interest('deporte.futbol'), interest('entretenimiento.tv_series')];
    return row;
  };
  const kid = mk(age);
  const adult = mk(35);
  const rng = createRng(1);
  initNeeds(world, rng);
  initRoutines(world, rng);
  initMobility(world);
  defineDecisionColumns(world);
  for (const r of [kid, adult]) c.f32['need.fun']![r] = 0;
  return { world, kid, adult, park: idNumber(park), home: idNumber(dwelling) };
}

/** Las opciones del menor en el minuto `at`, estando en el lugar `here`. */
function optionsAt(world: World, row: number, at: number, here: number, home: number) {
  world.now = at;
  world.components.i32['loc.place']![row] = here;
  const day = (m: number) => dayInfo(world, m);
  return buildOptions({ view: world, row, now: at, here, home, cap: freeUntil(world, row, at, day), day, occ: new Map(), P, table: TABLE }, createRng(2));
}

const outings = (opts: ReturnType<typeof optionsAt>, park: number) => opts.filter((o) => o.action.kind === 'leisure' && o.action.target === `PLC-${String(park).padStart(4, '0')}`);

describe('011 R-007: supervisión de menores', () => {
  it('los tramos de edad: niño (< 12), adolescente (12 a 17) y adulto', () => {
    expect(['0', '11.9', '12', '17.9', '18', '60'].map((a) => bandOf(Number(a)))).toEqual(['child', 'child', 'teen', 'teen', 'adult', 'adult']);
    const { world, kid } = house(8);
    expect(Math.floor(ageOf(world, kid, 0))).toBe(8);
  });

  it('CA-006: un niño de 8 años no sale solo al parque; con un adulto de su hogar allí, sí', () => {
    const { world, kid, adult, park, home } = house(8);
    world.components.i32['loc.place']![adult] = home;
    expect(guardianAt(world, kid, park, 15 * 60)).toBe(false);
    expect(outings(optionsAt(world, kid, 15 * 60, home, home), park)).toHaveLength(0);
    // La tele en casa sí es una opción: no se queda sin nada que hacer.
    expect(optionsAt(world, kid, 15 * 60, home, home).some((o) => o.action.kind === 'leisure')).toBe(true);
    world.components.i32['loc.place']![adult] = park;
    expect(guardianAt(world, kid, park, 15 * 60)).toBe(true);
    expect(outings(optionsAt(world, kid, 15 * 60, home, home), park).length).toBeGreaterThan(0);
  });

  it('un adulto que va de viaje no cuenta como acompañante', () => {
    const { world, kid, adult, park } = house(8);
    world.components.i32['loc.place']![adult] = park;
    world.components.i32['trip.to']![adult] = park;
    expect(guardianAt(world, kid, park, 15 * 60)).toBe(false);
  });

  it('CA-006: un niño que está solo fuera de casa vuelve a casa', () => {
    const { world, kid, adult, park, home } = house(8);
    world.components.i32['loc.place']![adult] = home;
    const back = optionsAt(world, kid, 15 * 60, park, home).filter((o) => o.sources.some((s) => s.ref === 'rutina.menor_en_casa'));
    expect(back).toHaveLength(1);
    expect(back[0]!.action.target).toBe(`PLC-${String(home).padStart(4, '0')}`);
    // Acompañado por un adulto del hogar, no hace falta.
    world.components.i32['loc.place']![adult] = park;
    expect(optionsAt(world, kid, 15 * 60, park, home).some((o) => o.sources.some((s) => s.ref === 'rutina.menor_en_casa'))).toBe(false);
  });

  it('de 12 a 17 años sale de día y como mucho dos horas; después del toque de queda no sale', () => {
    expect(MINOR_OUTING_MAX_H).toBe(2);
    expect(teenStayLimit(15 * 60, 10, 10)).toBe(120);
    expect(teenStayLimit(19 * 60, 10, 10)).toBe(MINOR_CURFEW - 19 * 60 - 20); // el toque de queda manda
    expect(teenStayLimit(19 * 60 + 55, 10, 10)).toBeLessThan(0);
    const { world, kid, adult, park, home } = house(15);
    world.components.i32['loc.place']![adult] = home;
    const day = outings(optionsAt(world, kid, 15 * 60, home, home), park);
    expect(day.length).toBeGreaterThan(0);
    for (const o of day) expect((o.action.params as { until: number }).until - 15 * 60).toBeLessThanOrEqual(MINOR_OUTING_MAX_H * 60 + 30);
    expect(outings(optionsAt(world, kid, 19 * 60 + 40, home, home), park)).toHaveLength(0);
  });

  it('un adulto no tiene estas restricciones', () => {
    const { world, adult, park, home } = house(30);
    expect(outings(optionsAt(world, adult, 21 * 60, home, home), park).length).toBeGreaterThan(0);
  });
});
