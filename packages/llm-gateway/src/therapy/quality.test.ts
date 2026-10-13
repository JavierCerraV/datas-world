// Spec 047 R-005f: medidas léxicas de lo que el piloto mostró que el terapeuta hacía mal.
import { ACT_PNR_3, newProgress } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { therapistQuality } from './quality.ts';
import { therapistRequest } from './therapist.ts';
import type { TherapyTurn } from './therapist.ts';

const t = (text: string): TherapyTurn => ({ speaker: 'terapeuta', text, section: 's1.logica' });
const p = (text: string): TherapyTurn => ({ speaker: 'persona', text, section: 's1.logica', stance: 'abrirse' });

describe('047 R-005f: calidad del terapeuta en la transcripción', () => {
  it('cuenta el tuteo, las preguntas dobles, las repeticiones y los elogios de fórmula', () => {
    const q = therapistQuality([
      t('¿Qué necesitarías sentir para que esta conversación te resulte útil y segura?'),
      p('Que me explique claro.'),
      t('¿Qué necesitarías sentir ahora para que esta conversación te resulte útil y segura?'),
      p('Ya le dije.'),
      t('Perfecto. ¿Cuánto dura ese alivio? ¿Y mientras tanto se acerca a lo que le importa?'),
      p('Poco.'),
      t('Cuénteme, ¿qué hace usted cuando aparece ese pensamiento?'),
    ]);
    expect(q).toEqual({ turns: 4, informal: 2, doubleQuestions: 1, repeats: 1, praise: 1 });
  });

  it('tratar de usted no cuenta como tuteo, ni una pregunta distinta como repetición', () => {
    const q = therapistQuality([
      t('¿Qué nota usted cuando aparece ese pensamiento sobre la deuda?'),
      t('Cuénteme de su hija: ¿qué hacen juntas los domingos?'),
      t('¿Le parece si probamos un ejercicio corto con eso que me cuenta?'),
    ]);
    expect(q).toMatchObject({ informal: 0, repeats: 0, doubleQuestions: 0, praise: 0 });
  });

  it('el prompt pide tratar de usted, no repetir, y marca qué componentes son ejercicios', () => {
    const req = therapistRequest({ protocol: ACT_PNR_3, session: 1, patientName: 'Marta', formulation: '', progress: newProgress(), transcript: [], turnsLeft: 40 });
    const text = req.system.map((x) => x.text).join('\n');
    expect(text).toMatch(/Trátela siempre de usted/);
    expect(text).toMatch(/no la repita ni con otras palabras/);
    expect(text).toContain('[s1.empujar] Empujar frente a dejar que toque · ejercicio');
    expect(text).toContain('[s1.jerarquia] El disparador principal y su cadena\n');
    // Sigue sin cuentas de turnos que cumplir.
    expect(text).not.toMatch(/al menos \d+ intercambio/);
  });
});
