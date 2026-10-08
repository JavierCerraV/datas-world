// Spec 047 R-005b, R-005d, R-005e (CA-005): en la sesión la persona responde con la charla de la 043, en un escenario de
// consulta: la postura la decide el motor, no baja de «conocido» y sabe que está con un psicólogo.
import { ACT_PNR_3, LEARNING_DEFAULTS } from '@datas-world/engine';
import type { WorldEvent, WorldView } from '@datas-world/engine';
import { buildOntology, generateWorld, loadCatalogs } from '@datas-world/generators';
import { describe, expect, it } from 'vitest';
import { chatCatalogs } from '../chat/catalog.ts';
import { ChatSession } from '../chat/session.ts';
import { DEFAULT_CONFIG } from '../config.ts';
import { Gateway } from '../gateway.ts';
import { mockAdapter } from '../providers/mock.ts';
import type { MockResponder } from '../providers/mock.ts';
import type { ModelConfig } from '../types.ts';
import { patientResponder } from './patient.ts';
import type { PatientTurnLog } from './patient.ts';
import { runTherapySession } from './session.ts';

const catalogs = loadCatalogs();
const cats = chatCatalogs(catalogs);
const onto = buildOntology(catalogs);
const gen = generateWorld({ seed: 482917 });
const view = gen.world as unknown as WorldView;
const events: readonly WorldEvent[] = gen.events;
const SANTIAGO = 'CIT-000019';

const mock = (model: string): ModelConfig => ({ provider: 'mock', model, maxOutputTokens: 800, timeoutMs: 5_000 });
function gateway(prompts: { therapist: string[]; patient: string[] }): Gateway {
  const responder: MockResponder = (c) => {
    const sys = c.system.map((p) => p.text).join('\n');
    if (sys.startsWith('Clasifica el tono')) return '{"tone":"calido"}';
    if (sys.startsWith('Revisas la respuesta')) return '{"claims":[],"stance":"ok"}';
    if (c.model === 'm-terapeuta') {
      if (!c.jsonSchema) return 'Nota de cierre.';
      prompts.therapist.push(sys);
      const component = (/PENDIENTES: (.*)/.exec(sys)?.[1] ?? '').split(', ')[0]?.split(' ')[0] ?? '';
      return JSON.stringify({ say: `Cuénteme (${component}).`, component, covered: [], notes: 'Sin datos aún.' });
    }
    prompts.patient.push(sys);
    return 'Pues ahí vamos, doctor.';
  };
  const purposes = { ...DEFAULT_CONFIG.purposes, dialogue: mock('m-persona'), classify: mock('m-tono'), verify: mock('m-verif'), therapist: mock('m-terapeuta') };
  return new Gateway({ config: { ...DEFAULT_CONFIG, purposes }, adapters: { mock: mockAdapter(responder) } });
}

const chatOf = (gw: Gateway, setting?: 'consulta') =>
  new ChatSession({
    gateway: gw, catalogs: cats, onto, P: LEARNING_DEFAULTS, view, citizenId: SANTIAGO, events, sessionId: 'EST-s1', visitorId: 'EXT-TERAPEUTA', seed: 482917, now: 9355,
    ...(setting ? { setting, minLevel: 1 as const } : {}),
  });

describe('047 R-005e: la persona está en consulta', () => {
  it('su prompt dice que está con un psicólogo y abre al menos lo de un conocido; sin el escenario, la charla no cambia', async () => {
    const consulta = { therapist: [] as string[], patient: [] as string[] };
    const first = await chatOf(gateway(consulta), 'consulta').turn('Buenas tardes, ¿cómo está?');
    expect(first.level).toBeGreaterThanOrEqual(1);
    expect(consulta.patient[0]).toContain('consulta con un psicólogo');
    expect(consulta.patient[0]).not.toContain('por chat con un visitante');
    expect(consulta.patient[0]).not.toContain('con un desconocido');
    expect(consulta.patient[0]).toContain('Familia:');

    const chat = { therapist: [] as string[], patient: [] as string[] };
    const plain = await chatOf(gateway(chat)).turn('Buenas tardes, ¿cómo está?');
    expect(plain.level).toBe(0);
    expect(chat.patient[0] ?? '').not.toContain('consulta con un psicólogo');
  });
});

describe('047 R-005b: la sesión completa, terapeuta y persona, cada uno con su llamada', () => {
  it('guarda la postura de cada turno y lo que el motor decidió; el terapeuta no ve nada de eso (CA-005, CA-008)', async () => {
    const prompts = { therapist: [] as string[], patient: [] as string[] };
    const gw = gateway(prompts);
    const chat = chatOf(gw, 'consulta');
    const log: PatientTurnLog[] = [];
    const r = await runTherapySession({ gateway: gw, protocol: ACT_PNR_3, session: 1, patientName: chat.view.name, citizenId: SANTIAGO, maxTurns: 6, respond: patientResponder(chat, log) });
    expect(r.therapistTurns).toBe(6);
    expect(log.length).toBe(6);
    const persona = r.transcript.filter((t) => t.speaker === 'persona');
    expect(persona.every((t) => typeof t.stance === 'string' && t.stance.length > 0)).toBe(true);
    expect(log.map((l) => l.stance)).toEqual(persona.map((t) => t.stance));
    expect(log.every((l) => l.tone.length > 0 && l.level >= 1 && l.expression === 'llm')).toBe(true);
    await Promise.all(log.map((l) => l.verification));
    // El terapeuta y la persona van en llamadas separadas y el terapeuta no ve la postura ni la vista de la persona.
    expect(prompts.therapist.length).toBe(6);
    expect(prompts.patient.length).toBe(6);
    for (const p of prompts.therapist) {
      expect(p).not.toContain('POSTURA PARA ESTE TURNO');
      expect(p).not.toContain('LO QUE SABES');
      for (const s of new Set(log.map((l) => l.stance))) expect(p).not.toContain(s);
    }
    // La persona no ve la guía ni los componentes.
    for (const p of prompts.patient) expect(p).not.toContain('s1.');
  });

  it('si la persona da por terminada la charla, la sesión acaba por abandono', async () => {
    const gw = gateway({ therapist: [], patient: [] });
    const chat = chatOf(gw, 'consulta');
    chat.ended = true;
    const r = await runTherapySession({ gateway: gw, protocol: ACT_PNR_3, session: 1, patientName: chat.view.name, maxTurns: 6, respond: patientResponder(chat) });
    expect(r.ended).toBe('abandono');
    expect(r.therapistTurns).toBe(1);
  });
});
