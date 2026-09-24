import { TILE, createWorld, profileNumber, profileValue, stateHash, tileAt } from '@datas-world/engine';
import type { Place, WorldConfig } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { loadCatalog } from '../catalogs/load.ts';
import { DEFAULT_PROFILE, PROTOTYPE_PROFILE, loadProfile } from '../country/profile.ts';
import { generateGeography } from '../geography/generate.ts';
import { DWELLING_CAPACITY, generatePlaces } from './generate.ts';

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

function build() {
  const { world } = createWorld(config);
  const territory = generateGeography(world, { placeKinds });
  const places = generatePlaces(world, territory, placeKinds);
  const all = [...world.places.values()];
  const byKind = (k: string) => all.filter((p) => p.kind === k);
  return { world, territory, places, all, byKind };
}

// Referencia literal del prototipo (PDEF, LAYOUT): nombre, horario [apertura, cierre], días, rectángulo.
const PROTO: [string, string, [number, number], string, [number, number]][] = [
  ['educacion.colegio', 'Colegio Los Alisos', [360, 840], 'mon-fri', [20, 7]],
  ['ocio.gimnasio', 'Gimnasio Forja', [360, 1260], 'all', [48, 7]],
  ['ocio.cafe', 'Café Data', [420, 1260], 'all', [8, 17]], // en el prototipo, "Café Cordillera"
  ['ocio.restaurante', 'Restaurante La Mesa', [660, 1320], 'all', [12, 17]],
  ['espacio_publico.parque', 'Parque Central', [330, 1260], 'all', [20, 17]],
  ['servicios.oficina', 'Oficinas Andina', [420, 1140], 'mon-fri', [32, 17]],
  ['comercio.tienda_barrio', 'Tienda El Surtidor', [540, 1200], 'all', [48, 17]],
  ['industria.fabrica', 'Textiles del Sur', [330, 900], 'mon-fri', [20, 27]],
];

describe('spec 004: lugares', () => {
  it('CA-001: existe al menos un lugar de cada tipo esencial', () => {
    const { byKind } = build();
    for (const k of [
      'vivienda.unidad',
      'servicios.oficina',
      'industria.fabrica',
      'educacion.colegio',
      'salud.hospital',
      'comercio.tienda_barrio',
      'espacio_publico.parque',
      'religioso.iglesia',
    ]) {
      expect(byKind(k).length, k).toBeGreaterThan(0);
    }
  });

  it('CA-002: los lugares no residenciales coinciden con PDEF y LAYOUT del prototipo (salvo la iglesia añadida)', () => {
    const { byKind } = build();
    for (const [kind, name, [open, close], days, [x, y]] of PROTO) {
      const [p] = byKind(kind) as [Place];
      expect(p, kind).toBeDefined();
      expect(p).toMatchObject({ name, openingHours: { days, open, close }, rect: { x, y } });
    }
    expect(byKind('salud.hospital')[0]).toMatchObject({
      name: 'Hospital San Rafael',
      openingHours: '24h',
      rect: { x: 36, y: 17 },
    });
    expect(byKind('religioso.iglesia')[0]).toMatchObject({
      name: 'Iglesia de San Martín',
      capacity: 60,
      rect: { x: 32, y: 27 },
    });
    expect(byKind('vivienda.edificio')).toHaveLength(13); // 14 casas del prototipo menos la de la iglesia
  });

  it('CA-003: hay viviendas suficientes para la población objetivo con cualquiera de los dos perfiles', () => {
    const { byKind } = build();
    const units = byKind('vivienda.unidad');
    expect(units).toHaveLength(82); // 6 edificios × 7 (estrato 2) + 6 × 6 (estrato 3) + 1 × 4 (estrato 4)
    // Tamaño medio de hogar según los pesos de plantilla (spec 008) y el tamaño de cada plantilla.
    const SIZE: Record<string, number> = {
      single: 1,
      couple: 2,
      couple_kids: 4,
      extended: 3,
      single_parent: 2.5,
      roommates: 2.5,
    };
    for (const id of [DEFAULT_PROFILE, PROTOTYPE_PROFILE]) {
      const p = loadProfile(id);
      const w = profileValue(p, 'gen.household.templateWeights', '2026-01-01') as Record<string, number>;
      const mean = Object.entries(w).reduce((s, [k, v]) => s + v * SIZE[k]!, 0);
      const target = profileNumber(p, 'gen.population.target', '2026-01-01');
      expect(units.length, id).toBeGreaterThanOrEqual(Math.ceil(target / mean));
    }
    expect(units.every((u) => u.capacity === DWELLING_CAPACITY && u.openingHours === null)).toBe(true);
  });

  it('INV-002: toda vivienda cuelga de un edificio residencial de su mismo barrio y comparte su puerta', () => {
    const { world, byKind } = build();
    for (const u of byKind('vivienda.unidad')) {
      const b = world.places.get(u.parentId!)!;
      expect(b.kind).toBe('vivienda.edificio');
      expect(b.districtId).toBe(u.districtId);
      expect(u.door).toEqual(b.door);
    }
    expect(byKind('vivienda.unidad')[0]!.name).toBe('Vivienda 01-A');
  });

  it('CA-006: todo tipo de lugar existe en el catálogo del mundo y es de M1', () => {
    const { all } = build();
    for (const p of all) expect(placeKinds.entries.find((e) => e.key === p.kind)?.since, p.kind).toBe('M1');
  });

  it('pinta edificios y parque en el mapa sin tocar las calles; cada lugar queda en el barrio de su fila', () => {
    const { world, places, territory } = build();
    for (const { plot, placeId } of places.plots) {
      const expected = plot.kind === 'espacio_publico.parque' ? TILE.park : TILE.building;
      const r = plot.rect;
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) expect(tileAt(world.geo!, x, y)).toBe(expected);
      expect(tileAt(world.geo!, plot.door.x, plot.door.y)).toBe(TILE.road);
      expect(world.places.get(placeId)!.districtId).toBe(territory.districtIds[plot.row]);
    }
    expect(places.workplaceIds).toHaveLength(8); // oficina, hospital, colegio, fábrica, tienda, café, restaurante, gimnasio
  });

  it('determinismo: la misma semilla da los mismos lugares y el mismo hash', () => {
    expect(stateHash(build().world)).toBe(stateHash(build().world));
  });

  it('R-007: los turnos colombianos del catálogo caben en la jornada máxima vigente', () => {
    const co = loadProfile(DEFAULT_PROFILE);
    const max = profileNumber(co, 'labor.maxWeeklyHours', '2026-07-15');
    const days = { 'mon-fri': 5, 'mon-sat': 6 } as Record<string, number>;
    for (const e of placeKinds.entries) {
      const s = e.attrs?.shiftCO as { days: string; start: number; end: number; lunch: number } | undefined;
      if (s) expect(((s.end - s.start - s.lunch) * days[s.days]!) / 60, e.key).toBeLessThanOrEqual(max);
    }
  });
});
