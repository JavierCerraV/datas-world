import { describe, expect, it } from 'vitest';
import {
  TILE,
  createGeoMap,
  doorDistanceMatrix,
  geoFromData,
  geoToData,
  roadDistances,
  setTile,
  tileAt,
} from './geo.ts';
import { deserializeWorld, serializeWorld, stateHash } from './serialize.ts';
import { testConfig } from './testing.ts';
import { addPlace, createWorld } from './world.ts';

/** Mapa 7×5 con una calle en L y un tramo aislado:
 *  RRRRR..
 *  ....R..
 *  ....R.R
 *  ....R..
 *  ....RRR
 */
function lMap() {
  const m = createGeoMap(7, 5, 8);
  for (let x = 0; x < 5; x++) setTile(m, x, 0, TILE.road);
  for (let y = 0; y < 5; y++) setTile(m, 4, y, TILE.road);
  setTile(m, 5, 4, TILE.road);
  setTile(m, 6, 4, TILE.road);
  setTile(m, 6, 2, TILE.road); // aislado
  return m;
}

describe('mapa y distancias por calle (spec 003 R-002)', () => {
  it('cuenta los pasos solo por calle y marca -1 lo inalcanzable', () => {
    const m = lMap();
    const d = roadDistances(m, { x: 0, y: 0 });
    expect(d[4 * 7 + 6]).toBe(10); // (0,0) → (4,0) → (4,4) → (6,4)
    expect(d[2 * 7 + 6]).toBe(-1); // tramo aislado
    expect(d[1 * 7 + 0]).toBe(-1); // pasto
    expect(() => roadDistances(m, { x: 1, y: 1 })).toThrow(/no es una calle/);
  });

  it('la matriz entre puertas es simétrica y ≥ la distancia de Manhattan', () => {
    const m = lMap();
    const doors = [
      { x: 0, y: 0 },
      { x: 4, y: 2 },
      { x: 6, y: 4 },
    ];
    const mat = doorDistanceMatrix(m, doors);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(mat[i * 3 + j]).toBe(mat[j * 3 + i]);
        const man = Math.abs(doors[i]!.x - doors[j]!.x) + Math.abs(doors[i]!.y - doors[j]!.y);
        expect(mat[i * 3 + j]!).toBeGreaterThanOrEqual(man);
      }
    }
  });

  it('valida tamaño, coordenadas y la forma guardada', () => {
    expect(() => createGeoMap(0, 5, 8)).toThrow(/inválido/);
    const m = lMap();
    expect(() => tileAt(m, 7, 0)).toThrow(/Fuera/);
    expect(geoFromData(geoToData(m))).toEqual(m);
    expect(() => geoFromData({ ...geoToData(m), tiles: [1] })).toThrow(/tiles/);
  });
});

describe('addPlace y mapa en el mundo (specs 003, 004)', () => {
  it('añade lugares validados y el mapa entra en el hash y sobrevive a la instantánea', () => {
    const { world } = createWorld(testConfig());
    const h0 = stateHash(world);
    world.geo = lMap();
    expect(stateHash(world)).not.toBe(h0);
    const dep = addPlace(world, { kind: 'territorio.departamento', name: 'Depto', divipola: '00' });
    const barrio = addPlace(world, { kind: 'territorio.barrio', name: 'B', parentId: dep, stratum: 3, safety: 0.6 });
    const shop = addPlace(world, {
      kind: 'comercio.tienda_barrio',
      name: 'Tienda',
      districtId: barrio,
      rect: { x: 0, y: 1, w: 3, h: 2 },
      door: { x: 1, y: 0 },
    });
    expect(world.places.get(shop)).toMatchObject({ id: 'PLC-0003', status: 'active', districtId: barrio });
    const back = deserializeWorld(serializeWorld(world));
    expect(stateHash(back)).toBe(stateHash(world));
    expect(back.geo!.tiles).toEqual(world.geo.tiles);
  });

  it('rechaza padres inexistentes, estratos fuera de 1–6 y rectángulos fuera del mapa', () => {
    const { world } = createWorld(testConfig());
    world.geo = lMap();
    expect(() => addPlace(world, { kind: 'territorio.barrio', name: 'B', parentId: 'PLC-0099' })).toThrow(/No existe/);
    expect(() => addPlace(world, { kind: 'territorio.barrio', name: 'B', stratum: 7 })).toThrow(/Estrato/);
    expect(() => addPlace(world, { kind: 'x', name: 'X', rect: { x: 5, y: 0, w: 3, h: 1 } })).toThrow(/fuera del mapa/);
    expect(() => addPlace(world, { kind: 'Mal.Tipo', name: 'X' })).toThrow(/inválido/);
  });

  it('valida capacidad y horario (spec 004); admite horario privado y 24 h', () => {
    const { world } = createWorld(testConfig());
    const ok = { kind: 'ocio.cafe', name: 'Café' };
    expect(() => addPlace(world, { ...ok, capacity: 0 })).toThrow(/Capacidad/);
    expect(() => addPlace(world, { ...ok, openingHours: { days: 'all', open: 900, close: 420 } })).toThrow(/Horario/);
    expect(() => addPlace(world, { ...ok, openingHours: { days: 'all', open: 0, close: 1900 } })).toThrow(/Horario/);
    expect(() => addPlace(world, { ...ok, openingHours: { days: 'all', open: 1440, close: 1500 } })).toThrow(/Horario/);
    // 033 R-004: un bar puede cerrar después de medianoche (1560 = 02:00 del día siguiente).
    addPlace(world, { kind: 'ocio.bar', name: 'Bar', openingHours: { days: 'all', open: 960, close: 1560 } });
    // Lugar regional (033): con viaje y sin rectángulo.
    addPlace(world, { kind: 'ocio.cine', name: 'Cine', travel: { minutes: 60, cost: 12000 } });
    expect(() => addPlace(world, { kind: 'ocio.cine', name: 'C', travel: { minutes: 0, cost: 1 } })).toThrow(/Viaje/);
    const id = addPlace(world, { ...ok, capacity: 12, openingHours: { days: 'mon-sat', open: 420, close: 1260 } });
    expect(world.places.get(id)).toMatchObject({
      capacity: 12,
      openingHours: { days: 'mon-sat', open: 420, close: 1260 },
    });
    addPlace(world, { kind: 'salud.hospital', name: 'H', openingHours: '24h' });
    addPlace(world, { kind: 'vivienda.unidad', name: 'V', openingHours: null });
  });

  it('un mundo sin mapa conserva el hash de M0 (sin clave geo en la instantánea)', () => {
    const { world } = createWorld(testConfig());
    expect('geo' in serializeWorld(world)).toBe(false);
  });
});
