import { describe, expect, it } from 'vitest';
import { renderWhy, whyToggle } from './why.ts';
import type { WhyNode } from './why.ts';

// «¿Por qué?» de la pestaña Historia (019 R-007).
const tree: WhyNode = {
  kind: 'event', ref: 'EVT-00000000005', text: 'Ana pierde su empleo', weight: 1, date: '2027-02-01T10:00', children: [
    {
      kind: 'event', ref: 'EVT-00000000004', text: 'Ana llega tarde', weight: 0.7, date: '2027-01-30T08:00', children: [
        { kind: 'state', ref: 'deuda_de_sueno', text: 'venía durmiendo poco (deuda de sueño de 3 h)', weight: 1, children: [] },
      ],
    },
    { kind: 'source', ref: 'fuente.valor:verbal.trabajo', text: 'un valor (verbal.trabajo): 0.3', weight: 0.3, children: [] },
  ],
};

describe('visor: ¿por qué? (019)', () => {
  it('el árbol anidado, con fechas de los hechos, estilo para estados y fuentes, y el peso de cada rama', () => {
    const html = renderWhy(tree);
    expect(html.match(/<ul class="why">/g)).toHaveLength(2);
    expect(html).toContain('<span class="mono">2027-01-30T08:00</span> <span class="why-event">Ana llega tarde</span> <span class="muted">70 %</span>');
    expect(html).toContain('<span class="why-state">venía durmiendo poco (deuda de sueño de 3 h)</span>');
    expect(html).toContain('why-source');
    expect(html).not.toContain('Ana pierde su empleo'); // la raíz es el propio evento de la lista
    expect(renderWhy({ ...tree, children: [] })).toContain('Sin causas registradas');
  });

  it('el desplegable lleva el id del evento y empieza cerrado', () => {
    const t = whyToggle('EVT-00000000005');
    expect(t).toContain('data-why="EVT-00000000005"');
    expect(t).not.toContain(' open');
  });
});
