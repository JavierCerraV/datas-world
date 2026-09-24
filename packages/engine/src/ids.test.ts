import { describe, expect, it } from 'vitest';
import { allocateId, emptyCounters, formatId, idKind, idNumber } from './ids.ts';

describe('Identificadores (spec 001 R-001)', () => {
  it('rellena con ceros según el tipo', () => {
    expect(formatId('CIT', 123)).toBe('CIT-000123');
    expect(formatId('ORG', 12)).toBe('ORG-0012');
    expect(formatId('EVT', 42)).toBe('EVT-00000000042');
    expect(formatId('TSK', 7)).toBe('TSK-000000007');
  });

  it('asigna ids secuenciales por tipo empezando en 1', () => {
    const c = emptyCounters();
    expect(allocateId(c, 'CIT')).toBe('CIT-000001');
    expect(allocateId(c, 'CIT')).toBe('CIT-000002');
    expect(allocateId(c, 'ORG')).toBe('ORG-0001');
    expect(c.CIT).toBe(2);
  });

  it('descompone un id en tipo y número', () => {
    expect(idKind('PLC-0040')).toBe('PLC');
    expect(idNumber('OBJ-001842')).toBe(1842);
    expect(() => idNumber('XYZ-1' as never)).toThrow();
  });

  it('rechaza números fuera del ancho del tipo', () => {
    expect(() => formatId('ORG', 10_000)).toThrow();
    expect(() => formatId('CIT', 0)).toThrow();
  });
});
