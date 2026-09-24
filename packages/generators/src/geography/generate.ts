// Generador de geografía y territorio (spec 003; ADR-006 §3).
import { TILE, addPlace, createGeoMap, setTile } from '@datas-world/engine';
import type { EntityId, World } from '@datas-world/engine';
import { catalogEntry } from '../catalogs/load.ts';
import type { Catalog } from '../catalogs/schema.ts';
import { MAP_TEMPLATES, PROTOTYPE_64X40, isRoadTile } from './template.ts';
import type { MapTemplate } from './template.ts';

export interface GeographyOptions {
  template?: string;
  /** Nombre del departamento ficticio. El del municipio es el del mundo (`config.name`). */
  departmentName?: string;
  /** Catálogo de lugares: si se da, cada tipo usado debe existir en él (ADR-006). */
  placeKinds?: Catalog;
}

export interface Territory {
  template: MapTemplate;
  departmentId: EntityId;
  municipalityId: EntityId;
  comunaId: EntityId;
  /** Barrios en el orden de la plantilla (de arriba abajo). */
  districtIds: EntityId[];
}

/** Seguridad percibida por estrato (spec 003 §8). Sin efecto hasta M2. */
export const SAFETY_BY_STRATUM: Readonly<Record<number, number>> = Object.freeze({
  1: 0.4,
  2: 0.5,
  3: 0.65,
  4: 0.8,
  5: 0.85,
  6: 0.9,
});

export const DEFAULT_DEPARTMENT = 'Departamento de la Cordillera';

/** Códigos DIVIPOLA ficticios: el prefijo "00" no lo usa ningún departamento real (ADR-006 §2). */
const DIVIPOLA = {
  department: '00',
  municipality: '00001',
  comuna: (n: number) => `00001-C${String(n).padStart(2, '0')}`,
  district: (c: number, n: number) => `00001-C${String(c).padStart(2, '0')}-B${String(n).padStart(2, '0')}`,
};

/**
 * Crea el mapa (calles y pasto; los edificios los pinta el generador de lugares) y la cadena territorial.
 * La plantilla es fija, así que el resultado no depende del azar: misma semilla, mismo mapa (003 CA-001).
 */
export function generateGeography(world: World, opts: GeographyOptions = {}): Territory {
  if (world.geo) throw new Error('El mundo ya tiene mapa: la geografía se genera una sola vez (003 INV-002)');
  const t = MAP_TEMPLATES[opts.template ?? PROTOTYPE_64X40.id];
  if (!t) throw new Error(`Plantilla de mapa desconocida: ${opts.template}`);
  if (opts.placeKinds) {
    for (const k of ['territorio.departamento', 'territorio.municipio', 'territorio.comuna', 'territorio.barrio']) {
      catalogEntry(opts.placeKinds, k);
    }
  }
  checkDistrictRows(t);

  const geo = createGeoMap(t.width, t.height, t.tileMeters);
  for (let y = 0; y < t.height; y++)
    for (let x = 0; x < t.width; x++) if (isRoadTile(t, x, y)) setTile(geo, x, y, TILE.road);
  world.geo = geo;

  const whole = { x: 0, y: 0, w: t.width, h: t.height };
  const departmentId = addPlace(world, {
    kind: 'territorio.departamento',
    name: opts.departmentName ?? DEFAULT_DEPARTMENT,
    divipola: DIVIPOLA.department,
  });
  const municipalityId = addPlace(world, {
    kind: 'territorio.municipio',
    name: world.config.name,
    parentId: departmentId,
    rect: whole,
    divipola: DIVIPOLA.municipality,
  });
  const comunaId = addPlace(world, {
    kind: 'territorio.comuna',
    name: 'Comuna 1',
    parentId: municipalityId,
    rect: whole,
    divipola: DIVIPOLA.comuna(1),
  });
  const districtIds = t.districts.map((d, i) =>
    addPlace(world, {
      kind: 'territorio.barrio',
      name: d.name,
      parentId: comunaId,
      rect: { x: 0, y: d.rows[0], w: t.width, h: d.rows[1] - d.rows[0] },
      divipola: DIVIPOLA.district(1, i + 1),
      stratum: d.stratum,
      safety: SAFETY_BY_STRATUM[d.stratum] ?? 0.5,
    }),
  );
  // Un barrio es su propio distrito (004: districtId).
  for (const id of districtIds) world.places.get(id)!.districtId = id;
  return { template: t, departmentId, municipalityId, comunaId, districtIds };
}

/** Las filas de los barrios deben partir el mapa sin huecos ni solapes (003 R-003). */
function checkDistrictRows(t: MapTemplate): void {
  let y = 0;
  for (const d of t.districts) {
    if (d.rows[0] !== y || d.rows[1] <= d.rows[0])
      throw new Error(`Plantilla ${t.id}: el barrio ${d.name} no continúa en la fila ${y}`);
    y = d.rows[1];
  }
  if (y !== t.height) throw new Error(`Plantilla ${t.id}: los barrios no cubren todo el mapa`);
}

/** Barrio que contiene la fila `y` (003 R-003). */
export function districtAt(world: World, territory: Territory, y: number): EntityId {
  const id = territory.districtIds.find((d) => {
    const r = world.places.get(d)!.rect!;
    return y >= r.y && y < r.y + r.h;
  });
  if (!id) throw new Error(`La fila ${y} no pertenece a ningún barrio`);
  return id;
}
