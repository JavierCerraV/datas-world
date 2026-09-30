// Visor (spec 024): CA-002 (el inspector muestra la ficha de la API) y CA-004 (lógica determinista y probada).
import { describe, expect, it } from 'vitest';
import { causeEs, eventEs, inspectorTabs, stimulusEs } from './format.ts';
import { clockOf, frameOf } from './camera.ts';
import { darkness } from './figures.ts';
import { hash, lookOf, styleOf } from './logic.ts';
import type { CitizenDetail } from './types.ts';

describe('024 CA-004: lógica pura del visor', () => {
  it('R-006: el aspecto sale del id, igual en cada llamada, con colores de las paletas del prototipo', () => {
    expect(lookOf('CIT-000042')).toEqual(lookOf('CIT-000042'));
    expect(hash('CIT-000001')).not.toBe(hash('CIT-000002'));
    const looks = new Set(Array.from({ length: 50 }, (_, i) => JSON.stringify(lookOf(`CIT-${String(i).padStart(6, '0')}`))));
    expect(looks.size).toBeGreaterThan(30);
    expect(lookOf('CIT-000042').skin).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('R-007: la noche del prototipo: 0 de día, 0,5 de noche y rampas continuas al amanecer y al atardecer', () => {
    expect(darkness(12 * 60)).toBe(0);
    expect(darkness(23 * 60)).toBe(0.5);
    expect(darkness(3 * 60)).toBe(0.5);
    expect(darkness(6 * 60)).toBeCloseTo(0.25, 10); // a mitad del amanecer (5:00 a 7:00)
    expect(darkness(18 * 60 + 75)).toBeCloseTo(0.25, 10); // a mitad del atardecer (18:00 a 20:30)
    expect(darkness(1440 + 23 * 60)).toBe(0.5); // cualquier día
    expect(styleOf('ocio.cafe', 'PLC-1').roof).toBe('#6E4630');
    expect(styleOf('vivienda.unidad', 'PLC-7')).toEqual(styleOf('vivienda.unidad', 'PLC-7'));
  });

  it('R-014: la cámara ajusta el mapa a su espacio, centrado, y escala entera desde ×3', () => {
    const f = frameOf({ x: 0, y: 0, z: 1 }, 800, 400, 640, 400);
    expect(f.s).toBe(1);
    expect([f.cx, f.cy]).toEqual([320, 200]); // cabe entero: centrado
    const z = frameOf({ x: 0, y: 0, z: 3.4 }, 800, 400, 640, 400);
    expect(z.s).toBe(3);
    expect(z.cx).toBeCloseTo(800 / 3 / 2, 5); // sin salirse del mapa
    expect(clockOf('2026-01-01T00:00', 1440 + 7 * 60 + 35)).toEqual({ time: '07:35', date: 'viernes 2 ene 2026', day: 'Día 2 de simulación', iso: '2026-01-02' });
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
    expect(t.historia).toEqual([{ id: expect.stringMatching(/^EVT-/) as unknown as string, line: '2027-01-04 19:00 · Tiempo libre: Ver series — Ana Rojas Gómez', causes: ['le gusta: diversión', 'un hecho anterior'] }]);
    const f = t.funcional.flatMap((s) => s.rows.map((r) => `${r.label}: ${r.value}`));
    expect(f).toContain('despido: desagradable 62 % · 2 veces');
    expect(f).toContain('buscando empleo (rutina) → trabajo: le funciona (tracking) · peso 0.31');
    expect(f).toContain('llegar tarde lleva a despido: 60 %');
  });

  it('025: lo que cree de otros, de quién lo sabe y, para quien observa, si es verdad', () => {
    const t = inspectorTabs({
      ...detail,
      beliefs: [
        { about: 'CIT-000002', name: 'Luis Rojas', predicate: 'perdio_el_empleo', topic: 'Perdió el empleo', source: 'visto', sourceName: null, credibility: 1, hops: 0, truth: true },
        { about: 'CIT-000009', name: 'Marta Díaz', predicate: 'lo_echaron_por_algo', topic: 'Lo echaron por algo que hizo', source: 'CIT-000005', sourceName: 'Pedro Gil', credibility: 0.42, hops: 2, truth: false },
      ],
    });
    const rows = t.estado.find((s) => s.title === 'Lo que cree de otros')!.rows.map((r) => `${r.label}: ${r.value}`);
    expect(rows).toEqual([
      'Luis Rojas: perdió el empleo: lo vio · 100 % · verdadero',
      'Marta Díaz: lo echaron por algo que hizo: se lo contó Pedro Gil · 42 % · falso',
    ]);
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
    expect(causeEs({ state: 'deuda_de_sueno', value: 120, weight: 0.5 })).toBe('deuda de sueño (120)');
    expect(causeEs({ event: 'EVT-000000029294', weight: 1 })).toBe('un hecho anterior');
    expect(causeEs({ state: 'mismo_lugar', value: null, weight: 1 })).toBe('estaban en el mismo lugar');
    expect(eventEs({ ...detail.events[0]!, type: 'NUEVO_TIPO', payload: {} })).toBe('2027-01-04 19:00 · NUEVO_TIPO — Ana Rojas Gómez');
  });
});
