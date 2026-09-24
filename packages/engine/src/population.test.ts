import { describe, expect, it } from 'vitest';
import { MINUTES_PER_DAY, ageInYears, daysFromCivil } from './calendar.ts';
import { emptyCounters } from './ids.ts';
import { eventText, makeEvent } from './events.ts';
import { deserializeWorld, serializeWorld, stateHash } from './serialize.ts';
import { testConfig } from './testing.ts';
import { addHousehold, addPerson, addPlace, completeHousehold, createWorld } from './world.ts';

const EPOCH = '2026-01-01T00:00';
/** Minuto (relativo al epoch 2026-01-01) de una fecha civil. */
const at = (y: number, m: number, d: number) => (daysFromCivil(y, m, d) - daysFromCivil(2026, 1, 1)) * MINUTES_PER_DAY;

describe('ageInYears (spec 007)', () => {
  it('cuenta años cumplidos por calendario, también antes del epoch y con bisiestos', () => {
    expect(ageInYears(at(1990, 5, 20), 0, EPOCH)).toBe(35);
    expect(ageInYears(at(1990, 1, 1), 0, EPOCH)).toBe(36);
    expect(ageInYears(at(1990, 1, 2), 0, EPOCH)).toBe(35);
    expect(ageInYears(at(2000, 2, 29), at(2025, 2, 28), EPOCH)).toBe(24);
    expect(ageInYears(at(2000, 2, 29), at(2025, 3, 1), EPOCH)).toBe(25);
    expect(ageInYears(at(1900, 6, 1), at(1950, 6, 1), EPOCH)).toBe(50);
  });
});

describe('hogares y personas (specs 007, 008)', () => {
  function setup() {
    const { world } = createWorld(testConfig({ epoch: EPOCH }));
    const dwelling = addPlace(world, { kind: 'vivienda.unidad', name: 'Vivienda 01-A' });
    const h = addHousehold(world, { template: 'couple_kids', dwellingId: dwelling });
    const person = (given: string, sex: 'F' | 'M') =>
      addPerson(world, { name: { given, family: ['Rojas', 'Gómez'] }, sex, birthplace: 'co.tunja', householdId: h });
    return { world, dwelling, h, person };
  }

  it('crea el hogar, añade miembros y cierra su composición', () => {
    const { world, h, person } = setup();
    const a = person('Laura', 'F');
    const b = person('Mateo', 'M');
    completeHousehold(world, h, { headId: a, kinship: [{ from: a, to: b, kind: 'parent' }], caregiverIds: [a] });
    expect(world.households.get(h)).toMatchObject({ memberIds: [a, b], headId: a, caregiverIds: [a] });
    expect(world.citizens.get(a)).toMatchObject({ sex: 'F', householdId: h, backstory: [] });
    expect(world.components.u8.active![2]).toBe(1);
    expect(stateHash(deserializeWorld(serializeWorld(world)))).toBe(stateHash(world));
  });

  it('rechaza viviendas ocupadas o inexistentes, datos incompletos y parentescos fuera del hogar', () => {
    const { world, dwelling, h, person } = setup();
    expect(() => addHousehold(world, { template: 'single', dwellingId: dwelling })).toThrow(/ya tiene/);
    expect(() => addHousehold(world, { template: 'single', dwellingId: 'PLC-0099' })).toThrow(/No existe/);
    expect(() =>
      addPerson(world, { name: { given: ' ', family: ['A', 'B'] }, sex: 'F', birthplace: 'x', householdId: h }),
    ).toThrow(/Nombre/);
    const a = person('Laura', 'F');
    expect(() => completeHousehold(world, h, { headId: 'CIT-000099', kinship: [], caregiverIds: [] })).toThrow(
      /no es miembro/,
    );
    expect(() =>
      completeHousehold(world, h, { headId: a, kinship: [{ from: a, to: a, kind: 'parent' }], caregiverIds: [] }),
    ).toThrow(/Parentesco/);
  });
});

describe('eventos de la trayectoria previa (catálogo, spec 014)', () => {
  it('se crean con fecha anterior al epoch y con texto en español', () => {
    const c = emptyCounters();
    const cause = [{ state: 'backstory', weight: 1 }];
    const e1 = makeEvent(c, at(2010, 3, 1), {
      type: 'HOUSEHOLD_FORMED',
      payload: { householdId: 'HOU-0001', template: 'couple', members: ['CIT-000001', 'CIT-000002'] },
      causes: cause,
    });
    const e2 = makeEvent(c, at(2012, 12, 1), {
      type: 'STUDIES_COMPLETED',
      payload: { citizenId: 'CIT-000001', level: 6, levelName: 'Universitaria' },
      causes: cause,
    });
    const e3 = makeEvent(c, at(1998, 1, 1), {
      type: 'CHILDHOOD_EVENT',
      payload: { citizenId: 'CIT-000001', kind: 'infancia.campo', text: 'tuvo una infancia tranquila en el campo' },
      causes: cause,
    });
    expect(e1.at).toBeLessThan(0);
    expect(eventText(e1)).toBe('Se forma el hogar HOU-0001 (2 personas).');
    expect(eventText(e2)).toContain('Universitaria');
    expect(eventText(e3)).toContain('infancia tranquila');
    expect(() =>
      makeEvent(c, 0, { type: 'STUDIES_COMPLETED', payload: { citizenId: 'CIT-1' }, causes: cause }),
    ).toThrow(/payload/);
  });
});
