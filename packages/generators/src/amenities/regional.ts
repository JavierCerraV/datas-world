// Ciudad de referencia y lugares regionales (spec 033 R-001, R-007; INV-002): existen, tienen horario y
// capacidad y se puede viajar a ellos (M2), pero están fuera del mapa.
import { addPlace, profileNumber } from '@datas-world/engine';
import type { EntityId, OpeningHours, World } from '@datas-world/engine';
import { catalogEntry } from '../catalogs/load.ts';
import type { Catalog } from '../catalogs/schema.ts';
import type { Territory } from '../geography/generate.ts';
import { worldDate } from '../organizations/generate.ts';
import type { AmenityPlan } from './plan.ts';

/** Nombre de la ciudad de referencia (ficticia, como el departamento). */
export const REFERENCE_CITY = 'La Capital';

export interface RegionalResult {
  cityId: EntityId;
  /** Lugares regionales, en el orden del plan. */
  placeIds: EntityId[];
}

interface RegionalAttrs {
  defaultName?: string;
  open?: [number, number];
  openDays?: 'all' | 'mon-fri' | 'mon-sat';
  capacity?: number;
}

export function generateRegional(world: World, territory: Territory, plan: AmenityPlan, placeKinds: Catalog): RegionalResult {
  const profile = world.config.profile;
  if (!profile) throw new Error('El mundo no tiene perfil de país (spec 029)');
  const date = worldDate(world);
  const travel = {
    minutes: profileNumber(profile, 'amenity.travel.minutes', date),
    cost: profileNumber(profile, 'amenity.travel.cost', date),
  };
  const cityId = addPlace(world, {
    kind: 'territorio.municipio',
    name: REFERENCE_CITY,
    parentId: territory.departmentId,
    divipola: '00002',
    travel,
  });
  const placeIds = plan.regional.map((kind) => {
    const e = catalogEntry(placeKinds, kind);
    const a = (e.attrs ?? {}) as RegionalAttrs;
    const hours: OpeningHours | undefined = a.open
      ? a.open[0] === 0 && a.open[1] === 1440
        ? '24h'
        : { days: a.openDays ?? 'all', open: a.open[0], close: a.open[1] }
      : undefined;
    return addPlace(world, {
      kind,
      name: a.defaultName ?? e.name,
      parentId: cityId,
      travel,
      ...(hours !== undefined ? { openingHours: hours } : {}),
      ...(a.capacity !== undefined ? { capacity: a.capacity } : {}),
    });
  });
  return { cityId, placeIds };
}
