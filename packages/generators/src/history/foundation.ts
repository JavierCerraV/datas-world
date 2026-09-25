// Fundación del municipio, sus barrios, lugares y organizaciones, y hechos históricos (spec 030 R-003, R-006).
import { makeEvent, setFoundedAt } from '@datas-world/engine';
import type { EntityId, Rng, World, WorldEvent } from '@datas-world/engine';
import type { Territory } from '../geography/generate.ts';
import type { PlacesResult } from '../places/generate.ts';
import { activeWith } from './params.ts';
import type { Clock, HistoricalEvent, HistoryParams } from './params.ts';

const YEAR_DAYS = 365;
const DAY = 1440;

export interface FoundationResult {
  events: WorldEvent[];
  /** Evento HISTORICAL_CONTEXT de cada hecho, por clave. */
  context: Map<string, WorldEvent>;
  townEvent: WorldEvent;
}

/** Un evento de contexto por hecho del catálogo; los que empezaron antes de 1900 se fechan el 1-ene de ese año (INV-001). */
export function contextEvents(world: World, history: readonly HistoricalEvent[], P: HistoryParams, clock: Clock): Map<string, WorldEvent> {
  const out = new Map<string, WorldEvent>();
  const floor = clock.at(P.foundingYear);
  for (const h of history) {
    const [y, m, d] = h.start.split('-').map(Number) as [number, number, number];
    const at = Math.max(clock.at(y, m, d), floor);
    if (at >= 0) continue;
    out.set(h.key, makeEvent(world.counters, at, {
      type: 'HISTORICAL_CONTEXT',
      payload: { key: h.key, name: h.name, start: h.start, end: h.end },
      causes: [{ state: 'historia_nacional', weight: 1 }],
    }));
  }
  return out;
}

/**
 * 030 R-003: el municipio se funda en `foundingYear` con el barrio fundacional; los demás barrios nacen en su
 * década de la plantilla (con la migración vigente como causa). Cada lugar se construye después de su barrio y
 * cada organización después de su lugar y antes de su primera contratación (INV-003).
 */
export function generateFoundation(
  world: World,
  territory: Territory,
  places: PlacesResult,
  orgIds: readonly EntityId[],
  priorEvents: readonly WorldEvent[],
  history: readonly HistoricalEvent[],
  context: Map<string, WorldEvent>,
  P: HistoryParams,
  clock: Clock,
  rng: Rng,
): FoundationResult {
  const events: WorldEvent[] = [];
  const r = rng.fork('hist:foundation');
  const townAt = clock.randomDay(r, P.foundingYear);
  const municipality = world.places.get(territory.municipalityId)!;
  setFoundedAt(world, territory.municipalityId, townAt);
  setFoundedAt(world, territory.comunaId, townAt);
  const townEvent = makeEvent(world.counters, townAt, {
    type: 'TOWN_FOUNDED',
    payload: { placeId: territory.municipalityId, name: municipality.name, year: P.foundingYear },
    causes: [{ state: 'historia', weight: 1 }],
  });
  events.push(townEvent);

  const districtAt = new Map<EntityId, number>();
  const districtEvent = new Map<EntityId, WorldEvent>();
  territory.template.districts.forEach((d, i) => {
    const id = territory.districtIds[i]!;
    const year = Math.max(d.foundedDecade + r.int(0, 9), P.foundingYear);
    const at = d.foundedDecade <= P.foundingYear ? townAt : Math.max(clock.randomDay(r, year), townAt);
    setFoundedAt(world, id, at);
    districtAt.set(id, at);
    const drivers = activeWith(history, year, ['ruralUrbanMigration', 'urbanGrowth', 'displacement'])
      .map((h) => context.get(h.key))
      .filter((e): e is WorldEvent => e !== undefined);
    const e = makeEvent(world.counters, at, {
      type: 'DISTRICT_FOUNDED',
      payload: { placeId: id, name: d.name },
      causes: [{ event: townEvent.id, weight: 0.5 }, ...drivers.map((h) => ({ event: h.id, weight: 0.5 }))],
    });
    events.push(e);
    districtEvent.set(id, e);
  });

  // Primera contratación de cada organización (bloque G): la fundación debe ser anterior.
  const firstHire = new Map<string, number>();
  for (const e of priorEvents) {
    if (e.type !== 'JOB_HIRED') continue;
    const org = (e.payload as { orgId: string }).orgId;
    firstHire.set(org, Math.min(firstHire.get(org) ?? 0, e.at));
  }
  const orgOfPlace = new Map<EntityId, EntityId>();
  for (const o of orgIds) orgOfPlace.set(world.organizations.get(o)!.placeIds[0]!, o);

  for (const { placeId, dwellingIds } of places.plots) {
    const place = world.places.get(placeId)!;
    const from = districtAt.get(place.districtId!)!;
    const orgId = orgOfPlace.get(placeId);
    const limit = Math.min(orgId ? (firstHire.get(orgId) ?? -DAY) - 2 * YEAR_DAYS * DAY : -DAY, -DAY);
    const span = Math.max(0, Math.floor((limit - from) / DAY));
    const builtAt = from + r.int(0, Math.min(span, 40 * YEAR_DAYS)) * DAY;
    setFoundedAt(world, placeId, builtAt);
    for (const u of dwellingIds) setFoundedAt(world, u, builtAt);
    const built = makeEvent(world.counters, builtAt, {
      type: 'PLACE_BUILT',
      payload: { placeId, name: place.name, kind: place.kind },
      causes: [{ event: districtEvent.get(place.districtId!)!.id, weight: 1 }],
    });
    events.push(built);
    if (orgId) {
      const org = world.organizations.get(orgId)!;
      const orgSpan = Math.max(0, Math.floor((limit - builtAt) / DAY));
      const foundedAt = builtAt + r.int(0, Math.min(orgSpan, 365)) * DAY;
      setFoundedAt(world, orgId, foundedAt);
      events.push(makeEvent(world.counters, foundedAt, {
        type: 'ORG_FOUNDED',
        payload: { orgId, name: org.name },
        causes: [{ event: built.id, weight: 1 }],
      }));
    }
  }
  return { events, context, townEvent };
}
