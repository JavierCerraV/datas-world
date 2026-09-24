import { TILE, createWorld, doorDistanceMatrix, stateHash, tileAt } from '@datas-world/engine';
import type { WorldConfig } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { loadCatalog } from '../catalogs/load.ts';
import { districtAt, generateGeography } from './generate.ts';
import { PROTOTYPE_64X40, plots } from './template.ts';

const config: WorldConfig = {
  name: "Data's World",
  seed: 482917,
  epoch: '2026-01-01T00:00',
  tickMinutes: 5,
  currency: { code: 'COP', minorUnit: 1 },
  population: { target: 200 },
  engineVersion: '0.2.0',
  params: {},
  initialCapabilities: ['clock'],
  holidays: [],
};

const placeKinds = loadCatalog('place_kinds');
const generate = (over: Partial<WorldConfig> = {}) => {
  const { world } = createWorld({ ...config, ...over });
  const territory = generateGeography(world, { placeKinds });
  return { world, territory };
};

// Referencia literal del prototipo (prototipo/index.html): ROAD_X, ROAD_Y, isRoad, COLS, ROWS.
const PROTO_ROAD_X = [5, 17, 29, 41, 53];
const PROTO_ROAD_Y = [4, 14, 24, 34];
const protoIsRoad = (x: number, y: number) =>
  PROTO_ROAD_X.some((r) => x === r || x === r + 1) || PROTO_ROAD_Y.some((r) => y === r || y === r + 1);

describe('spec 003: geografía', () => {
  it('CA-004: las calles y las manzanas coinciden con el prototipo', () => {
    const { world } = generate();
    const g = world.geo!;
    expect([g.width, g.height, g.tileMeters]).toEqual([64, 40, 8]);
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 64; x++) expect(tileAt(g, x, y) === TILE.road, `(${x},${y})`).toBe(protoIsRoad(x, y));
    }
    expect(PROTOTYPE_64X40.blockCols).toEqual([7, 19, 31, 43]);
    expect(PROTOTYPE_64X40.blockRows).toEqual([6, 16, 26]);
    // buildPlaces del prototipo: parcelas de 4×6 en x0+1+i*4, y0+1; parque 8×6; puertas en y0+8.
    const p = plots(PROTOTYPE_64X40);
    expect(p).toHaveLength(23);
    expect(p.find((q) => q.kind === 'espacio_publico.parque')).toMatchObject({
      rect: { x: 20, y: 17, w: 8, h: 6 },
      door: { x: 23, y: 24 },
    });
    expect(p[0]).toMatchObject({ rect: { x: 8, y: 7, w: 4, h: 6 }, door: { x: 10, y: 14 } });
    expect(p[1]).toMatchObject({ rect: { x: 12, y: 7, w: 4, h: 6 }, door: { x: 13, y: 14 } });
  });

  it('CA-001: la misma semilla da el mismo mapa, los mismos barrios y el mismo hash', () => {
    const a = generate();
    const b = generate();
    expect(stateHash(a.world)).toBe(stateHash(b.world));
    expect([...a.world.places.values()]).toEqual([...b.world.places.values()]);
  });

  it('CA-002 y CA-003: entre puertas la distancia es simétrica, ≥ Manhattan y siempre alcanzable', () => {
    const { world } = generate();
    const doors = plots(PROTOTYPE_64X40).map((p) => p.door);
    for (const d of doors) expect(tileAt(world.geo!, d.x, d.y), `puerta (${d.x},${d.y})`).toBe(TILE.road);
    const n = doors.length;
    const m = doorDistanceMatrix(world.geo!, doors);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = m[i * n + j]!;
        expect(v, `${i}→${j}`).toBeGreaterThanOrEqual(0);
        expect(v).toBe(m[j * n + i]);
        expect(v).toBeGreaterThanOrEqual(Math.abs(doors[i]!.x - doors[j]!.x) + Math.abs(doors[i]!.y - doors[j]!.y));
      }
    }
  });

  it('CA-005: jerarquía departamento → municipio → comuna → barrio con códigos DIVIPOLA ficticios', () => {
    const { world, territory: t } = generate({ name: 'San Juan del Río' });
    const P = (id: string) => world.places.get(id as `PLC-${string}`)!;
    expect(P(t.departmentId)).toMatchObject({ kind: 'territorio.departamento', divipola: '00' });
    expect(P(t.municipalityId)).toMatchObject({
      kind: 'territorio.municipio',
      name: 'San Juan del Río',
      parentId: t.departmentId,
      divipola: '00001',
    });
    expect(P(t.comunaId)).toMatchObject({
      kind: 'territorio.comuna',
      parentId: t.municipalityId,
      divipola: '00001-C01',
    });
    expect(t.districtIds.map((id) => [P(id).name, P(id).stratum, P(id).divipola, P(id).parentId])).toEqual([
      ['La Esperanza', 3, '00001-C01-B01', t.comunaId],
      ['Centro', 4, '00001-C01-B02', t.comunaId],
      ['San Martín', 2, '00001-C01-B03', t.comunaId],
    ]);
    for (const id of t.districtIds) expect(P(id).districtId).toBe(id);
  });

  it('R-003: los barrios parten el mapa; cada puerta cae en el barrio de su fila de manzanas', () => {
    const { world, territory } = generate();
    for (let y = 0; y < 40; y++) expect(() => districtAt(world, territory, y)).not.toThrow();
    for (const p of plots(PROTOTYPE_64X40))
      expect(districtAt(world, territory, p.door.y)).toBe(territory.districtIds[p.row]);
  });

  it('INV-002: el mapa se genera una sola vez; una plantilla desconocida falla', () => {
    const { world } = generate();
    expect(() => generateGeography(world)).toThrow(/una sola vez/);
    const w2 = createWorld(config).world;
    expect(() => generateGeography(w2, { template: 'no-existe' })).toThrow(/desconocida/);
  });

  it('todos los tipos de lugar de la plantilla existen en el catálogo y son de M1', () => {
    for (const p of plots(PROTOTYPE_64X40))
      expect(placeKinds.entries.find((e) => e.key === p.kind)?.since, p.kind).toBe('M1');
  });
});
