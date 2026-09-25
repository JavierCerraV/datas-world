// Generador de lugares (spec 004): una parcela de la plantilla = un lugar; los edificios residenciales
// se dividen en viviendas según el estrato del barrio.
import { TILE, addPlace, profileNumber, setTile } from '@datas-world/engine';
import type { EntityId, OpeningHours, World } from '@datas-world/engine';
import { catalogEntry } from '../catalogs/load.ts';
import type { Catalog } from '../catalogs/schema.ts';
import { districtAt } from '../geography/generate.ts';
import type { Territory } from '../geography/generate.ts';
import { plots } from '../geography/template.ts';
import type { PlotTemplate } from '../geography/template.ts';
import { worldDate } from '../organizations/generate.ts';

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
  /** Nombres de las instancias sucesivas del mismo tipo (tiendas, bares…). */
  names?: string[];
  /** Vida nocturna: el cierre no pasa de `amenity.nightlifeClose` del perfil (033 R-004). */
  nightlife?: boolean;
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
 * Crea los lugares de las parcelas y pinta sus tiles (edificio, parque o plaza). Por defecto, las parcelas de
 * la plantilla; con dotación (033), las ya resueltas por `resolvePlots`. Sin azar: los atributos salen del
 * catálogo y los nombres del orden de las parcelas (004 R-001, R-002).
 */
export function generatePlaces(
  world: World,
  territory: Territory,
  placeKinds: Catalog,
  plotList: readonly PlotTemplate[] = plots(territory.template),
): PlacesResult {
  const g = world.geo;
  if (!g) throw new Error('Primero la geografía: el mundo no tiene mapa');
  const result: PlacesResult = { plots: [], dwellingIds: [], workplaceIds: [] };
  const profile = world.config.profile;
  const nightlifeClose = (() => {
    try {
      return profile ? profileNumber(profile, 'amenity.nightlifeClose', worldDate(world)) : undefined;
    } catch {
      return undefined; // el perfil prototipo no tiene vida nocturna
    }
  })();
  const seen = new Map<string, number>();
  let building = 0;
  for (const plot of plotList) {
    const entry = catalogEntry(placeKinds, plot.kind);
    if (entry.since !== 'M1') throw new Error(`${plot.kind} es de ${entry.since}: no se instancia en M1`);
    const attrs = (entry.attrs ?? {}) as PlaceAttrs;
    // El barrio es el de la fila del edificio: un barrio puede ocupar varias filas de manzanas (033).
    const districtId = districtAt(world, territory, plot.rect.y);
    const stratum = world.places.get(districtId)!.stratum!;
    const residential = plot.kind === 'vivienda.edificio';
    if (residential) building += 1;
    const nth = seen.get(plot.kind) ?? 0;
    seen.set(plot.kind, nth + 1);
    const baseName = attrs.defaultName ?? entry.name;
    const own = nth === 0 ? territory.template.names?.[plot.kind] : undefined;
    const name = own ?? attrs.names?.[nth] ?? (nth === 0 ? baseName : `${baseName} ${nth + 1}`);
    let hours = hoursOf(attrs);
    if (attrs.nightlife && nightlifeClose !== undefined && hours && hours !== '24h' && hours.close > nightlifeClose)
      hours = { ...hours, close: nightlifeClose };
    const placeId = addPlace(world, {
      kind: plot.kind,
      name: residential ? `Edificio ${pad(building)}` : name,
      districtId,
      rect: plot.rect,
      door: plot.door,
      ...(hours !== undefined ? { openingHours: hours } : {}),
      ...(attrs.capacity !== undefined ? { capacity: attrs.capacity } : {}),
    });
    const r = plot.rect;
    const tile =
      plot.kind === 'espacio_publico.parque' ? TILE.park : plot.kind === 'espacio_publico.plaza' ? TILE.plaza : TILE.building;
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
    if (plot.kind === 'espacio_publico.plaza') addBusStop(world, placeKinds, placeId, districtId, plot);
  }
  return result;
}

/**
 * Paradero intermunicipal en la plaza (016 §3): un lugar dentro de ella, sin edificio, con la puerta sobre la
 * misma calle, unos tiles al este de la entrada de la plaza. Solo si el catálogo lo tiene en M1.
 */
function addBusStop(world: World, placeKinds: Catalog, plazaId: EntityId, districtId: EntityId, plot: PlotTemplate): void {
  const entry = placeKinds.entries.find((e) => e.key === 'transporte.paradero');
  if (entry?.since !== 'M1') return;
  const attrs = (entry.attrs ?? {}) as PlaceAttrs;
  const hours = hoursOf(attrs);
  addPlace(world, {
    kind: entry.key,
    name: attrs.defaultName ?? entry.name,
    parentId: plazaId,
    districtId,
    door: { x: plot.door.x + 3, y: plot.door.y },
    ...(hours !== undefined ? { openingHours: hours } : {}),
  });
}
