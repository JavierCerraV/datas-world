import { describe, expect, it } from 'vitest';
import { createScheduler, popDue, schedule, sortedItems } from './scheduler.ts';
import type { ScheduledItem } from './scheduler.ts';

const item = (at: number, n: number): ScheduledItem => ({
  at,
  id: `TSK-${String(n).padStart(9, '0')}`,
  kind: 'TEST',
  payload: n,
});

describe('Scheduler (spec 002 R-004)', () => {
  it('CA-003: dos elementos en el mismo minuto salen en orden de id', () => {
    const s = createScheduler();
    schedule(s, item(60, 9));
    schedule(s, item(60, 2));
    schedule(s, item(60, 5));
    expect(popDue(s, 60).map((i) => i.payload)).toEqual([2, 5, 9]);
  });

  it('solo extrae lo que vence y en orden (at, id)', () => {
    const s = createScheduler();
    [item(30, 5), item(10, 3), item(20, 2), item(10, 1), item(40, 4)].forEach((i) => schedule(s, i));
    expect(popDue(s, 20).map((i) => [i.at, i.payload])).toEqual([
      [10, 1],
      [10, 3],
      [20, 2],
    ]);
    expect(popDue(s, 20)).toEqual([]);
    expect(sortedItems(s).map((i) => i.at)).toEqual([30, 40]);
  });

  it('el resultado no depende del orden de inserción', () => {
    const items = Array.from({ length: 200 }, (_, n) => item((n * 37) % 50, n + 1));
    const a = createScheduler();
    const b = createScheduler();
    items.forEach((i) => schedule(a, i));
    [...items].reverse().forEach((i) => schedule(b, i));
    expect(popDue(a, 100)).toEqual(popDue(b, 100));
  });

  it('rechaza ids duplicados', () => {
    const s = createScheduler();
    schedule(s, item(10, 1));
    expect(() => schedule(s, item(20, 1))).toThrow();
  });
});
