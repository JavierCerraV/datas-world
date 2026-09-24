// Objetos con historia (spec 005): alta validada y consulta por persona (propios y del hogar).
import { allocateId, idKind } from './ids.ts';
import type { EntityId } from './ids.ts';
import type { NewObject, World, WorldObject } from './world.ts';

const KEY_RE = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

/** Alta de un objeto (005 INV-001, INV-002): dueño CIT o HOU existente, valores en rango. */
export function addObject(world: World, data: NewObject): EntityId {
  if (!KEY_RE.test(data.kind)) throw new Error(`Tipo de objeto inválido: ${data.kind}`);
  if (!data.name.trim()) throw new Error('Un objeto necesita nombre');
  const kind = idKind(data.ownerId);
  const exists =
    kind === 'CIT' ? world.citizens.has(data.ownerId) : kind === 'HOU' ? world.households.has(data.ownerId) : false;
  if (!exists) throw new Error(`Dueño inválido para un objeto: ${data.ownerId}`);
  if (!Number.isSafeInteger(data.marketValue) || data.marketValue < 0)
    throw new RangeError(`Valor de mercado inválido: ${data.marketValue}`);
  if (!(data.condition >= 0 && data.condition <= 1)) throw new RangeError('condition fuera de [0,1]');
  for (const [who, v] of Object.entries(data.sentimental)) {
    if (!world.citizens.has(who as EntityId) || !(v >= 0 && v <= 1))
      throw new RangeError(`Valor emocional inválido para ${who}`);
  }
  const id = allocateId(world.counters, 'OBJ');
  const obj: WorldObject = { ...structuredClone(data), id, status: 'active', historyEventIds: [], fate: 'owned' };
  world.objects.set(id, obj);
  return id;
}

/** Añade un evento a la historia de un objeto (005 R-005). */
export function recordObjectEvent(world: World, objectId: EntityId, eventId: EntityId): void {
  const o = world.objects.get(objectId);
  if (!o) throw new Error(`No existe el objeto ${objectId}`);
  o.historyEventIds.push(eventId);
}

/** Objetos de una persona: los suyos y los de su hogar (005 CA-003), en orden de id. */
export function objectsOf(world: World, citizenId: EntityId): WorldObject[] {
  const household = world.citizens.get(citizenId)?.householdId;
  return [...world.objects.values()]
    .filter(
      (o) => o.status === 'active' && (o.ownerId === citizenId || (household !== undefined && o.ownerId === household)),
    )
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}
