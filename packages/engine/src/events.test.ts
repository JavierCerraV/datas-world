import { describe, expect, it } from 'vitest';
import { EVENT_TYPES, eventText, makeEvent } from './events.ts';
import { emptyCounters } from './ids.ts';
import type { EventType } from './events.ts';

describe('Eventos (spec 014)', () => {
  it('asigna ids EVT secuenciales e importancia base del catálogo', () => {
    const c = emptyCounters();
    const e1 = makeEvent(c, 0, { type: 'DAY_STARTED', payload: { date: '2027-01-05' }, causes: [{ state: 'clock', value: 1440, weight: 1 }] });
    const e2 = makeEvent(c, 0, { type: 'DAY_STARTED', payload: { date: '2027-01-06' }, causes: [{ state: 'clock', value: 2880, weight: 1 }] });
    expect([e1.id, e2.id]).toEqual(['EVT-00000000001', 'EVT-00000000002']);
    expect(e1.importance).toBe(EVENT_TYPES.DAY_STARTED.baseImportance);
    expect(e1.origin).toBe('engine');
  });

  it('CA-001: un evento no espontáneo sin causas falla', () => {
    const nonSpontaneous = (Object.keys(EVENT_TYPES) as EventType[]).filter((t) => !EVENT_TYPES[t].spontaneous);
    expect(nonSpontaneous.length).toBeGreaterThan(0);
    for (const type of nonSpontaneous) {
      expect(() => makeEvent(emptyCounters(), 0, { type, payload: {}, causes: [] })).toThrow(/causa/);
    }
  });

  it('CA-002: un payload inválido hace fallar la creación', () => {
    expect(() =>
      makeEvent(emptyCounters(), 0, { type: 'DAY_STARTED', payload: { date: 5 }, causes: [{ state: 'clock', weight: 1 }] }),
    ).toThrow(/payload/);
    expect(() =>
      makeEvent(emptyCounters(), 0, { type: 'SPEED_CHANGED', payload: { from: 1, to: 7 }, causes: [{ state: 'x', weight: 1 }] }),
    ).toThrow(/payload/);
  });

  it('rechaza importancia fuera de [0,1] y pesos de causa inválidos', () => {
    const base = { type: 'DAY_STARTED' as const, payload: { date: '2027-01-05' } };
    expect(() => makeEvent(emptyCounters(), 0, { ...base, importance: 1.5, causes: [{ state: 'clock', weight: 1 }] })).toThrow();
    expect(() => makeEvent(emptyCounters(), 0, { ...base, causes: [{ state: 'clock', weight: Number.NaN }] })).toThrow();
  });

  it('CA-003: cada tipo del catálogo genera su texto en español por plantilla', () => {
    const c = emptyCounters();
    const e = makeEvent(c, 0, { type: 'DAY_STARTED', payload: { date: '2027-01-05' }, causes: [{ state: 'clock', weight: 1 }] });
    expect(eventText(e)).toBe('Comienza el día 2027-01-05.');
    const s = makeEvent(c, 0, {
      type: 'SPEED_CHANGED',
      payload: { from: 1, to: 1000 },
      causes: [{ event: e.id, weight: 1 }],
      origin: 'external',
    });
    expect(eventText(s)).toBe('La velocidad cambia de 1x a 1000x.');
    for (const def of Object.values(EVENT_TYPES)) expect(typeof def.text).toBe('function');
  });

  it('los eventos creados son inmutables (R-003)', () => {
    const e = makeEvent(emptyCounters(), 0, { type: 'DAY_STARTED', payload: { date: '2027-01-05' }, causes: [{ state: 'clock', weight: 1 }] });
    expect(() => {
      (e as { at: number }).at = 5;
    }).toThrow();
    expect(() => {
      (e.causes as unknown[]).push({});
    }).toThrow();
  });
});
