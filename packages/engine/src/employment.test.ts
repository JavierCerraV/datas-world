import { describe, expect, it } from 'vitest';
import { hire, setOccupation } from './employment.ts';
import { addObject, objectsOf, recordObjectEvent } from './objects.ts';
import { deserializeWorld, serializeWorld, stateHash } from './serialize.ts';
import { testConfig } from './testing.ts';
import { addHousehold, addOrganization, addPerson, addPlace, createWorld } from './world.ts';

function setup() {
  const { world } = createWorld(testConfig());
  const office = addPlace(world, { kind: 'servicios.oficina', name: 'Oficinas' });
  const dwelling = addPlace(world, { kind: 'vivienda.unidad', name: 'Vivienda 01-A' });
  const h = addHousehold(world, { template: 'couple', dwellingId: dwelling });
  const person = (given: string) =>
    addPerson(world, { name: { given, family: ['Rojas', 'Gómez'] }, sex: 'F', birthplace: 'co.cali', householdId: h });
  const shift = { days: 'mon-fri' as const, start: 420, end: 984, lunch: 60 };
  const pos = {
    title: 'Oficinista',
    level: 0,
    occupation: 'ciuo.4110',
    wage: 1_750_905,
    wagePeriod: 'month' as const,
    shift,
  };
  const org = addOrganization(world, {
    name: 'Oficinas',
    sector: 'ciiu.7020',
    placeIds: [office],
    positions: [
      { ...pos, level: 1 },
      { ...pos, supervisor: 0 },
    ],
    culture: { strictness: 0.5, warmth: 0.5, stability: 0.5 },
  });
  return { world, org, h, person };
}

describe('ocupación (spec 006)', () => {
  it('hire ocupa un puesto libre y lo refleja en la persona y en el puesto', () => {
    const { world, org, person } = setup();
    const a = person('Laura');
    hire(world, a, org, `${org}/P01`);
    expect(world.citizens.get(a)!.occupation).toEqual({ kind: 'formal', orgId: org, positionId: `${org}/P01` });
    expect(world.organizations.get(org)!.positions[0]!.holderId).toBe(a);
    expect(stateHash(deserializeWorld(serializeWorld(world)))).toBe(stateHash(world));
  });

  it('INV-002: un puesto, un titular; una persona, un puesto; los inexistentes fallan', () => {
    const { world, org, person } = setup();
    const a = person('Laura');
    const b = person('Diana');
    hire(world, a, org, `${org}/P01`);
    expect(() => hire(world, b, org, `${org}/P01`)).toThrow(/ya lo ocupa/);
    expect(() => hire(world, a, org, `${org}/P02`)).toThrow(/ya ocupa/);
    expect(() => hire(world, b, org, `${org}/P09`)).toThrow(/no tiene el puesto/);
    expect(() => hire(world, b, 'ORG-0099', `${org}/P02`)).toThrow(/No existe/);
    expect(() => setOccupation(world, a, { kind: 'informal', trade: 'oficio.taxi' })).toThrow(/puesto formal/);
  });

  it('setOccupation asigna trabajo informal o ninguna ocupación con su motivo', () => {
    const { world, person } = setup();
    const a = person('Laura');
    setOccupation(world, a, { kind: 'informal', trade: 'oficio.venta_ambulante' });
    expect(world.citizens.get(a)!.occupation).toEqual({ kind: 'informal', trade: 'oficio.venta_ambulante' });
    setOccupation(world, a, { kind: 'none', reason: 'unemployed', since: -30 * 1440 });
    expect(world.citizens.get(a)!.occupation).toMatchObject({ kind: 'none', reason: 'unemployed' });
    expect(() => setOccupation(world, a, { kind: 'independent', trade: ' ' })).toThrow(/oficio/);
  });
});

describe('objetos (spec 005)', () => {
  it('un objeto es de una persona o de su hogar; objectsOf devuelve ambos (CA-003)', () => {
    const { world, h, person } = setup();
    const a = person('Laura');
    const phone = addObject(world, {
      kind: 'tecnologia.telefono',
      name: 'un teléfono',
      ownerId: a,
      marketValue: 650_000,
      condition: 0.8,
      sentimental: {},
    });
    const car = addObject(world, {
      kind: 'transporte.carro',
      name: 'el carro de la casa',
      ownerId: h,
      marketValue: 45_000_000,
      condition: 0.7,
      sentimental: { [a]: 0 },
    });
    recordObjectEvent(world, phone, 'EVT-00000000001');
    expect(objectsOf(world, a).map((o) => o.id)).toEqual([phone, car]);
    expect(world.objects.get(phone)).toMatchObject({
      fate: 'owned',
      status: 'active',
      historyEventIds: ['EVT-00000000001'],
    });
    expect(stateHash(deserializeWorld(serializeWorld(world)))).toBe(stateHash(world));
  });

  it('INV-002: rechaza dueños inválidos, valores fuera de rango y tipos mal formados', () => {
    const { world, person } = setup();
    const a = person('Laura');
    const ok = { kind: 'tecnologia.telefono', name: 'x', ownerId: a, marketValue: 1, condition: 0.5, sentimental: {} };
    expect(() => addObject(world, { ...ok, ownerId: 'PLC-0001' })).toThrow(/Dueño/);
    expect(() => addObject(world, { ...ok, ownerId: 'CIT-000099' })).toThrow(/Dueño/);
    expect(() => addObject(world, { ...ok, marketValue: -1 })).toThrow(/mercado/);
    expect(() => addObject(world, { ...ok, condition: 2 })).toThrow(/condition/);
    expect(() => addObject(world, { ...ok, sentimental: { [a]: 1.5 } })).toThrow(/emocional/);
    expect(() => addObject(world, { ...ok, kind: 'Teléfono' })).toThrow(/inválido/);
  });
});
