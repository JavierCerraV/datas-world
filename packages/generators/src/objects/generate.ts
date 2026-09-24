// Objetos iniciales (spec 005 R-001 a R-004, R-008): de las personas según las reglas del catálogo y del
// hogar (carro) según el estrato; cada uno con su evento de origen anterior al presente (R-003).
import { addObject, ageInYears, idNumber, makeEvent, profileValue, recordObjectEvent } from '@datas-world/engine';
import type { EntityId, Rng, World, WorldEvent } from '@datas-world/engine';
import type { Catalog } from '../catalogs/schema.ts';
import { worldDate } from '../organizations/generate.ts';

const CAUSE = [{ state: 'backstory', weight: 1 }];
const DAY = 1440;
const YEAR = 525_600;

interface ObjectAttrs {
  defaultName: string;
  price: number;
  sentimental?: number;
  ownedBy?: 'household';
  condition?: [number, number];
  gen?: { minAge?: number; maxAge?: number; p: number }[];
}

export interface ObjectsResult {
  objectIds: EntityId[];
  events: WorldEvent[];
}

/**
 * Por persona, en orden de id, y por tipo de objeto en orden del catálogo: se aplica la primera regla `gen`
 * cuya edad encaja. Después, por hogar, el carro con `gen.objects.carP[estrato]`. Azar: `gen:objects/<dueño>/<tipo>`.
 */
export function generateObjects(
  world: World,
  citizenIds: readonly EntityId[],
  householdIds: readonly EntityId[],
  objectKinds: Catalog,
  rng: Rng,
): ObjectsResult {
  const profile = world.config.profile;
  if (!profile) throw new Error('El mundo no tiene perfil de país (spec 029)');
  const carP = profileValue(profile, 'gen.objects.carP', worldDate(world)) as Record<string, number>;
  const result: ObjectsResult = { objectIds: [], events: [] };
  const kinds = objectKinds.entries.filter((e) => e.since === 'M1');
  const birth = (id: EntityId) => world.components.i32['demo.birthMinute']![idNumber(id)]!;

  const create = (ownerId: EntityId, kindKey: string, a: ObjectAttrs, r: Rng, witness: EntityId, earliest: number) => {
    const [lo, hi] = a.condition ?? [0.5, 1];
    const sentimental = a.sentimental !== undefined && ownerId.startsWith('CIT') ? { [ownerId]: a.sentimental } : {};
    const id = addObject(world, {
      kind: kindKey,
      name: a.defaultName,
      ownerId,
      marketValue: a.price,
      condition: Math.round((lo + (hi - lo) * r.next()) * 1000) / 1000,
      sentimental,
    });
    // Adquirido en los últimos 5 años (o heredado en algún momento de la vida adulta), nunca antes de `earliest`.
    const span = Math.max(1, Math.floor(-earliest / DAY));
    const inherited = a.sentimental !== undefined;
    const back = inherited ? r.int(1, span) : r.int(1, Math.min(span, 5 * 365));
    const at = Math.max(-back * DAY, earliest);
    const e = inherited
      ? makeEvent(world.counters, at, {
          type: 'OBJECT_INHERITED',
          payload: { objectId: id, to: ownerId, name: a.defaultName },
          participants: [{ id: witness, role: 'heredero' }],
          causes: CAUSE,
        })
      : makeEvent(world.counters, at, {
          type: 'OBJECT_ACQUIRED',
          payload: { objectId: id, ownerId, price: a.price, name: a.defaultName },
          participants: [{ id: witness, role: 'comprador' }],
          causes: CAUSE,
        });
    recordObjectEvent(world, id, e.id);
    world.citizens.get(witness)!.backstory!.push(e.id);
    result.objectIds.push(id);
    result.events.push(e);
  };

  for (const cid of citizenIds) {
    const age = ageInYears(birth(cid), world.now, world.config.epoch);
    for (const k of kinds) {
      const a = k.attrs as unknown as ObjectAttrs;
      if (a.ownedBy === 'household' || !a.gen) continue;
      const rule = a.gen.find(
        (g) => (g.minAge === undefined || age >= g.minAge) && (g.maxAge === undefined || age <= g.maxAge),
      );
      const r = rng.fork(`gen:objects/${cid}/${k.key}`);
      if (!rule || !r.chance(rule.p)) continue;
      // Desde los 18 años para una herencia; desde los 10 para una compra (y nunca antes de nacer).
      const earliest = Math.min(birth(cid) + (a.sentimental !== undefined ? 18 : 10) * YEAR, -DAY);
      create(cid, k.key, a, r, cid, earliest);
    }
  }
  const car = kinds.find((k) => (k.attrs as unknown as ObjectAttrs).ownedBy === 'household');
  if (car) {
    for (const hid of householdIds) {
      const h = world.households.get(hid)!;
      const stratum = world.places.get(world.places.get(h.dwellingId)!.districtId!)!.stratum!;
      const r = rng.fork(`gen:objects/${hid}/${car.key}`);
      if (!r.chance(carP[String(stratum)] ?? 0)) continue;
      const head = h.headId!;
      create(hid, car.key, car.attrs as unknown as ObjectAttrs, r, head, Math.min(birth(head) + 18 * YEAR, -DAY));
    }
  }
  return result;
}
