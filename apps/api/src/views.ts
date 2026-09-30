// Vistas de solo lectura del mundo para la API (spec 022): funciones puras sobre un `World` cargado de la base.
// No cambian el estado (R-001) y no leen el reloj.
import { ACTIVITY, ACTIVITY_COLUMN, affectionFor, attachmentOf, formatId, idNumber, kindOf, ruleContribution, toCalendar } from '@datas-world/engine';
import type { EntityId, Place, World, WorldEvent } from '@datas-world/engine';

const YEAR = 365.25 * 1440;
export const ACTIVITY_NAME = Object.fromEntries(Object.entries(ACTIVITY).map(([k, v]) => [v, k])) as Record<number, string>;
const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

/** Fecha y hora del mundo (`2027-01-04 07:35`). */
export function dateOf(world: World, at: number): string {
  const c = toCalendar(at, world.config.epoch, world.config.holidays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${c.year}-${p(c.month)}-${p(c.day)} ${p(c.hour)}:${p(c.minute)}`;
}

/** Punto del mapa de un lugar: su puerta, la de su padre (una vivienda dentro de un edificio) o nada (fuera del mapa). */
export function placePoint(world: World, placeRow: number): { x: number; y: number } | undefined {
  let p: Place | undefined = world.places.get(formatId('PLC', placeRow));
  for (let k = 0; p && k < 4; k++) {
    if (p.door) return { x: p.door.x + 0.5, y: p.door.y + 0.5 };
    if (p.rect) return { x: p.rect.x + p.rect.w / 2, y: p.rect.y + p.rect.h / 2 };
    p = p.parentId ? world.places.get(p.parentId) : undefined;
  }
  return undefined;
}

export interface CitizenPosition {
  id: EntityId;
  name: string;
  x: number | null;
  y: number | null;
  activity: string;
  placeId: EntityId | null;
  moving: boolean;
  mood: number;
  /** 024 R-008: edad, para la lista de la población. */
  age: number;
  /** 022 R-008: el viaje en curso con sus dos puertas en el mapa, para dibujar el recorrido por las calles. */
  trip?: { from: { x: number; y: number }; to: { x: number; y: number }; departAt: number; arriveAt: number };
}

export const living = (world: World) => [...world.citizens.values()].filter((c) => !c.ancestor && world.components.u8.active?.[idNumber(c.id)] === 1);

/**
 * 022 R-005: posición de cada persona viva. En su lugar, la puerta; en un viaje, la interpolación lineal entre las
 * puertas de origen y destino; fuera del mapa, `null`.
 */
export function positions(world: World): CitizenPosition[] {
  const i = world.components.i32;
  const out: CitizenPosition[] = [];
  for (const c of living(world)) {
    const row = idNumber(c.id);
    const to = i['trip.to']?.[row] ?? 0;
    let pt: { x: number; y: number } | undefined;
    let moving = false;
    let trip: CitizenPosition['trip'];
    if (to > 0) {
      moving = true;
      const a = placePoint(world, i['trip.from']?.[row] ?? 0);
      const b = placePoint(world, to);
      const t0 = i['trip.departAt']?.[row] ?? world.now;
      const t1 = i['trip.arriveAt']?.[row] ?? world.now;
      const f = t1 > t0 ? Math.min(1, Math.max(0, (world.now - t0) / (t1 - t0))) : 1;
      if (a && b) {
        pt = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
        trip = { from: a, to: b, departAt: t0, arriveAt: t1 };
      } else pt = f < 0.5 ? a : b;
    } else {
      pt = placePoint(world, i['loc.place']?.[row] ?? 0);
    }
    const place = i['loc.place']?.[row] ?? 0;
    out.push({
      id: c.id,
      name: c.name ? `${c.name.given} ${c.name.family[0]}` : c.id,
      x: pt ? round(pt.x, 3) : null,
      y: pt ? round(pt.y, 3) : null,
      activity: ACTIVITY_NAME[world.components.u8[ACTIVITY_COLUMN]?.[row] ?? 0] ?? 'idle',
      placeId: place > 0 && !moving ? formatId('PLC', place) : null,
      moving,
      mood: round(world.components.f32['state.mood']?.[row] ?? 0.5),
      age: Math.floor((world.now - (i['demo.birthMinute']?.[row] ?? 0)) / YEAR),
      ...(trip ? { trip } : {}),
    });
  }
  return out;
}

/** Horario de un lugar en texto. */
export const open = (p: Place) => (p.openingHours === null ? 'privado' : p.openingHours === '24h' ? '24h' : p.openingHours ? `${p.openingHours.open}-${p.openingHours.close}` : 'sin horario');

/** 022 `/api/world`: configuración, mapa y lugares. */
export function worldView(world: World) {
  return {
    name: world.config.name,
    now: world.now,
    date: dateOf(world, world.now),
    epoch: world.config.epoch,
    status: world.status,
    geo: world.geo ? { width: world.geo.width, height: world.geo.height, tiles: Array.from(world.geo.tiles) } : null,
    places: [...world.places.values()]
      .filter((p) => p.door || p.rect)
      .map((p) => ({ id: p.id, kind: p.kind, name: p.name, ...(p.rect ? { rect: p.rect } : {}), ...(p.door ? { door: p.door } : {}), open: open(p) })),
    population: living(world).length,
  };
}

/** Evento como lo ve el visor: tipo, fecha, participantes, datos y causas. */
export function eventView(world: World, e: WorldEvent) {
  return {
    id: e.id,
    type: e.type,
    at: e.at,
    date: dateOf(world, e.at),
    participants: e.participants.map((p) => ({ id: p.id, role: p.role, name: nameOf(world, p.id) })),
    payload: e.payload,
    causes: e.causes.map((c) => ('event' in c ? { event: c.event, weight: c.weight } : { state: c.state, value: c.value ?? null, weight: c.weight })),
  };
}

export function nameOf(world: World, id: string): string | null {
  if (id.startsWith('CIT')) {
    const c = world.citizens.get(id as EntityId);
    return c?.name ? `${c.name.given} ${c.name.family.join(' ')}` : null;
  }
  if (id.startsWith('ORG')) return world.organizations.get(id as EntityId)?.name ?? null;
  if (id.startsWith('PLC')) return world.places.get(id as EntityId)?.name ?? null;
  return null;
}

const columnsWith = (world: World, prefix: string, row: number) =>
  Object.fromEntries(
    Object.entries(world.components.f32)
      .filter(([k]) => k.startsWith(prefix))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => [k.slice(prefix.length), round(v![row] ?? 0)]),
  );

/** 022 `/api/citizens/:id`: la ficha que muestra el inspector (024 R-003). `events`, los últimos de la persona. */
export function citizenDetail(world: World, id: EntityId, events: readonly WorldEvent[]) {
  const c = world.citizens.get(id);
  if (!c || c.ancestor) return undefined;
  const row = idNumber(id);
  const i = world.components.i32;
  const f = world.components.f32;
  const place = i['loc.place']?.[row] ?? 0;
  const household = c.householdId ? world.households.get(c.householdId) : undefined;
  const occ = c.occupation;
  const org = occ && 'orgId' in occ ? world.organizations.get(occ.orgId as EntityId) : undefined;
  return {
    id,
    name: c.name ? `${c.name.given} ${c.name.family.join(' ')}` : id,
    sex: c.sex ?? null,
    age: Math.floor((world.now - (i['demo.birthMinute']?.[row] ?? 0)) / YEAR),
    occupation: occ ? { ...occ, ...(org ? { orgName: org.name } : {}) } : null,
    household: household ? { id: household.id, members: household.memberIds.length } : null,
    money: i.money?.[row] ?? null,
    activity: ACTIVITY_NAME[world.components.u8[ACTIVITY_COLUMN]?.[row] ?? 0] ?? 'idle',
    place: place > 0 ? { id: formatId('PLC', place), name: world.places.get(formatId('PLC', place))?.name ?? '' } : null,
    moving: (i['trip.to']?.[row] ?? 0) > 0,
    state: { mood: round(f['state.mood']?.[row] ?? 0), stress: round(f['state.stress']?.[row] ?? 0) },
    needs: columnsWith(world, 'need.', row),
    emotions: columnsWith(world, 'emo.', row),
    temperament: columnsWith(world, 'pers.', row),
    learned: {
      discountK: round(f['hist.discountK']?.[row] ?? 0, 3),
      variability: round(f['hist.variability']?.[row] ?? 0),
    },
    functions: [...(c.functions?.f ?? [])]
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v) || (a.s < b.s ? -1 : 1))
      .slice(0, 8)
      .map((x) => ({ stimulus: x.s, value: round(x.v), trials: x.n, sources: x.src })),
    responses: [...(c.functions?.r ?? [])].sort((a, b) => b.w - a.w).slice(0, 8).map((x) => ({ response: x.r, strength: round(x.w) })),
    rules: (c.rules ?? []).map((r) => ({ response: r.resp, consequence: r.cons, kind: kindOf(r), speaker: r.speaker ?? null, strength: round(r.s), contrast: round(r.contrast), contribution: round(ruleContribution(r)) })),
    relations: (c.network?.e ?? []).map((r) => ({ a: r.a, b: r.b, type: r.t, strength: round(r.s), context: r.crel ?? null })),
    // Vínculos (012): el afecto de cada lado sale del almacén de cada uno (INV-003).
    bonds: [...(c.bonds ?? [])]
      .sort((a, b) => (b.familiarity ?? 0) - (a.familiarity ?? 0) || (a.with < b.with ? -1 : 1))
      .slice(0, 15)
      .map((b) => ({
        id: b.with, name: nameOf(world, b.with), labels: b.labels ?? [], familiarity: round(b.familiarity ?? 0), tension: round(b.tension), trust: round(b.trust),
        encounters: b.encounters ?? 0, affection: round(affectionFor(c.functions, b.with)), affectionBack: round(affectionFor(world.citizens.get(b.with)?.functions, id)),
      })),
    // Apego como métrica (012 P4), para la capa clínica.
    attachment: attachmentOf(c.functions, [c.motherId, c.fatherId].filter((x): x is EntityId => !!x)),
    events: events.map((e) => eventView(world, e)),
  };
}
