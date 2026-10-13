// Spec 047 R-004, R-006 (CA-003, CA-004, INV-001): la dosis la decide el motor con lo que de verdad pasó en la sesión
// (qué se trabajó y con qué postura respondió la persona), y actúa sobre los mismos mecanismos de siempre.
import { describe, expect, it } from 'vitest';
import { createOntology } from '../functions/sensitivity.ts';
import { LEARNING_DEFAULTS, NEUTRAL, emptyStore } from '../functions/types.ts';
import type { FunctionStore } from '../functions/types.ts';
import { AVOIDANCE_RESPONSES, AVOIDANCE_W0, PRIVATE_DEFAULTS, SELF_RESPONSE } from '../private/params.ts';
import { responseStrength } from '../private/pnr.ts';
import { ACT_PNR_3 } from './act-pnr-3.ts';
import { PROTOCOL_PARAMS, applyDose, practiceProbability, sessionDose } from './dose.ts';
import type { Exchange } from './dose.ts';
import { sessionOf } from './tracker.ts';

const onto = createOntology([
  { key: 'dominio.familia', kind: 'verbal_term', features: [1, 0, 0] }, { key: 'dominio.trabajo', kind: 'verbal_term', features: [0, 1, 0] },
  { key: 'verbal.deuda', kind: 'verbal_term', features: [0, 0, 1] },
]);
const storeWith = (f: [string, number][], r: [string, number][] = []): FunctionStore => ({
  ...emptyStore(),
  f: f.map(([s, v]) => ({ s, v, c: '', inh: [], hab: 0, n: 5, rs: [], o: 'direct' as const, src: [], at: 0 })),
  r: r.map(([k, w]) => ({ r: k, c: '', w, n: 5, at: 0 })),
});
const s1 = sessionOf(ACT_PNR_3, 1);
/** Una sesión 1 entera: cada componente con sus intercambios, todos con la misma postura. */
const whole = (stance: string): Exchange[] => s1.components.flatMap((c) => Array.from({ length: c.minTurns }, () => ({ component: c.id, stance })));
const yo = (s: FunctionStore) => responseStrength(s, SELF_RESPONSE, PRIVATE_DEFAULTS.selfW0);
const evit = (s: FunctionStore) => AVOIDANCE_RESPONSES.map((r) => responseStrength(s, r, AVOIDANCE_W0));
const apply = (s: FunctionStore, ex: Exchange[], scale = 1) => applyDose(s, onto, LEARNING_DEFAULTS, NEUTRAL, sessionDose(s1, ex, scale).dose, 1, 100);

describe('047 R-004: de la sesión a la dosis', () => {
  it('cuenta ensayos por mecanismo solo de los intercambios en que la persona estuvo presente', () => {
    const open = sessionDose(s1, whole('abrirse'));
    expect(open.engagement).toBe(1);
    expect(open.dose.yo).toBeGreaterThan(0);
    expect(open.dose.extincion).toBeGreaterThan(0);
    // En la sesión 1 solo «las dos direcciones» apunta a valores.
    expect(open.dose.valores).toBe(1);
    const brief = sessionDose(s1, whole('responder_breve'));
    expect(brief.engagement).toBe(PROTOCOL_PARAMS.engagement.responder_breve);
    expect(brief.dose.yo).toBeLessThan(open.dose.yo);
  });

  it('CA-004: con todas las posturas evasivas la dosis es cero, diga lo que diga el texto', () => {
    for (const stance of ['evadir', 'callar', 'contraatacar', 'poner_limite', 'terminar']) {
      const d = sessionDose(s1, whole(stance));
      expect(d.engagement).toBe(0);
      expect(d.dose).toEqual({ yo: 0, extincion: 0, valores: 0 });
    }
    // Complacer no es estar presente: cuenta poco.
    expect(sessionDose(s1, whole('aplacar')).dose.yo).toBeLessThan(sessionDose(s1, whole('responder_breve')).dose.yo);
  });

  it('un componente inventado o de otra sesión no da dosis; la escala multiplica (análisis de sensibilidad)', () => {
    expect(sessionDose(s1, [{ component: 'inventado', stance: 'abrirse' }, { component: 's3.jardin', stance: 'abrirse' }]).dose).toEqual({ yo: 0, extincion: 0, valores: 0 });
    const base = sessionDose(s1, whole('abrirse')).dose;
    expect(sessionDose(s1, whole('abrirse'), 2).dose.yo).toBe(base.yo * 2);
    expect(sessionDose(s1, whole('abrirse'), 0.5).dose.yo).toBeLessThan(base.yo);
  });
});

describe('047 R-004: la dosis sobre los mecanismos del motor (CA-003)', () => {
  const person = () => storeWith([['dominio.familia', 0.3], ['dominio.trabajo', -0.2], ['verbal.deuda', -0.6]], [['evit.distraccion', 0.5]]);

  it('una sesión con la persona presente fortalece el «Yo», debilita la evitación y refuerza sus valores', () => {
    const s = person();
    const before = { yo: yo(s), evit: evit(s), familia: 0.3 };
    const r = apply(s, whole('abrirse'));
    expect(yo(s)).toBeGreaterThan(before.yo);
    evit(s).forEach((w, i) => expect(w).toBeLessThan(before.evit[i]!));
    expect(s.f.find((f) => f.s === 'dominio.familia')!.v).toBeGreaterThan(before.familia);
    // Solo se refuerzan los dominios que ya le importan: la sesión no le inventa un valor.
    expect(s.f.find((f) => f.s === 'dominio.trabajo')!.v).toBe(-0.2);
    expect(r.yo.to).toBe(yo(s));
    expect(r.yo.from).toBe(before.yo);
    expect(r.domains).toEqual(['dominio.familia']);
  });

  it('en proporción a su compromiso; sin dosis, nada cambia', () => {
    const full = person(), half = person(), none = person();
    apply(full, whole('abrirse'));
    apply(half, whole('responder_breve'));
    const r = apply(none, whole('evadir'));
    expect(yo(full)).toBeGreaterThan(yo(half));
    expect(yo(half)).toBeGreaterThan(yo(none));
    expect(JSON.stringify(none)).toBe(JSON.stringify(person()));
    expect(r.yo.to).toBe(r.yo.from);
  });

  it('la práctica con audios es media dosis (R-004)', () => {
    const session = person(), practice = person();
    applyDose(session, onto, LEARNING_DEFAULTS, NEUTRAL, { yo: 1, extincion: 1, valores: 1 }, 1, 100);
    applyDose(practice, onto, LEARNING_DEFAULTS, NEUTRAL, { yo: 1, extincion: 1, valores: 1 }, PROTOCOL_PARAMS.practiceStrength, 100);
    const gain = (s: FunctionStore) => yo(s) - PRIVATE_DEFAULTS.selfW0;
    expect(gain(practice)).toBeCloseTo(gain(session) * PROTOCOL_PARAMS.practiceStrength, 10);
    expect(evit(practice)[1]!).toBeGreaterThan(evit(session)[1]!);
  });
});

describe('047 R-006: adherencia a la práctica', () => {
  it('baja con el estrés y el cansancio y sube con valores a su alcance', () => {
    const base = practiceProbability({ stress: 0.2, energy: 0.8, hasValue: true });
    expect(base).toBeGreaterThan(0);
    expect(base).toBeLessThanOrEqual(PROTOCOL_PARAMS.practiceBase);
    expect(practiceProbability({ stress: 0.9, energy: 0.8, hasValue: true })).toBeLessThan(base);
    expect(practiceProbability({ stress: 0.2, energy: 0.2, hasValue: true })).toBeLessThan(base);
    expect(practiceProbability({ stress: 0.2, energy: 0.8, hasValue: false })).toBeLessThan(base);
  });
});
