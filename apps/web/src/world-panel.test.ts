import { describe, expect, it } from 'vitest';
import { labelYs, renderWorldPanel, topEvents } from './world-panel.ts';
import type { Metrics } from './world-panel.ts';

// Panel del mundo (024 R-011, CA-008).
const day = (d: number, mood: number) => ({ day: d, date: `2027-01-0${d + 1}`, n: 3, mood, moodSd: 0.1, stress: 0.3, stressSd: 0.05, money: 1500 + d, saturated: 0 });
const metrics: Metrics = {
  days: [day(0, 0.5), day(1, 0.55), day(2, 0.6)],
  events: { ARGUMENT: [1, 2, 3], WORK_SHIFT: [9, 9, 9], MEAL: [5, 5, 5], SLEEP: [3, 3, 3], PURCHASE: [2, 2, 2], RUMOR_TOLD: [0, 1, 0] },
  alerts: [{ metric: 'animo', kind: 'sin_variacion', note: 'Todos tienen casi el mismo ánimo (desviación 0.004).' }, { metric: 'dinero', kind: 'crecimiento', note: '«dinero» lleva 30 días subiendo sin parar.' }],
};

describe('024 R-011: panel del mundo', () => {
  it('CA-008: una serie por métrica (ánimo y estrés con franja, dinero, 5 tipos de evento) y cada alerta de la API', () => {
    const html = renderWorldPanel(metrics);
    expect(html.match(/<figure class="chart">/g)).toHaveLength(3);
    expect(html.match(/<path class="series"/g)).toHaveLength(2 + 1 + 5);
    expect(html.match(/<path class="band"/g)).toHaveLength(2);
    for (const a of metrics.alerts) expect(html).toContain(a.note.replace(/</g, '&lt;'));
    expect(html).toContain('/api/export/trajectory.csv');
    expect(html).toContain('/api/export/events.csv');
    // Una columna de cursor por día en cada gráfica y leyenda solo con dos o más series.
    expect(html.match(/<rect class="hit"/g)).toHaveLength(3 * 3);
    expect(html.match(/<p class="legend">/g)).toHaveLength(2);
    // Etiqueta directa hasta 4 series (ánimo, estrés, dinero); con 5, solo la leyenda.
    expect(html.match(/<text class="label"/g)).toHaveLength(3);
  });

  it('los eventos más frecuentes, como mucho 5, en orden de total; sin trayectoria, un aviso y la exportación', () => {
    expect(topEvents(metrics.events).map(([t]) => t)).toEqual(['WORK_SHIFT', 'MEAL', 'SLEEP', 'ARGUMENT', 'PURCHASE']);
    const empty = renderWorldPanel({ days: [], events: {}, alerts: [] });
    expect(empty).toContain('Sin alertas');
    expect(empty).toContain('Aún no hay trayectoria');
    expect(empty).not.toContain('<figure');
  });

  it('las etiquetas directas no se pisan: al menos 12 px entre ellas, sin cambiar el orden', () => {
    expect(labelYs([50, 45, 100])).toEqual([57, 45, 100]);
  });
});
