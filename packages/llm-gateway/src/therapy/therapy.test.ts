// Spec 047 R-005 a R-005c (CA-008, CA-009, CA-010): el terapeuta es un agente que dialoga; solo sabe lo que la persona
// le dice, se adapta a lo que responde y el motor lleva la cuenta de lo que de verdad se trabajó.
import { ACT_PNR_3, newProgress, sessionOf } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config.ts';
import { Gateway } from '../gateway.ts';
import { mockAdapter } from '../providers/mock.ts';
import type { MockResponder } from '../providers/mock.ts';
import type { ModelConfig } from '../types.ts';
import { runTherapySession } from './session.ts';
import type { PatientReply } from './session.ts';
import { therapistRequest } from './therapist.ts';
import type { TherapyTurn } from './therapist.ts';

const mock: ModelConfig = { provider: 'mock', model: 'terapeuta', maxOutputTokens: 800, timeoutMs: 5_000 };
const gw = (responder: MockResponder) =>
  new Gateway({ config: { ...DEFAULT_CONFIG, purposes: { ...DEFAULT_CONFIG.purposes, therapist: mock } }, adapters: { mock: mockAdapter(responder) } });

const textOf = (c: { system: { text: string }[]; messages: { text: string }[] }) => [...c.system.map((p) => p.text), ...c.messages.map((m) => m.text)].join('\n');

/** Terapeuta de prueba: trabaja el primer componente pendiente y reformula si la persona no entendió. */
const therapist: MockResponder = (c) => {
  const pending = /PENDIENTES: (.*)/.exec(c.system.at(-1)!.text)?.[1] ?? '';
  const component = pending.split(', ')[0]?.split(' ')[0] ?? '';
  const last = c.messages.at(-1)!.text;
  const say = /no entiendo/i.test(last) ? `Se lo digo de otra forma (${component}).` : `Trabajemos ${component}.`;
  return JSON.stringify({ say, component, covered: [], notes: `Dijo: ${last.slice(0, 40)}` });
};

describe('047 CA-008: el terapeuta solo sabe lo que la persona le dice', () => {
  it('su prompt lleva la guía, la admisión, sus notas y lo dicho; nunca la postura ni el estado de la persona', () => {
    const transcript: TherapyTurn[] = [
      { speaker: 'terapeuta', text: '¿Qué la trae por acá?', section: 's1.encuadre', notes: 'nota-privada-anterior' },
      { speaker: 'persona', text: 'Pues la plata, doctor.', section: 's1.encuadre', stance: 'POSTURA_SECRETA_EVASIVA' },
    ];
    const req = therapistRequest({
      protocol: ACT_PNR_3, session: 1, patientName: 'Marta', admission: 'AAQ-II: 30 (dicho por ella)', formulation: 'Disparador: la deuda.',
      progress: newProgress(), transcript, turnsLeft: 38,
    });
    const text = textOf(req);
    expect(req.purpose).toBe('therapist');
    expect(text).toContain('s1.jerarquia');
    expect(text).toContain('AAQ-II: 30 (dicho por ella)');
    expect(text).toContain('Disparador: la deuda.');
    expect(text).toContain('Pues la plata, doctor.');
    expect(text).not.toContain('POSTURA_SECRETA_EVASIVA');
    expect(text).not.toContain('nota-privada-anterior');
    // Ningún campo del estado ni de las medidas del motor.
    for (const word of ['ánimo 0', 'estrés 0', 'stance', 'indicador', 'isTrue', 'WorldState']) expect(text).not.toContain(word);
    // Las partes fijas van primero y son cacheables; lo que cambia cada turno, al final.
    expect(req.system.map((p) => p.cacheable)).toEqual([true, true, false]);
    expect(req.messages[0]!.role).toBe('user');
    expect(req.messages.at(-1)).toEqual({ role: 'user', text: 'Pues la plata, doctor.' });
    // La guía de otra sesión no entra.
    expect(text).not.toContain('s3.jardin');
  });
});

describe('047 CA-009: dos personas que responden distinto tienen sesiones distintas', () => {
  it('el terapeuta reformula con quien no entiende y avanza con quien sí', async () => {
    const run = (respond: (say: string, turn: number) => PatientReply) =>
      runTherapySession({ gateway: gw(therapist), protocol: ACT_PNR_3, session: 1, patientName: 'Marta', respond: async (say, turn) => respond(say, turn) });
    const clara = await run(() => ({ text: 'Sí, ya veo.', stance: 'abierta' }));
    const confusa = await run((_say, turn) => ({ text: turn % 3 === 1 ? 'No entiendo eso.' : 'Ah, bueno.', stance: 'cauta' }));
    expect(clara.ended).toBe('completa');
    expect(confusa.ended).toBe('completa');
    expect(clara.fidelity).toBe(1);
    const said = (r: typeof clara) => r.transcript.filter((t) => t.speaker === 'terapeuta').map((t) => t.text);
    expect(said(confusa)).not.toEqual(said(clara));
    expect(said(confusa).some((s) => s.startsWith('Se lo digo de otra forma'))).toBe(true);
    expect(said(clara).some((s) => s.startsWith('Se lo digo de otra forma'))).toBe(false);
    // La transcripción guarda la postura de cada turno de la persona, la sección y las notas del terapeuta (CA-005).
    const persona = clara.transcript.find((t) => t.speaker === 'persona')!;
    expect(persona).toMatchObject({ stance: 'abierta', section: 's1.encuadre' });
    expect(clara.transcript[0]!.notes).toBeDefined();
    expect(clara.formulation).toContain('Dijo:');
  });
});

describe('047 CA-010: la fidelidad la decide lo que de verdad se trabajó', () => {
  const required = sessionOf(ACT_PNR_3, 1).components.filter((c) => c.required);

  it('una sesión que llega al tope sin cubrir todo tiene fidelidad < 1 y dice qué faltó', async () => {
    const r = await runTherapySession({
      gateway: gw(therapist), protocol: ACT_PNR_3, session: 1, patientName: 'Marta', maxTurns: 5, respond: async () => ({ text: 'Ajá.' }),
    });
    expect(r.ended).toBe('tope');
    expect(r.therapistTurns).toBe(5);
    expect(r.fidelity).toBeGreaterThan(0);
    expect(r.fidelity).toBeLessThan(1);
    expect(r.covered.length + r.missing.length).toBe(required.length);
    expect(r.missing).toContain('s1.tarea');
  });

  it('lo que el terapeuta declara cubierto no cuenta, ni un componente inventado', async () => {
    const liar: MockResponder = () => JSON.stringify({ say: 'Listo, ya vimos todo.', component: 'inventado', covered: required.map((c) => c.id), notes: '' });
    const r = await runTherapySession({ gateway: gw(liar), protocol: ACT_PNR_3, session: 1, patientName: 'Marta', maxTurns: 4, respond: async () => ({ text: 'Bueno.' }) });
    expect(r.fidelity).toBe(0);
    expect(r.transcript.every((t) => t.section === 'otro')).toBe(true);
    expect(r.claimed).toEqual(required.map((c) => c.id));
  });

  it('si la persona se va, la sesión termina por abandono con lo cubierto hasta ahí', async () => {
    const r = await runTherapySession({
      gateway: gw(therapist), protocol: ACT_PNR_3, session: 1, patientName: 'Marta',
      respond: async (_s, turn) => (turn === 2 ? { text: 'Me tengo que ir.', left: true } : { text: 'Sí.' }),
    });
    expect(r.ended).toBe('abandono');
    expect(r.therapistTurns).toBe(3);
    expect(r.covered).toEqual(['s1.encuadre']);
  });

  it('sin LLM del terapeuta no hay sesión inventada: termina y dice por qué', async () => {
    const off = new Gateway({ config: DEFAULT_CONFIG, adapters: {} });
    const r = await runTherapySession({ gateway: off, protocol: ACT_PNR_3, session: 1, patientName: 'Marta', respond: async () => ({ text: 'Sí.' }) });
    expect(r).toMatchObject({ ended: 'sin_llm', detail: 'disabled', fidelity: 0, transcript: [] });
  });
});
