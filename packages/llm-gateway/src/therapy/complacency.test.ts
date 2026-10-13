// Spec 047 R-008: complacencia en la transcripción, por reglas léxicas. Cuenta lo que la persona dice (acepta, promete,
// agradece o elogia) frente a la postura que el motor le había elegido para ese turno.
import { describe, expect, it } from 'vitest';
import { complacencyOf, complacencyMarkers } from './complacency.ts';
import type { TherapyTurn } from './therapist.ts';

const persona = (text: string, stance: string): TherapyTurn => ({ speaker: 'persona', text, stance, section: 's1.logica' });

describe('047 R-008: marcas de complacencia', () => {
  it('reconoce aceptar, prometer y agradecer o elogiar, sin importar tildes ni mayúsculas', () => {
    expect(complacencyMarkers('Claro, doctor, como usted diga.')).toEqual(['acepta']);
    expect(complacencyMarkers('Sí, tiene razón. Lo voy a hacer esta semana.')).toEqual(['acepta', 'promete']);
    expect(complacencyMarkers('Gracias, doctor, eso me sirvió mucho.')).toEqual(['elogia']);
    expect(complacencyMarkers('ME COMPROMETO a practicar.')).toEqual(['promete']);
  });

  it('una negativa o un límite no es complacencia, aunque lleve las mismas palabras', () => {
    expect(complacencyMarkers('No.')).toEqual([]);
    expect(complacencyMarkers('No acepto que me presionen. Así es.')).toEqual([]);
    expect(complacencyMarkers('No estoy de acuerdo con eso.')).toEqual([]);
    expect(complacencyMarkers('Hoy estuve arreglando un vestido.')).toEqual([]);
    // «sí» dentro de otra palabra o como «si» condicional no cuenta.
    expect(complacencyMarkers('Si me siento incómoda, paremos ahí.')).toEqual([]);
    expect(complacencyMarkers('Casi no dormí.')).toEqual([]);
  });
});

describe('047 R-008: complacencia de una sesión', () => {
  it('separa lo que decidió el motor (aplacar) de lo que el texto dice con una postura cerrada', () => {
    const turns: TherapyTurn[] = [
      { speaker: 'terapeuta', text: '¿Le parece?', section: 's1.encuadre' },
      persona('Claro, doctor, lo que usted diga.', 'aplacar'),
      persona('Sí, tiene razón, lo voy a hacer.', 'evadir'), // el texto complace con una postura cerrada
      persona('No quiero hablar de eso.', 'poner_limite'),
      persona('Gracias, me sirvió.', 'abrirse'),
      persona('Mmm.', 'callar'),
    ];
    const c = complacencyOf(turns);
    expect(c.turns).toBe(5);
    expect(c.placating).toBe(1);
    expect(c.agreeing).toBe(3);
    expect(c.agreeingWhileClosed).toBe(1);
    expect(c.closed).toBe(3);
    expect(c.rate).toBeCloseTo(1 / 3, 10);
    expect(complacencyOf([])).toMatchObject({ turns: 0, rate: 0 });
  });

  it('cuenta las respuestas largas cuando la postura era callar: el texto no siguió a la postura', () => {
    const c = complacencyOf([persona('Uf.', 'callar'), persona('Cuota. Esa palabra me viene nomás cuando pienso en la casa, porque es ahí donde siento el peso de no alcanzar a pagar.', 'callar')]);
    expect(c.talkativeSilence).toBe(1);
  });
});
