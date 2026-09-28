// Visor (spec 024): CA-002 (el inspector muestra la ficha de la API) y CA-004 (lógica determinista y probada).
import { describe, expect, it } from 'vitest';
import { causeEs, eventEs, inspectorTabs, stimulusEs } from './format.ts';
import { hash, interpolate, lookOf, nightAlpha, spread, styleOf, timeOf } from './logic.ts';
import type { CitizenDetail, CitizenPosition } from './types.ts';

const pos = (id: string, x: number | null, y: number | null): CitizenPosition => ({ id, name: id, x, y, activity: 'idle', placeId: null, moving: false, mood: 0.5 });

describe('024 CA-004: lógica pura del visor', () => {
  it('R-006: el aspecto sale del id, igual en cada llamada, con colores de las paletas del prototipo', () => {
    expect(lookOf('CIT-000042')).toEqual(lookOf('CIT-000042'));
    expect(hash('CIT-000001')).not.toBe(hash('CIT-000002'));
    const looks = new Set(Array.from({ length: 50 }, (_, i) => JSON.stringify(lookOf(`CIT-${String(i).padStart(6, '0')}`))));
    expect(looks.size).toBeGreaterThan(30);
    expect(lookOf('CIT-000042').skin).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('R-007: el velo nocturno es 0 de día, máximo de noche y sube de forma continua al atardecer', () => {
    expect(nightAlpha(12)).toBe(0);
    expect(nightAlpha(23)).toBe(0.45);
    expect(nightAlpha(3)).toBe(0.45);
    expect(nightAlpha(18, 30)).toBeCloseTo(0.225, 10);
    expect(nightAlpha(6)).toBeCloseTo(0.225, 10);
    expect(timeOf('2027-01-04 07:35')).toEqual({ hour: 7, minute: 35 });
  });

  it('R-002: la interpolación va de la posición anterior a la nueva; fuera del mapa no se dibuja', () => {
    const prev = new Map([['a', pos('a', 0, 0)]]);
    expect(interpolate(prev, [pos('a', 10, 20), pos('b', 1, 1), pos('c', null, null)], 0.5)).toEqual([
      { id: 'a', x: 5, y: 10 },
      { id: 'b', x: 1, y: 1 },
    ]);
    expect(interpolate(prev, [pos('a', 10, 20)], 2)).toEqual([{ id: 'a', x: 10, y: 20 }]);
  });

  it('varias personas en la misma puerta se reparten para verse; una sola queda en su sitio', () => {
    const one = spread([{ id: 'a', x: 3, y: 3 }]);
    expect(one).toEqual([{ id: 'a', x: 3, y: 3 }]);
    const many = spread(Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, x: 3, y: 3 })));
    expect(new Set(many.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)).size).toBe(4);
    expect(styleOf('ocio.cafe', 'PLC-1').roof).toBe('#6E4630');
    expect(styleOf('vivienda.unidad', 'PLC-7')).toEqual(styleOf('vivienda.unidad', 'PLC-7'));
  });
});

describe('024 CA-002: el inspector muestra la ficha de /api/citizens/:id', () => {
  const detail: CitizenDetail = {
    id: 'CIT-000042',
    name: 'Ana Rojas Gómez',
    sex: 'F',
    age: 34,
    occupation: { kind: 'none', reason: 'unemployed' },
    household: { id: 'HOU-0001', members: 3 },
    money: 125000,
    activity: 'job_search',
    place: { id: 'PLC-0010', name: 'Vivienda 3' },
    moving: false,
    state: { mood: 0.46, stress: 0.3 },
    needs: { hunger: 0.8, energy: 0.55 },
    emotions: { fear: 0.2 },
    temperament: {},
    learned: { discountK: 0.2, variability: 0.5 },
    functions: [{ stimulus: 'verbal.despido', value: -0.62, trials: 2, sources: ['EVT-1'] }],
    responses: [],
    rules: [{ response: 'rutina.job_search', consequence: 'verbal.trabajo', kind: 'tracking', speaker: 'comunidad', strength: 0.45, contrast: 0.3, contribution: 0.31 }],
    relations: [{ a: 'verbal.llegar_tarde', b: 'verbal.despido', type: 'causes', strength: 0.6, context: null }],
    events: [
      {
        id: 'EVT-00000000005',
        type: 'LEISURE_DONE',
        at: 100,
        date: '2027-01-04 19:00',
        participants: [{ id: 'CIT-000042', role: 'persona', name: 'Ana Rojas Gómez' }],
        payload: { name: 'Ver series' },
        causes: [
          { state: 'fuente.reforzador:need.fun', value: 0.6, weight: 0.5 },
          { event: 'EVT-00000000002', weight: 0.1 },
        ],
      },
    ],
  };

  it('Estado, Historia y Funcional con los valores de la ficha', () => {
    const t = inspectorTabs(detail);
    const all = t.estado.flatMap((s) => s.rows.map((r) => `${r.label}: ${r.value}`));
    expect(all).toContain('Qué hace: buscando empleo');
    expect(all).toContain('Dónde: Vivienda 3');
    expect(all).toContain('Ánimo: 46 %');
    expect(all).toContain('Ocupación: desempleado/a');
    expect(all).toContain('Alimentación: 80 %');
    expect(all).toContain('Miedo: 20 %');
    expect(t.historia).toEqual([{ line: '2027-01-04 19:00 · Tiempo libre: Ver series — Ana Rojas Gómez', causes: ['reforzador: diversión (0.6)', 'por un hecho anterior (EVT-00000000002)'] }]);
    const f = t.funcional.flatMap((s) => s.rows.map((r) => `${r.label}: ${r.value}`));
    expect(f).toContain('despido: desagradable 62 % · 2 veces');
    expect(f).toContain('buscando empleo (rutina) → trabajo: le funciona (tracking) · peso 0.31');
    expect(f).toContain('llegar tarde lleva a despido: 60 %');
  });

  it('012 R6: los vínculos con el afecto de cada lado y el apego como métrica', () => {
    const t = inspectorTabs({
      ...detail,
      bonds: [
        { id: 'CIT-000002', name: 'Luis Rojas', labels: ['familia', 'pareja'], familiarity: 0.93, tension: 0.3, trust: 0.6, encounters: 40, affection: 0.21, affectionBack: -0.05 },
        { id: 'CIT-000009', name: 'Marta Díaz', labels: ['amigo', 'conocido'], familiarity: 0.5, tension: 0, trust: 0.5, encounters: 12, affection: 0.18, affectionBack: 0.16 },
      ],
      attachment: { security: 0.62, avoidance: 0.35, style: 'seguro' },
    });
    const bonds = t.estado.find((s) => s.title === 'Vínculos')!.rows.map((r) => `${r.label}: ${r.value}`);
    expect(bonds).toEqual([
      'Luis Rojas (familia, pareja): trato 93 % · afecto +21 / -5 · tensión 30 %',
      'Marta Díaz (amistad): trato 50 % · afecto +18 / +16',
    ]);
    const f = t.funcional.flatMap((s) => s.rows.map((r) => `${r.label}: ${r.value}`));
    expect(f).toContain('Estilo: seguro');
    expect(f).toContain('Seguridad con quienes le criaron: 62 %');
  });

  it('estímulos, causas y eventos legibles', () => {
    expect(stimulusEs('actividad.deporte.futbol')).toBe('futbol (actividad)');
    expect(stimulusEs('dominio.amistad')).toBe('amistad (valor)');
    expect(causeEs({ state: 'deuda_de_sueno', value: 120, weight: 0.5 })).toBe('deuda de sueno (120)');
    expect(eventEs({ ...detail.events[0]!, type: 'NUEVO_TIPO', payload: {} })).toBe('2027-01-04 19:00 · NUEVO_TIPO — Ana Rojas Gómez');
  });
});
