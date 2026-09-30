import { describe, expect, it } from 'vitest';
import { banner, momentAt, urlsFor } from './timeline.ts';

// Línea temporal (024 R-010, CA-007).
const days = [{ day: 0, date: '2027-01-01' }, { day: 1, date: '2027-01-02' }, { day: Number.POSITIVE_INFINITY, date: 'hoy' }];

describe('024 R-010: línea temporal', () => {
  it('CA-007: un día pasado pide sus datos a la 022 R-009 y muestra el aviso; el final del deslizador es el presente', () => {
    const past = momentAt(days, 1);
    expect(past).toEqual({ mode: 'past', day: 1, date: '2027-01-02' });
    expect(urlsFor(past).citizens).toBe('/api/days/1/citizens');
    expect(urlsFor(past).citizen('CIT-000007')).toBe('/api/days/1/citizens/CIT-000007');
    expect(banner(past)).toContain('2027-01-02');
    const live = momentAt(days, 2);
    expect(live).toEqual({ mode: 'live' });
    expect(urlsFor(live).citizens).toBe('/api/citizens');
    expect(urlsFor(live).citizen('CIT-000007')).toBe('/api/citizens/CIT-000007');
    expect(banner(live)).toBe('');
  });
});
