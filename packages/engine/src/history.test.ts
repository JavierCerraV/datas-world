import { describe, expect, it } from 'vitest';
import { addAncestor, setFoundedAt, setParents } from './history.ts';
import { deserializeWorld, serializeWorld, stateHash } from './serialize.ts';
import { testConfig } from './testing.ts';
import { addHousehold, addPerson, addPlace, createWorld } from './world.ts';

describe('historia generada en el motor (spec 030)', () => {
  function setup() {
    const { world } = createWorld(testConfig());
    const dwelling = addPlace(world, { kind: 'vivienda.unidad', name: 'Vivienda 01-A' });
    const h = addHousehold(world, { template: 'single', dwellingId: dwelling });
    const laura = addPerson(world, { name: { given: 'Laura', family: ['Rojas', 'Gómez'] }, sex: 'F', birthplace: 'co.tunja', householdId: h });
    return { world, laura, dwelling };
  }

  it('un antepasado existe fuera del mundo: inactivo, sin hogar y con su fila de componentes apagada', () => {
    const { world } = setup();
    const a = addAncestor(world, { name: { given: 'Rosa', family: ['Gómez', 'Parra'] }, sex: 'F', birthplace: 'rural.campo' });
    expect(world.citizens.get(a)).toMatchObject({ status: 'inactive', ancestor: true, backstory: [] });
    expect(world.citizens.get(a)!.householdId).toBeUndefined();
    expect(world.components.u8.active![2]).toBe(0);
    expect(stateHash(deserializeWorld(serializeWorld(world)))).toBe(stateHash(world));
  });

  it('setParents exige madre F y padre M existentes y distintos del hijo', () => {
    const { world, laura } = setup();
    const mom = addAncestor(world, { name: { given: 'Rosa', family: ['Gómez', 'Parra'] }, sex: 'F', birthplace: 'rural.campo' });
    const dad = addAncestor(world, { name: { given: 'Luis', family: ['Rojas', 'Díaz'] }, sex: 'M', birthplace: 'co.cali' });
    setParents(world, laura, mom, dad);
    expect(world.citizens.get(laura)).toMatchObject({ motherId: mom, fatherId: dad });
    expect(() => setParents(world, laura, dad)).toThrow(/debe ser F/);
    expect(() => setParents(world, laura, undefined, 'CIT-000099')).toThrow(/inválido/);
    expect(() => setParents(world, laura, laura)).toThrow(/inválido/);
  });

  it('setFoundedAt solo para lugares u organizaciones y antes del presente', () => {
    const { world, laura, dwelling } = setup();
    setFoundedAt(world, dwelling, -1000);
    expect(world.places.get(dwelling)!.foundedAt).toBe(-1000);
    expect(() => setFoundedAt(world, dwelling, 10)).toThrow(/inválida/);
    expect(() => setFoundedAt(world, laura, -10)).toThrow(/Solo lugares/);
  });
});
