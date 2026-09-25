import { describe, expect, it } from 'vitest';
import { GIFT_SENTIMENTAL, addObject, loseObject, objectsOf, transferObject } from './objects.ts';
import { deserializeWorld, serializeWorld, stateHash } from './serialize.ts';
import { testConfig } from './testing.ts';
import { addHousehold, addPerson, addPlace, createWorld } from './world.ts';

function family() {
  const { world } = createWorld(testConfig());
  const dwelling = addPlace(world, { kind: 'vivienda.unidad', name: 'Vivienda 01-A' });
  const h = addHousehold(world, { template: 'couple_kids', dwellingId: dwelling });
  const person = (given: string) => addPerson(world, { name: { given, family: ['Rojas', 'Gómez'] }, sex: 'F', birthplace: 'co.cali', householdId: h });
  const mother = person('Marta');
  const son = person('Juan');
  const neighbourDwelling = addPlace(world, { kind: 'vivienda.unidad', name: 'Vivienda 01-B' });
  const h2 = addHousehold(world, { template: 'single', dwellingId: neighbourDwelling });
  const neighbour = addPerson(world, { name: { given: 'Luis', family: ['Pérez', 'Díaz'] }, sex: 'M', birthplace: 'co.cali', householdId: h2 });
  world.citizens.get(son)!.motherId = mother;
  return { world, mother, son, neighbour };
}

describe('spec 005 (M2): objetos en la vida diaria', () => {
  it('CA-004: un reloj regalado por la madre vale ≥ 0,6 para el hijo y su historia incluye OBJECT_GIFTED', () => {
    const { world, mother, son } = family();
    const watch = addObject(world, { kind: 'accesorio.reloj', name: 'un reloj', ownerId: mother, marketValue: 250_000, condition: 1, sentimental: {} });
    const e = transferObject(world, watch, { how: 'gift', from: mother, to: son, occasion: 'cumpleaños' }, [{ state: 'cumpleanos', entity: son, weight: 1 }]);
    const o = world.objects.get(watch)!;
    expect(e.type).toBe('OBJECT_GIFTED');
    expect(o.ownerId).toBe(son);
    expect(o.sentimental[son]).toBeGreaterThanOrEqual(0.6);
    expect(o.sentimental[son]).toBe(GIFT_SENTIMENTAL.parent);
    expect(o.historyEventIds).toContain(e.id);
    expect(e.causes.length).toBeGreaterThan(0);
  });

  it('el valor emocional del regalo depende de quién lo da y nunca baja', () => {
    const { world, mother, son, neighbour } = family();
    const gift = addObject(world, { kind: 'recuerdo.fotografia', name: 'una foto', ownerId: neighbour, marketValue: 300_000, condition: 1, sentimental: {} });
    transferObject(world, gift, { how: 'gift', from: neighbour, to: son, occasion: 'visita' }, [{ state: 'visita', weight: 1 }]);
    expect(world.objects.get(gift)!.sentimental[son]).toBe(GIFT_SENTIMENTAL.other);
    const g2 = addObject(world, { kind: 'accesorio.reloj', name: 'un reloj', ownerId: son, marketValue: 300_000, condition: 1, sentimental: { [son]: 0.9 } });
    transferObject(world, g2, { how: 'gift', from: son, to: mother, occasion: 'día de la madre' }, [{ state: 'fecha', weight: 1 }]);
    expect(world.objects.get(g2)!.sentimental[mother]).toBe(GIFT_SENTIMENTAL.household);
    expect(world.objects.get(g2)!.sentimental[son]).toBe(0.9); // el de quien lo dio no cambia
    expect(() => transferObject(world, g2, { how: 'gift', from: son, to: neighbour, occasion: 'x' }, [])).toThrow(/no es dueño/);
  });

  it('CA-005: un objeto vendido o perdido nunca desaparece de la base: solo cambian dueño, status y fate', () => {
    const { world, mother, son } = family();
    const bike = addObject(world, { kind: 'transporte.bicicleta', name: 'una bicicleta', ownerId: son, marketValue: 480_000, condition: 0.8, sentimental: {} });
    const phone = addObject(world, { kind: 'tecnologia.telefono', name: 'un teléfono', ownerId: mother, marketValue: 650_000, condition: 1, sentimental: {} });
    const sold = transferObject(world, bike, { how: 'sale', from: son, to: mother, price: 300_000 }, [{ state: 'dificultad_economica', weight: 1 }]);
    const lost = loseObject(world, phone, 'lost', [{ state: 'distraccion', weight: 1 }]);
    expect(world.objects.size).toBe(2);
    expect(world.objects.get(bike)).toMatchObject({ ownerId: mother, status: 'active', fate: 'owned', marketValue: 300_000 });
    expect(world.objects.get(phone)).toMatchObject({ status: 'inactive', fate: 'lost' });
    expect(world.objects.get(phone)!.historyEventIds).toEqual([lost.id]);
    expect(world.objects.get(bike)!.historyEventIds).toEqual([sold.id]);
    expect(objectsOf(world, mother).map((o) => o.id)).toEqual([bike]); // el perdido ya no se cuenta como suyo…
    const again = deserializeWorld(serializeWorld(world));
    expect(again.objects.get(phone)).toMatchObject({ status: 'inactive', fate: 'lost' }); // …pero sigue en la base
    expect(stateHash(again)).toBe(stateHash(world));
    expect(() => loseObject(world, phone, 'lost', [])).toThrow(/no está disponible/);
  });
});
