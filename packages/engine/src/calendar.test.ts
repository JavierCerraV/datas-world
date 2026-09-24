import { describe, expect, it } from 'vitest';
import { civilFromDays, daysFromCivil, formatDate, parseEpoch, toCalendar } from './calendar.ts';

const EPOCH = '2027-01-04T00:00';

describe('Calendario (spec 002)', () => {
  it('CA-001: epoch 2027-01-04 + 31 días 08:32 es jueves 2027-02-04 08:32', () => {
    const v = toCalendar(1440 * 31 + 8 * 60 + 32, EPOCH);
    expect(v).toMatchObject({ year: 2027, month: 2, day: 4, hour: 8, minute: 32, weekday: 3, isWeekend: false });
  });

  it('el epoch 2027-01-04 es lunes (weekday 0)', () => {
    expect(toCalendar(0, EPOCH).weekday).toBe(0);
    expect(toCalendar(5 * 1440, EPOCH)).toMatchObject({ weekday: 5, isWeekend: true });
  });

  it('marca festivos de la configuración', () => {
    const v = toCalendar(1440 * 3, EPOCH, ['2027-01-07']);
    expect(v.isHoliday).toBe(true);
    expect(toCalendar(1440 * 4, EPOCH, ['2027-01-07']).isHoliday).toBe(false);
  });

  it('años bisiestos y cambio de año', () => {
    expect(civilFromDays(daysFromCivil(2028, 2, 29))).toEqual({ year: 2028, month: 2, day: 29 });
    expect(daysFromCivil(2028, 3, 1) - daysFromCivil(2028, 2, 28)).toBe(2);
    expect(daysFromCivil(2027, 3, 1) - daysFromCivil(2027, 2, 28)).toBe(1);
    expect(formatDate(toCalendar(1440 * 362, EPOCH))).toBe('2028-01-01');
  });

  it('daysFromCivil y civilFromDays son inversas en un rango amplio', () => {
    for (let z = -800_000; z <= 800_000; z += 997) expect(daysFromCivil(...Object.values(civilFromDays(z)) as [number, number, number])).toBe(z);
  });

  it('parseEpoch valida el formato', () => {
    expect(parseEpoch(EPOCH)).toEqual({ year: 2027, month: 1, day: 4, hour: 0, minute: 0 });
    expect(() => parseEpoch('2027-13-01T00:00')).toThrow();
    expect(() => parseEpoch('2027-02-30T00:00')).toThrow();
    expect(() => parseEpoch('04/01/2027')).toThrow();
  });
});
