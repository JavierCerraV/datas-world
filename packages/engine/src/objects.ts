// Objetos con historia (spec 005): alta validada y consulta por persona (propios y del hogar).
import { makeEvent } from './events.ts';
import type { CauseRef, WorldEvent } from './events.ts';
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

/**
 * Valor emocional que da un regalo a quien lo recibe (005 R-005 en M2; R-006 lo hará depender de la relación y de
 * los momentos en M3) [M]: de un padre o una madre, 0,7; de otro miembro del hogar, 0,6; de otra persona, 0,4.
 */
export const GIFT_SENTIMENTAL = Object.freeze({ parent: 0.7, household: 0.6, other: 0.4 });

function giftSentimental(world: World, from: EntityId, to: EntityId): number {
  const receiver = world.citizens.get(to);
  if (receiver?.motherId === from || receiver?.fatherId === from) return GIFT_SENTIMENTAL.parent;
  if (receiver?.householdId && receiver.householdId === world.citizens.get(from)?.householdId) return GIFT_SENTIMENTAL.household;
  return GIFT_SENTIMENTAL.other;
}

export type ObjectTransfer =
  | { how: 'gift'; from: EntityId; to: EntityId; occasion: string }
  | { how: 'sale'; from: EntityId; to: EntityId; price: number };

/**
 * 005 R-005: el objeto cambia de dueño con un evento (`OBJECT_GIFTED` u `OBJECT_SOLD`) que queda en su historia.
 * El regalo da al que lo recibe el valor emocional de `GIFT_SENTIMENTAL` (nunca lo baja). Devuelve el evento, que
 * el llamador guarda en el registro (como en la generación, 030). El dinero de una venta lo mueve la economía (015).
 */
export function transferObject(world: World, objectId: EntityId, t: ObjectTransfer, causes: CauseRef[]): WorldEvent {
  const o = world.objects.get(objectId);
  if (!o || o.status !== 'active' || o.fate !== 'owned') throw new Error(`El objeto ${objectId} no está disponible`);
  if (!world.citizens.has(t.to)) throw new Error(`No existe quien lo recibe: ${t.to}`);
  if (o.ownerId !== t.from && o.ownerId !== world.citizens.get(t.from)?.householdId) throw new Error(`${t.from} no es dueño de ${objectId}`);
  const participants = [
    { id: t.from, role: t.how === 'gift' ? 'quien_regala' : 'vendedor' },
    { id: t.to, role: t.how === 'gift' ? 'quien_recibe' : 'comprador' },
  ];
  const e =
    t.how === 'gift'
      ? makeEvent(world.counters, world.now, { type: 'OBJECT_GIFTED', payload: { objectId, from: t.from, to: t.to, name: o.name, occasion: t.occasion }, participants, causes })
      : makeEvent(world.counters, world.now, { type: 'OBJECT_SOLD', payload: { objectId, from: t.from, to: t.to, name: o.name, price: t.price }, participants, causes });
  o.ownerId = t.to;
  if (t.how === 'gift') o.sentimental[t.to] = Math.max(o.sentimental[t.to] ?? 0, giftSentimental(world, t.from, t.to));
  if (t.how === 'sale') o.marketValue = t.price;
  o.historyEventIds.push(e.id);
  return e;
}

/**
 * 005 R-005 y CA-005: un objeto perdido (o destruido) no se borra nunca: queda con `status: 'inactive'`, su
 * `fate` y el evento en su historia.
 */
export function loseObject(world: World, objectId: EntityId, fate: 'lost' | 'destroyed', causes: CauseRef[]): WorldEvent {
  const o = world.objects.get(objectId);
  if (!o || o.status !== 'active') throw new Error(`El objeto ${objectId} no está disponible`);
  const owner = o.ownerId;
  const e = makeEvent(world.counters, world.now, { type: 'OBJECT_LOST', payload: { objectId, ownerId: owner, name: o.name }, participants: [{ id: owner, role: 'dueño' }], causes });
  o.status = 'inactive';
  o.fate = fate;
  o.historyEventIds.push(e.id);
  return e;
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
