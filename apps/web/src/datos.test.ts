// Retrato, carga y datos (spec 024 v0.6: R-025 a R-027; CA-018 a CA-020).
import { describe, expect, it } from 'vitest';
import { hbarsSvg, histogramSvg, unitLabels } from './dash-charts.ts';
import { renderDashboard } from './dashboard.ts';
import type { Demographics } from './dossier-types.ts';
import { skeleton, skeletonTab } from './loading.ts';
import { lookOf } from './logic.ts';
import { layout3d, project } from './network3d.ts';
import type { Network } from './network3d.ts';
import { PORTRAIT_H, PORTRAIT_W, portraitRects, portraitSvg } from './portrait.ts';

describe('024 R-025: retrato pixel art', () => {
  it('CA-018: el mismo en cada llamada, con los colores de su figura, y distinto entre personas', () => {
    const a = portraitRects('CIT-000019');
    expect(portraitRects('CIT-000019')).toEqual(a);
    const l = lookOf('CIT-000019');
    const colors = new Set(a.map((r) => r[4]));
    for (const c of [l.hair, l.skin, l.shirt]) expect(colors.has(c)).toBe(true);
    for (const [x, y, w, h] of a) {
      expect(x + w).toBeLessThanOrEqual(PORTRAIT_W);
      expect(y + h).toBeLessThanOrEqual(PORTRAIT_H);
    }
    const distinct = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(portraitRects(`CIT-${String(i + 1).padStart(6, '0')}`))));
    expect(distinct.size).toBeGreaterThan(30);
    const svg = portraitSvg('CIT-000019', 'Santiago Osorio', 5);
    expect(svg).toContain('width="60" height="70"');
    expect(svg).toContain('aria-label="Retrato de Santiago Osorio"');
    expect(svg).toContain('shape-rendering="crispEdges"');
  });
});

describe('024 R-026: indicador de carga', () => {
  it('CA-019: el esqueleto se anuncia como ocupado y dice qué carga', () => {
    const s = skeleton('sus recuerdos', 3);
    expect(s).toContain('aria-busy="true"');
    expect(s).toContain('Cargando sus recuerdos…');
    expect(s.match(/<i /g)).toHaveLength(3);
    expect(skeletonTab('el expediente').match(/aria-busy/g)).toHaveLength(2);
  });
});

describe('024 R-027: datos del mundo', () => {
  it('CA-020: el histograma dibuja una columna por tramo con gente y su valor al pasar el cursor', () => {
    const h = histogramSvg([0, 1, 15, 36, 33, 83, 30, 1, 0, 0], unitLabels, 'Ánimo');
    expect(h.match(/<path class="bar"/g)).toHaveLength(7);
    expect(h).toContain('<title>0,5: 83</title>');
    const b = hbarsSvg([{ label: 'Textiles del Sur', count: 7 }, { label: 'Hospital', count: 0 }], 0, 'Empleo');
    expect(b.match(/<path class="bar"/g)).toHaveLength(1);
    expect(b).toContain('Textiles del Sur: 7');
  });

  it('CA-020: el dashboard muestra las distribuciones cuando la API las trae', () => {
    const g: Demographics = {
      date: '2026-01-08 00:00', period: 'year', population: 3, women: 2, men: 1, births: { count: 0, perThousand: 0 }, deaths: { count: 0, perThousand: 0 },
      households: { count: 1, meanSize: 3 }, organizations: 1, pyramid: [{ group: '30–39', F: 2, M: 1 }], occupations: [{ name: 'Empleo formal', count: 3 }], now: [],
      moodMean: 0.49, employedPct: 0.79, mood: [0, 0, 0, 0, 3, 0, 0, 0, 0, 0], stress: [3, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      money: { bins: [{ label: '< 500 mil', count: 3 }], median: 821305, gini: 0.636 }, householdSizes: [{ size: '3', count: 1 }], employers: [{ id: 'ORG-0016', name: 'Textiles del Sur', count: 3 }],
    };
    const d = renderDashboard(g, new Set(['stress']));
    expect(d).toContain('Ánimo medio');
    expect(d).toContain('79 %');
    expect(d).toContain('Distribución del dinero');
    expect(d).toContain('Gini 0,64');
    expect(d).toContain('<th>Estrés</th>'); // el estrés, como tabla
  });

  it('CA-020: la red 3D se coloca igual en dos llamadas, sin NaN, y la proyección respeta la rotación', () => {
    const net: Network = {
      nodes: ['A', 'B', 'C', 'D'].map((x, i) => ({ id: `CIT-00000${i}`, name: x, age: 30, sex: 'F', district: 'Centro', household: null, mood: 0.5 })),
      edges: [{ a: 'CIT-000000', b: 'CIT-000001', kind: 'pareja', familiarity: 1, tension: 0 }, { a: 'CIT-000001', b: 'CIT-000002', kind: 'familia', familiarity: 1, tension: 0 }],
    };
    const a = layout3d(net, 60);
    const b = layout3d(net, 60);
    expect([...a]).toEqual([...b]);
    for (const v of a.values()) for (const c of v) expect(Number.isFinite(c)).toBe(true);
    for (const v of a.values()) expect(Math.hypot(...v)).toBeLessThanOrEqual(1 + 1e-9);
    // La pareja queda más cerca que dos personas sin vínculo.
    const d = (x: string, y: string) => Math.hypot(...a.get(x)!.map((c, i) => c - a.get(y)![i]!));
    expect(d('CIT-000000', 'CIT-000001')).toBeLessThan(d('CIT-000000', 'CIT-000003'));
    // Sin giro, un punto delante del centro sale en su sitio; girar 180° lo refleja.
    const p0 = project([0.5, 0, 0], 0, 0, 100, 0, 0);
    const p1 = project([0.5, 0, 0], Math.PI, 0, 100, 0, 0);
    expect(p0.x).toBeCloseTo(50, 5);
    expect(p1.x).toBeCloseTo(-50, 5);
  });
});
