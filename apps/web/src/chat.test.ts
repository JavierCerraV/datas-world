import { describe, expect, it } from 'vitest';
import { STANCES, TONES, parseSse, sourceLabel, stanceLabel, toneLabel, topProbabilities, verdictMark } from './chat.ts';

describe('vista de chat (043 R-017)', () => {
  it('lee los mensajes SSE aunque lleguen partidos en trozos', () => {
    const all = 'event: stance\ndata: {"stance":"abrirse"}\n\nevent: token\ndata: {"text":"Hola "}\n\nevent: tok';
    const a = parseSse(all);
    expect(a.messages).toEqual([{ event: 'stance', data: { stance: 'abrirse' } }, { event: 'token', data: { text: 'Hola ' } }]);
    const b = parseSse(`${a.rest}en\ndata: {"text":"vecino"}\n\nevent: done\ndata: {"seq":0}\n\n`);
    expect(b.messages.map((m) => m.event)).toEqual(['token', 'done']);
    expect(b.rest).toBe('');
  });

  it('nombra en español los 12 tonos, las 8 posturas y las fuentes de control', () => {
    expect(Object.keys(TONES)).toHaveLength(12);
    expect(Object.keys(STANCES)).toHaveLength(8);
    expect(stanceLabel('poner_limite')).toBe('poner un límite');
    expect(toneLabel('intimo')).toBe('íntimo');
    expect(sourceLabel({ source: 'negativo', contribution: 0.4 })).toBe('quitarse el malestar de la charla');
    expect(verdictMark('contradicted')).toBe('✗ contradice');
  });

  it('resume las posturas más probables', () => {
    expect(topProbabilities([{ stance: 'evadir', p: 0.21 }, { stance: 'poner_limite', p: 0.46 }, { stance: 'callar', p: 0.14 }, { stance: 'abrirse', p: 0.05 }]))
      .toBe('poner un límite 46 %, evadir 21 %, callar 14 %');
  });
});
