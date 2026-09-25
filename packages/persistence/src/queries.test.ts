import { addCitizen, addPlace, createGeoMap, createWorld, makeEvent } from '@datas-world/engine';
import type { WorldEvent } from '@datas-world/engine';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDb, openWorldDb } from './db.ts';
import { eventsById, queryEvents } from './queries.ts';
import { WorldRepository } from './repository.ts';
import { tempDir, testConfig } from './testing.ts';

let tmp = tempDir();
afterEach(() => {
  tmp.cleanup();
  tmp = tempDir();
});

describe('consultas del registro de eventos (030 R-008)', () => {
  it('filtran por fecha, tipo, participante y lugar, en orden cronológico', () => {
    const { world, events } = createWorld(testConfig());
    world.geo = createGeoMap(4, 4, 10);
    const plc = addPlace(world, { kind: 'ocio.cafe', name: 'Café' });
    const a = addCitizen(world);
    const b = addCitizen(world);
    const ev = (at: number, type: 'CITIZEN_BORN' | 'UNION_FORMED', payload: object, ids: string[]): WorldEvent =>
      makeEvent(world.counters, at, {
        type,
        payload,
        participants: ids.map((id) => ({ id: id as typeof a, role: 'x' })),
        causes: [{ state: 'prueba', weight: 1 }],
      });
    // Creados en un orden distinto del cronológico: la consulta los ordena por `at`.
    const later = ev(-1000, 'UNION_FORMED', { a, b }, [a, b]);
    const earlier = ev(-5000, 'CITIZEN_BORN', { citizenId: a, placeName: 'Café' }, [a]);
    const born = { ...ev(-3000, 'CITIZEN_BORN', { citizenId: b, placeName: 'Café' }, [b]), placeId: plc };
    const db = openWorldDb(tmp.file('q.db'));
    new WorldRepository(db).flush({ world, events: [...events, later, earlier, born] });

    expect(queryEvents(db, { to: 0 }).map((e) => e.id)).toEqual([earlier.id, born.id, later.id]);
    expect(queryEvents(db, { from: -4000, to: 0 }).map((e) => e.id)).toEqual([born.id, later.id]);
    expect(queryEvents(db, { types: ['UNION_FORMED'] }).map((e) => e.id)).toEqual([later.id]);
    expect(queryEvents(db, { participant: a }).map((e) => e.id)).toEqual([earlier.id, later.id]);
    expect(queryEvents(db, { place: plc }).map((e) => e.id)).toEqual([born.id]);
    expect(queryEvents(db, { limit: 1 })).toHaveLength(1);
    expect(eventsById(db, [later.id, 'EVT-99999999' as typeof later.id]).map((e) => e.payload)).toEqual([{ a, b }]);
    closeDb(db);
  });
});
