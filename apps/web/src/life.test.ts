import { describe, expect, it } from 'vitest';
import { genogramSvg, renderLife } from './life.ts';
import type { GenoNode, LifeView } from './life.ts';

// Pestaña «Vida» (041 R-009, CA-005, CA-006).
const node = (id: string, over: Partial<GenoNode>): GenoNode => ({
  id, name: `${id} Apellido`, sex: 'F', born: 1950, died: null, outside: false, generation: 0, relation: 'yo', quality: 'sin_datos', motherId: null, fatherId: null, ...over,
});
const view: LifeView = {
  id: 'CIT-000003',
  name: 'Ana Apellido',
  genogram: {
    nodes: [
      node('CIT-000001', { generation: -1, relation: 'madre', quality: 'cercana', born: 1950, died: 2020, outside: true }),
      node('CIT-000002', { generation: -1, relation: 'padre', sex: 'M', quality: 'conflictiva', born: 1948 }),
      node('CIT-000003', { generation: 0, relation: 'yo', motherId: 'CIT-000001', fatherId: 'CIT-000002', born: 1980 }),
      node('CIT-000004', { generation: 0, relation: 'hermano', sex: 'M', quality: 'distante', motherId: 'CIT-000001', fatherId: 'CIT-000002', born: 1983 }),
    ],
    partners: [['CIT-000001', 'CIT-000002']],
  },
  stages: [
    {
      stage: 'infancia',
      episodes: [
        { date: '1982-03-01', age: 2, stage: 'infancia', kind: 'crianza.consuelo', title: 'Consuelo', text: 'Le consolaron cuando lloraba.', speaker: 'su madre', speakerName: 'CIT-000001 Apellido', valence: 1, learned: [{ label: 'Madre', delta: 0.04 }], cause: null },
        { date: '1984-05-01', age: 4, stage: 'infancia', kind: 'historia.separacion_padres', title: 'Sus padres se separan', text: 'Sus padres se separaron.', speaker: 'su padre', speakerName: null, valence: -1, learned: [], cause: 'Hecho de infancia' },
      ],
    },
  ],
};

describe('pestaña «Vida» del visor (041)', () => {
  it('CA-006: el familiograma dibuja a cada pariente con su símbolo, su muerte, si vive fuera y la calidad de la relación', () => {
    const svg = genogramSvg(view.genogram);
    expect(svg.match(/<g class="g-person/g)).toHaveLength(4);
    expect(svg).toContain('g-person outside'); // la madre vive fuera del mundo
    expect(svg).toContain('g-person me');
    expect(svg).toContain('class="g-dead"'); // la madre murió
    expect(svg).toContain('g-q cercana');
    expect(svg).toContain('g-q conflictiva');
    expect(svg).toContain('g-q distante');
    expect(svg).toContain('class="g-couple"');
    expect(svg.match(/class="g-child"/g)).toHaveLength(2);
    expect(svg).toContain('1950–2020');
  });

  it('CA-005: los episodios por etapa, con quién intervino, lo aprendido y su causa', () => {
    const html = renderLife(view);
    expect(html).toContain('Infancia (0–5 años) · 2 episodios');
    expect(html).toContain('su madre (CIT-000001 Apellido)');
    expect(html).toContain('Madre <span class="mono up">+0.04</span>');
    expect(html).toContain('nada nuevo (ya lo había aprendido)');
    expect(html).toContain('por: Hecho de infancia');
    expect(renderLife({ ...view, stages: [] })).toContain('no tiene historia de desarrollo');
  });
});
