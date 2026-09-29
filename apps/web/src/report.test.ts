import { describe, expect, it } from 'vitest';
import { renderReport, trajectorySvg } from './report.ts';
import type { ReportView } from './report.ts';

// Sección «Informe» de la pestaña Vida (020 R-007).
const DAY = 1440;
const view: ReportView = {
  chapters: [
    { theme: 'trabajo', from: 0, to: 50 * DAY, tone: 0.4, date: '2027-01-01', opened: { id: 'EVT-00000000001', date: '2020-02-01', text: 'Ana empieza a trabajar.' } },
    { theme: 'desempleo', from: 50 * DAY, tone: -0.5, date: '2027-02-20', opened: { id: 'EVT-00000000002', date: '2027-02-20', text: 'Ana pierde su empleo.' } },
  ],
  remembered: [{ id: 'CHP-1', theme: 'trabajo', from: 0, to: 50 * DAY, tone: -0.4, date: '2027-01-01' }],
  divergences: [
    { chapter: -1, kind: 'tone', note: 'En general recuerda su vida peor de lo que fue.' },
    { chapter: 1, kind: 'missing', note: 'No cuenta el desempleo como una etapa de su vida.' },
  ],
  turningPoints: [{
    event: 'EVT-00000000002', consequences: 3, moodDelta: -0.25, fact: { id: 'EVT-00000000002', date: '2027-02-20', text: 'Ana pierde su empleo.' },
    why: { kind: 'event', ref: 'EVT-00000000002', text: 'Ana pierde su empleo', weight: 1, children: [{ kind: 'state', ref: 'caja_negativa', text: 'caja negativa', weight: 1, children: [] }] },
  }],
  profile: { values: { jobStability: 0.8, relationshipStability: null, socialNetwork: 0.3, stressorExposure: 0.5, economicTrajectory: 0.4, resilience: 0.9 }, basis: { jobStability: ['EVT-00000000001', 'EVT-00000000002'] } },
  trajectory: [{ day: 0, mood: 0.6, stress: 0.3, money: 1 }, { day: 1, mood: 0.4, stress: 0.5, money: 1 }],
};

describe('visor: informe de vida (020)', () => {
  it('etapas lado a lado, diferencias, lo que cambió su vida con su porqué, y el perfil con «sin datos»', () => {
    const html = renderReport(view);
    expect(html).toContain('Trabajo · muy buena');
    expect(html).toContain('Trabajo · muy difícil'); // cómo la recuerda
    expect(html).toContain('no la cuenta');
    expect(html).toContain('En general recuerda su vida peor de lo que fue.');
    expect(html).toContain('3 consecuencias, ánimo -25 en 30 días');
    expect(html).toContain('<summary>¿por qué?</summary>');
    expect(html).toContain('<span class="muted">sin datos</span>');
    expect(html).toContain('2 hechos');
  });

  it('la gráfica tiene una línea de ánimo y otra de estrés; sin trayectoria, un aviso', () => {
    const svg = trajectorySvg(view.trajectory);
    expect(svg).toContain('class="traj-mood" points="0,44 460,66"');
    expect(svg).toContain('traj-stress');
    expect(trajectorySvg([])).toContain('Aún no hay trayectoria');
  });
});
