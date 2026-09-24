// Generador de lugares (spec 004): una parcela de la plantilla = un lugar; los edificios residenciales
// se dividen en viviendas según el estrato del barrio.
import { TILE, addPlace, setTile } from '@datas-world/engine';
import type { EntityId, OpeningHours, World } from '@datas-world/engine';
import { catalogEntry } from '../catalogs/load.ts';
import type { Catalog } from '../catalogs/schema.ts';
import type { Territory } from '../geography/generate.ts';
import { plots } from '../geography/template.ts';
import type { PlotTemplate } from '../geography/template.ts';

/** Residentes máximos por vivienda (spec 004): cabe el hogar más grande de las plantillas (spec 008). */
export const DWELLING_CAPACITY = 6;

export interface PlacedPlot {
  plot: PlotTemplate;
  placeId: EntityId;
  /** Solo en edificios residenciales: sus viviendas, en orden. */
  dwellingIds: EntityId[];
}

export interface PlacesResult {
  plots: PlacedPlot[];
  /** Todas las viviendas, en orden de creación (edificio y letra). */
  dwellingIds: EntityId[];
  /** Lugares con puestos de trabajo (`slots` en el catálogo), para el generador de organizaciones. */
  workplaceIds: EntityId[];
}

type OpenDays = 'all' | 'mon-fri' | 'mon-sat';
interface PlaceAttrs {
  defaultName?: string;
  open?: [number, number];
  openDays?: OpenDays;
  slots?: number;
  capacity?: number;
  unitsPerBuilding?: Record<string, number>;
}

const pad = (n: number) => String(n).padStart(2, '0');

function hoursOf(a: PlaceAttrs): OpeningHours | undefined {
  if (!a.open) return undefined;
  const [open, close] = a.open;
  if (open === 0 && close === 1440) return '24h';
  return { days: a.openDays ?? 'all', open, close };
}

/**
 * Crea los lugares de las parcelas de la plantilla del territorio y pinta sus tiles (edificio o parque).
 * Sin azar: los atributos salen del catálogo y los nombres del orden de las parcelas (004 R-001, R-002).
 */
export function generatePlaces(world: World, territory: Territory, placeKinds: Catalog): PlacesResult {
  const g = world.geo;
  if (!g) throw new Error('Primero la geografía: el mundo no tiene mapa');
  const result: PlacesResult = { plots: [], dwellingIds: [], workplaceIds: [] };
  let building = 0;
  for (const plot of plots(territory.template)) {
    const entry = catalogEntry(placeKinds, plot.kind);
    if (entry.since !== 'M1') throw new Error(`${plot.kind} es de ${entry.since}: no se instancia en M1`);
    const attrs = (entry.attrs ?? {}) as PlaceAttrs;
    const districtId = territory.districtIds[plot.row];
    if (!districtId) throw new Error(`La fila de manzanas ${plot.row} no tiene barrio`);
    const stratum = world.places.get(districtId)!.stratum!;
    const residential = plot.kind === 'vivienda.edificio';
    if (residential) building += 1;
    const hours = hoursOf(attrs);
    const placeId = addPlace(world, {
      kind: plot.kind,
      name: residential ? `Edificio ${pad(building)}` : (attrs.defaultName ?? entry.name),
      districtId,
      rect: plot.rect,
      door: plot.door,
      ...(hours !== undefined ? { openingHours: hours } : {}),
      ...(attrs.capacity !== undefined ? { capacity: attrs.capacity } : {}),
    });
    const r = plot.rect;
    const tile = plot.kind === 'espacio_publico.parque' ? TILE.park : TILE.building;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) setTile(g, x, y, tile);

    const dwellingIds: EntityId[] = [];
    if (residential) {
      const units = attrs.unitsPerBuilding?.[String(stratum)];
      if (!units) throw new Error(`vivienda.edificio no define viviendas para el estrato ${stratum}`);
      for (let u = 0; u < units; u++) {
        dwellingIds.push(
          addPlace(world, {
            kind: 'vivienda.unidad',
            name: `Vivienda ${pad(building)}-${String.fromCharCode(65 + u)}`,
            parentId: placeId,
            districtId,
            door: plot.door,
            capacity: DWELLING_CAPACITY,
            openingHours: null,
          }),
        );
      }
      result.dwellingIds.push(...dwellingIds);
    }
    if (attrs.slots) result.workplaceIds.push(placeId);
    result.plots.push({ plot, placeId, dwellingIds });
  }
  return result;
}
