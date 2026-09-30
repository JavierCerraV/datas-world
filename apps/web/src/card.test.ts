import { describe, expect, it } from 'vitest';
import { renderMemories } from './card-life.ts';
import { tabCreencias, tabRelaciones } from './card.ts';
import type { LifeView } from './life.ts';
import type { CitizenDetail } from './types.ts';

// Piezas de la ficha que usa el expediente: vínculos, creencias y memoria (024 R-022, CA-012 y CA-014).
const detail: CitizenDetail = {
  id: 'CIT-000058', name: 'Luis López Vargas', sex: 'M', age: 15,
  occupation: { kind: 'none', reason: 'student' }, household: { id: 'HH-0001', members: 3 }, money: 0,
  activity: 'study', place: { id: 'PLC-0020', name: 'Colegio Los Alisos' }, moving: false,
  state: { mood: 0.42, stress: 0.25 }, needs: { energy: 0.7, hunger: 0.6, social: 0.1 }, emotions: { joy: 0.2, anger: 0.7 },
  temperament: { extraversion: 0.6 }, learned: { discountK: 0.02, variability: 0.3 },
  functions: [{ stimulus: 'need.fun', value: 0.5, trials: 12, sources: [] }], responses: [], rules: [], relations: [],
  bonds: [{ id: 'CIT-000056', name: 'Óscar López Gómez', labels: ['familia'], familiarity: 0.98, tension: 0.4, trust: 1, encounters: 88, affection: 0.26, affectionBack: -0.13 }],
  attachment: { security: 0.7, avoidance: 0.2, style: 'seguro' },
  beliefs: [{ about: 'CIT-000070', name: 'Valentina Gómez Rojas', predicate: 'consiguio_trabajo', topic: 'Consiguió trabajo', source: 'CIT-000070', sourceName: 'Valentina Gómez Rojas', credibility: 0.44, hops: 1, truth: true }],
  aboutMe: [{ predicate: 'pelea_con_alguien', topic: 'Anda peleando con alguien', true: true, holders: [{ id: 'CIT-000056', name: 'Óscar López Gómez', credibility: 1 }] }],
  events: [{ id: 'EVT-000000000009', type: 'ARGUMENT', at: 10, date: '2026-03-04 08:10', text: 'CIT-000058 y CIT-000056 discuten (poner limite / callar).', names: { 'CIT-000058': 'Luis López Vargas', 'CIT-000056': 'Óscar López Gómez' }, participants: [], payload: { stanceA: 'poner_limite', stanceB: 'callar' }, causes: [] }],
  home: { id: 'PLC-0102', name: 'Vivienda 02-F, Edificio 02' }, district: 'La Esperanza', until: '2026-03-04 15:00',
};

describe('024 R-022: piezas de la ficha', () => {
  it('CA-012: Relaciones desde las dos perspectivas, Creencias con lo que otros creen', () => {
    const rel = tabRelaciones(detail);
    expect(rel).toContain('Afecto de Luis');
    expect(rel).toContain('Afecto de Óscar');
    expect(rel).toContain('<span>-13</span>'); // el afecto de vuelta, con signo
    expect(rel).toContain('88 encuentros');
    expect(rel).toContain('Estilo seguro');
    const cre = tabCreencias(detail);
    expect(cre).toContain('«Consiguió trabajo» de <button class="who" data-person="CIT-000070">');
    expect(cre).toContain('Coincide con la realidad');
    expect(cre).toContain('Lo que se dice de Luis');
    expect(cre).toContain('«Anda peleando con alguien» <span class="ok">cierto</span>');
  });

  it('CA-012: Memoria', () => {
    const life: LifeView = {
      id: detail.id, name: detail.name, genogram: { nodes: [], partners: [] }, stages: [],
      chapters: [{ id: 'CH1', theme: 'adolescencia', from: '2022-11-04', to: null, fromAge: 12, tone: -0.2, openedBy: null }],
      memories: [
        { id: 'M1', date: '2026-02-17', age: 15, source: 'lived', text: 'Discutió con su padre.', valence: -0.4, valence0: -0.2, intensity: 0.22, rehearsals: 2, chapter: 'CH1' },
        { id: 'M2', date: '2026-01-02', age: 15, source: 'told', text: 'Oyó que alguien se recuperó.', valence: 0.1, valence0: 0.1, intensity: 0.05, rehearsals: 0, chapter: null },
      ],
    };
    const mem = renderMemories(life);
    expect(mem).toContain('Recuerdos (2)');
    expect(mem).toContain('Lo recuerda peor de lo que lo vivió');
    expect(mem).toContain('class="faded"'); // casi olvidado
  });
});
