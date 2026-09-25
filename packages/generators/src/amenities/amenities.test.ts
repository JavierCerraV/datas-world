import { TILE, profileNumber, tileAt } from '@datas-world/engine';
import type { Place } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, PROTOTYPE_PROFILE } from '../country/profile.ts';
import { DATAS_WORLD_V1 } from '../geography/template.ts';
import { buildWorld, catalogs } from '../testing.ts';
import { amenityPlan, resolvePlots } from './plan.ts';
import { REFERENCE_CITY } from './regional.ts';

const kinds = (places: Iterable<Place>) => [...places].map((p) => p.kind);
const count = (list: string[], k: string) => list.filter((x) => x === k).length;

describe('spec 033: dotación urbana de Data\'s World (perfil colombiano, 200 habitantes)', () => {
  const { world, events, amenities, profile } = buildWorld(DEFAULT_PROFILE, 482917);
  const all = [...world.places.values()];
  const local = all.filter((p) => p.rect && !p.kind.startsWith('territorio.'));
  const regional = all.filter((p) => p.travel && !p.kind.startsWith('territorio.'));

  it('CA-001: el municipio tiene lo esencial y la ciudad de referencia, cine, centro comercial, museo y parque de diversiones', () => {
    const k = kinds(local);
    for (const need of ['cultura.biblioteca', 'educacion.escuela', 'gobierno.estacion_policia', 'gobierno.alcaldia', 'deporte.polideportivo', 'ocio.restaurante'])
      expect(k, need).toContain(need);
    expect(count(k, 'comercio.tienda_barrio')).toBeGreaterThanOrEqual(3);
    expect(count(k, 'ocio.bar')).toBeGreaterThanOrEqual(1);
    expect(k.includes('finanzas.banco') || k.includes('finanzas.corresponsal')).toBe(true);
    const r = kinds(regional);
    for (const far of ['ocio.cine', 'comercio.centro_comercial', 'cultura.museo', 'ocio.parque_diversiones']) {
      expect(r, far).toContain(far);
      expect(k, far).not.toContain(far);
    }
    expect(amenities!.resolved.unplaced).toEqual([]);
  });

  it('CA-003 e INV-001 a INV-003: tipos del catálogo, lugares locales en el mapa, regionales fuera y con viaje; obligatorios presentes', () => {
    const catalogKeys = new Set(catalogs.place_kinds.entries.map((e) => e.key));
    for (const p of all) expect(catalogKeys.has(p.kind), p.kind).toBe(true);
    for (const p of local.filter((p) => p.door)) expect(tileAt(world.geo!, p.door!.x, p.door!.y), p.name).toBe(TILE.road);
    const city = all.find((p) => p.name === REFERENCE_CITY)!;
    expect(city.kind).toBe('territorio.municipio');
    for (const p of regional) {
      expect(p.rect).toBeUndefined();
      expect(p.parentId).toBe(city.id);
      expect(p.travel).toEqual({
        minutes: profileNumber(profile, 'amenity.travel.minutes', '2026-01-01'),
        cost: profileNumber(profile, 'amenity.travel.cost', '2026-01-01'),
      });
    }
    // Los obligatorios por ley (R-002).
    for (const law of ['cultura.biblioteca', 'educacion.escuela', 'gobierno.estacion_policia', 'gobierno.alcaldia'])
      expect(kinds(local)).toContain(law);
    // Cada lugar local nuevo tiene su PLACE_BUILT (030) antes del presente.
    const built = new Set(events.filter((e) => e.type === 'PLACE_BUILT').map((e) => (e.payload as { placeId: string }).placeId));
    for (const p of local) expect(built.has(p.id), p.name).toBe(true);
  });

  it('CA-005: bares y discotecas cierran a más tardar a amenity.nightlifeClose; tiendas repartidas por barrios', () => {
    const close = profileNumber(profile, 'amenity.nightlifeClose', '2026-01-01');
    for (const p of local.filter((p) => p.kind === 'ocio.bar' || p.kind === 'ocio.discoteca')) {
      const h = p.openingHours as { close: number };
      expect(h.close).toBeLessThanOrEqual(close);
      expect(h.close).toBeGreaterThan(1440); // abierto pasada la medianoche
    }
    const districts = new Set(local.filter((p) => p.kind === 'comercio.tienda_barrio').map((p) => p.districtId));
    expect(districts.size).toBe(3);
  });

  it('la escuela es sede de la institución educativa: una organización con dos lugares', () => {
    const school = local.find((p) => p.kind === 'educacion.escuela')!;
    const org = [...world.organizations.values()].find((o) => o.placeIds.includes(school.id))!;
    expect(org.name).toBe('Institución Educativa Los Alisos');
    expect(org.placeIds.map((id) => world.places.get(id)!.kind)).toEqual(['educacion.colegio', 'educacion.escuela']);
    expect(org.positions.filter((p) => p.level === 1)).toHaveLength(1); // un solo rector
  });
});

describe('033 reglas de la dotación', () => {
  it('CA-002: con 150 000 habitantes, coliseo, cine y museo pasan a ser locales; el parque de diversiones sigue siendo regional', () => {
    const plan = amenityPlan(catalogs.place_kinds, 150_000);
    const local = plan.local.map((l) => l.kind);
    for (const k of ['deporte.coliseo', 'ocio.cine', 'cultura.museo', 'comercio.centro_comercial']) expect(local, k).toContain(k);
    expect(plan.regional).toContain('ocio.parque_diversiones');
    expect(plan.local.find((l) => l.kind === 'comercio.tienda_barrio')!.count).toBe(200); // tope `max`
  });

  it('con 200 habitantes: 3 tiendas, 1 bar y los regionales en la ciudad de referencia', () => {
    const plan = amenityPlan(catalogs.place_kinds, 200);
    const n = (k: string) => plan.local.find((l) => l.kind === k)?.count ?? 0;
    expect(n('comercio.tienda_barrio')).toBe(3);
    expect(n('ocio.bar')).toBe(1);
    expect(n('ocio.discoteca')).toBe(0); // no llega a su población mínima
    expect(plan.regional).toEqual(
      expect.arrayContaining(['ocio.cine', 'comercio.centro_comercial', 'cultura.museo', 'deporte.coliseo', 'finanzas.banco']),
    );
  });

  it('R-003: los bares no van a manzanas con viviendas de estrato 4; lo que no cabe se informa', () => {
    const { plots, unplaced } = resolvePlots(DATAS_WORLD_V1, amenityPlan(catalogs.place_kinds, 2000), catalogs.place_kinds);
    for (const bar of plots.filter((p) => p.kind === 'ocio.bar')) {
      const neighbours = plots.filter((q) => q.row === bar.row && q.col === bar.col && q.kind === 'vivienda.edificio');
      for (const q of neighbours) expect(q.rect.y >= 15 && q.rect.y < 35).toBe(false); // Centro = estrato 4
    }
    expect(unplaced.length).toBeGreaterThan(0); // 2 000 habitantes no caben en la plantilla de M1
  });

  it('CA-004: el perfil prototipo conserva su mapa y no tiene dotación ni lugares regionales', () => {
    const { world, territory, amenities } = buildWorld(PROTOTYPE_PROFILE, 482917);
    expect(territory.template.id).toBe('prototipo-64x40');
    expect(amenities).toBeUndefined();
    expect([...world.places.values()].some((p) => p.travel)).toBe(false);
  });
});
