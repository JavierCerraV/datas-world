import { describe, expect, it } from 'vitest';
import { isMinor, kindOf, linkNames, logRow, passes, stamp } from './log.ts';
import type { EventView } from './types.ts';

// Registro de eventos (024 R-016, CA-011).
const ev = (type: string, text: string): EventView => ({
  id: 'EVT-000010', type, at: 100, date: '2026-01-05 07:35', text,
  participants: [{ id: 'CIT-000001', role: 'a', name: 'Ana Ruiz' }, { id: 'CIT-000002', role: 'b', name: 'Luis Díaz' }],
  payload: {}, causes: [{ state: 'tension', value: 0.6, weight: 1 }],
});

describe('024 R-016: registro de eventos', () => {
  it('CA-011: cada tipo va a su categoría y los menores se ocultan salvo que se pidan', () => {
    expect(kindOf('ARGUMENT')).toEqual(['Discusión', 'bad', 'relaciones']);
    expect(kindOf('JOB_LOST')[2]).toBe('trabajo');
    expect(kindOf('RENT_LATE')[2]).toBe('economia');
    expect(kindOf('FELL_ILL')[2]).toBe('salud');
    expect(kindOf('RUMOR_TOLD')[2]).toBe('info');
    expect(kindOf('ALGO_NUEVO')).toEqual(['algo nuevo', 'info', 'info']);
    expect(passes('ARGUMENT', 'relaciones', false)).toBe(true);
    expect(passes('ARGUMENT', 'trabajo', false)).toBe(false);
    expect(passes('ARGUMENT', 'all', false)).toBe(true);
    expect(isMinor('LEISURE_DONE')).toBe(true);
    expect(passes('LEISURE_DONE', 'all', false)).toBe(false);
    expect(passes('LEISURE_DONE', 'all', true)).toBe(true);
    expect(passes('MET', 'relaciones', false)).toBe(false);
    expect(passes('MET', 'relaciones', true)).toBe(true);
  });

  it('el texto muestra a las personas como nombres pulsables, con la etiqueta y el porqué', () => {
    expect(linkNames('CIT-000001 y CIT-000002 discuten.', (id) => ({ 'CIT-000001': 'Ana', 'CIT-000002': 'Luis' })[id] ?? null)).toBe(
      '<button class="who" data-person="CIT-000001">Ana</button> y <button class="who" data-person="CIT-000002">Luis</button> discuten.',
    );
    const row = logRow(ev('ARGUMENT', 'CIT-000001 y CIT-000002 discuten (reprochar / defenderse).'), '2026-01-05');
    expect(row).toContain('<time>07:35</time>');
    expect(row).toContain('class="kind k-bad">Discusión<');
    expect(row).toContain('data-person="CIT-000002">Luis Díaz</button>');
    expect(row).toContain('Por qué: tensión entre ellos (0.60)');
    expect(stamp('2026-01-04 23:10', '2026-01-05')).toBe('04/01 23:10');
  });
});
