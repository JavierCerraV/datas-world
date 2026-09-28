import { LEARNING_DEFAULTS } from '@datas-world/engine';
import type { WorldEvent, WorldView } from '@datas-world/engine';
import { buildOntology, generateWorld, loadCatalogs } from '@datas-world/generators';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config.ts';
import { Gateway } from '../gateway.ts';
import { mockAdapter } from '../providers/mock.ts';
import type { MockResponder } from '../providers/mock.ts';
import type { ProviderAdapter } from '../providers/types.ts';
import { MemoryRecordStore } from '../records.ts';
import type { GatewayConfig, ModelConfig } from '../types.ts';
import { chatCatalogs } from './catalog.ts';
import { classifyTone, lexicalClaims, lexicalTone } from './classify.ts';
import { expressionRequest } from './prompt.ts';
import { ChatEndedError, ChatSession } from './session.ts';
import { verifyReply } from './verify.ts';
import { buildPersonView } from './view.ts';

// El mundo de la semilla 482917 (el de data/world.db): Santiago Osorio (CIT-000019) nació en el campo, migró a
// Data's World, estudió una tecnología, perdió su empleo y tiene dos hijos.
const catalogs = loadCatalogs();
const cats = chatCatalogs(catalogs);
const onto = buildOntology(catalogs);
const gen = generateWorld({ seed: 482917 });
const view = gen.world as unknown as WorldView;
const events: readonly WorldEvent[] = gen.events;
const SANTIAGO = 'CIT-000019';

const mock = (model: string): ModelConfig => ({ provider: 'mock', model, temperature: 0, maxOutputTokens: 300, timeoutMs: 5_000, price: { input: 1, output: 5 } });
const cfg = (over: Partial<GatewayConfig> = {}): GatewayConfig => ({
  ...DEFAULT_CONFIG,
  purposes: { ...DEFAULT_CONFIG.purposes, dialogue: mock('m-dialogo'), classify: mock('m-tono'), verify: mock('m-verif'), summarize: mock('m-resumen') },
  ...over,
});
/** Responde según el propósito, que se reconoce por el prompt del sistema. */
const byPurpose = (o: { classify?: string; verify?: string; dialogue?: (last: string) => string } = {}): MockResponder => (c) => {
  const sys = c.system.map((p) => p.text).join('\n');
  if (sys.startsWith('Clasifica el tono')) return o.classify ?? '{"tone":"neutro"}';
  if (sys.startsWith('Revisas la respuesta')) return o.verify ?? '{"claims":[],"stance":"ok"}';
  if (sys.startsWith('Resume en una sola frase')) return 'Charlaron un rato sobre su trabajo.';
  return (o.dialogue ?? ((l) => `Le respondo a «${l}».`))(c.messages.at(-1)?.text ?? '');
};
const session = (gateway: Gateway, id = 'CHS-000001') =>
  new ChatSession({ gateway, catalogs: cats, onto, P: LEARNING_DEFAULTS, view, citizenId: SANTIAGO, events, sessionId: id, visitorId: 'EXT-0001', seed: 482917, now: 9355 });

describe('charla: vista de la persona (043 R-002, R-003)', () => {
  const pv = buildPersonView({ view, citizenId: SANTIAGO, now: 9355, events });

  it('CA-003: la vista contiene la migración, los estudios y la pérdida del empleo, con su edad en cada momento', () => {
    const find = (re: RegExp) => pv.facts.find((f) => re.test(f.text));
    for (const re of [/Se fue de .* a vivir en Data's World/, /Terminó estudios de nivel tecnológica/i, /Perdió su empleo/]) {
      const f = find(re);
      expect(f, String(re)).toBeDefined();
      expect(typeof f!.age).toBe('number');
    }
    expect(pv.birthplace).toBe('el campo');
    expect(pv.family.filter((m) => m.relation === 'hijo' || m.relation === 'hija')).toHaveLength(2);
  });

  it('CA-002: un evento ajeno (el despido de un vecino) no entra en la vista ni en el prompt; uno propio sí', () => {
    const kin = new Set([SANTIAGO, ...pv.family.map((m) => m.id)]);
    const alien = events.find((e) => e.type === 'JOB_LOST' && !e.participants.some((p) => kin.has(p.id)));
    expect(alien).toBeDefined();
    const own = events.find((e) => e.type === 'MIGRATED' && e.participants.some((p) => p.id === SANTIAGO))!;
    const choice = { stance: 'abrirse', sources: [], probabilities: [], forced: false };
    const req = expressionRequest(pv, [{ speaker: 'visitor', text: 'hola' }], choice, cats.stances[0]!);
    const prompt = req.system.map((p) => p.text).join('\n');
    expect(pv.facts.some((f) => f.id === alien!.id)).toBe(false);
    expect(prompt).not.toContain(alien!.id);
    expect(prompt).not.toContain('isTrue');
    expect(prompt).toContain(own.id);
  });
});

describe('charla: turnos, verificación y respaldos (043)', () => {
  it('el tono: la etiqueta de prueba manda; sin LLM, las reglas léxicas', async () => {
    expect(lexicalTone(cats.tones, 'No sea bruto, hombre')).toBe('grosero');
    expect(lexicalTone(cats.tones, 'Me dejó mi esposo, soy lo peor')).toBe('victimizante');
    const g = new Gateway({ config: cfg(), adapters: { mock: mockAdapter(byPurpose({ classify: '{"tone":"amable"}' })) } });
    const s = session(g);
    const a = await s.turn('Buenas tardes, ¿cómo le va?');
    expect(a.tone).toMatchObject({ tone: 'amable', toneLlm: 'amable' });
    const b = await s.turn('Buenas tardes otra vez', { toneTag: 'burla' });
    expect(b.tone.tone).toBe('burla');
  });

  it('CA-009: la misma charla reproducida da las mismas posturas y textos; con registros, sin llamadas de red', async () => {
    const script = ['Buenas, ¿cómo está?', 'No sea bruto, hombre', 'Usted es un inútil', 'Más le vale que se calle o verá'];
    let calls = 0;
    const counting: ProviderAdapter = { call: async (c) => { calls++; return mockAdapter(byPurpose({ classify: '{"tone":"grosero"}' })).call(c); } };
    const records = new MemoryRecordStore(5_000);
    const run = async (adapter: ProviderAdapter) => {
      const s = session(new Gateway({ config: cfg({ purposes: { ...cfg().purposes, dialogue: { ...mock('m'), provider: 'anthropic' }, classify: { ...mock('t'), provider: 'anthropic' } } }), adapters: { anthropic: adapter }, records }));
      const out: string[] = [];
      for (const text of script) {
        if (s.ended) break;
        const t = await s.turn(text);
        out.push(`${t.choice.stance}|${t.reply}`);
      }
      return out;
    };
    const first = await run(counting);
    const before = calls;
    const replay = await run({ call: async () => { throw new Error('no debe llamar a la red'); } });
    expect(replay).toEqual(first);
    expect(calls).toBe(before);
  });

  it('CA-010: se marcan como contradichas o inventadas las afirmaciones que no casan con su historia', async () => {
    const pv = buildPersonView({ view, citizenId: SANTIAGO, now: 9355, events });
    const born = pv.facts.find((f) => f.text.startsWith('Nació en'))!;
    const verify = JSON.stringify({
      claims: [
        { about: 'yo', predicate: 'nació en', value: 'Neiva', verdict: 'contradicted', evidence: `[${born.id}]` },
        { about: 'yo', predicate: 'hijos', value: '3', verdict: 'contradicted', evidence: null },
        { about: 'yo', predicate: 'trabajó en', value: 'un barco', verdict: 'unsupported', evidence: 'EVT-INVENTADO' },
      ],
      stance: 'ok',
    });
    const g = new Gateway({ config: cfg(), adapters: { mock: mockAdapter(byPurpose({ verify })) } });
    const v = await verifyReply(g, pv, cats.stances[0]!, 'Nací en Neiva, tengo tres hijos y trabajé en un barco.');
    expect(v.claims.map((c) => c.verdict)).toEqual(['contradicted', 'contradicted', 'unsupported']);
    expect(v.claims[0]!.evidence).toBe(born.id);
    expect(v.claims[2]!.evidence).toBeUndefined(); // un id que no está en la vista no cuenta como evidencia
  });

  it('CA-011: una respuesta complaciente ante la postura de poner un límite se marca como desajuste', async () => {
    const pv = buildPersonView({ view, citizenId: SANTIAGO, now: 9355, events });
    const g = new Gateway({ config: cfg(), adapters: { mock: mockAdapter(byPurpose({ verify: '{"claims":[],"stance":"mismatch"}' })) } });
    const limit = cats.stances.find((s) => s.key === 'poner_limite')!;
    const v = await verifyReply(g, pv, limit, '¡Tiene toda la razón, perdóneme!');
    expect(v.stanceCheck).toBe('mismatch');
  });

  it('CA-012: sin presupuesto ni proveedor, la charla sigue con plantillas en todos los turnos', async () => {
    const s = session(new Gateway({ config: cfg({ budget: { dailyTokens: 1, monthlyCostCents: 1 } }), adapters: {} }));
    for (const text of ['Hola', '¿Cómo le va?', 'Cuénteme de su trabajo']) {
      if (s.ended) break;
      const t = await s.turn(text);
      expect(t.expression).toBe('template');
      expect(t.reply.length).toBeGreaterThan(0);
      expect((await t.verification).stanceCheck).toBe('unchecked');
    }
  });

  it('CA-018: la postura se conoce antes del primer fragmento y la verificación no retrasa el fin del turno', async () => {
    const slowVerify: MockResponder = async (c) => {
      if (c.system[0]!.text.startsWith('Revisas la respuesta')) await new Promise((r) => setTimeout(r, 300));
      return byPurpose()(c);
    };
    const s = session(new Gateway({ config: cfg(), adapters: { mock: mockAdapter(slowVerify, { chunkDelayMs: 20 }) } }));
    const order: string[] = [];
    const t = await s.turn('Buenas, ¿cómo está?', { onStance: () => order.push('stance'), onText: () => order.push('token') });
    order.push('done');
    expect(order[0]).toBe('stance');
    expect(order.indexOf('token')).toBeGreaterThan(0);
    const verified = await Promise.race([t.verification.then(() => 'verificado'), Promise.resolve('pendiente')]);
    expect(verified).toBe('pendiente');
    expect((await t.verification).stanceCheck).toBe('ok');
  });

  it('una charla terminada no acepta más turnos y su cierre trae los tonos, las posturas y el resumen', async () => {
    const s = session(new Gateway({ config: cfg(), adapters: { mock: mockAdapter(byPurpose({ classify: '{"tone":"hostil"}' })) } }));
    let n = 0;
    while (!s.ended && n < 40) {
      await s.turn('Más le vale que se calle o verá', { toneTag: 'hostil' });
      n++;
    }
    expect(s.ended).toBe(true);
    await expect(s.turn('¿Sigue ahí?')).rejects.toBeInstanceOf(ChatEndedError);
    const input = await s.close();
    expect(input.turns.at(-1)!.stance).toBe('terminar');
    expect(input.summary).toBe('Charlaron un rato sobre su trabajo.');
  });
});

describe('charla: afirmaciones sobre terceros (044 R-001)', () => {
  const lex = (text: string) => lexicalClaims(cats.claims, cats.relations, text);

  it('reglas léxicas: la afirmación y la relación nombrada; si solo admite una relación, esa', () => {
    // El ejemplo del usuario: la esposa «está de acuerdo» con la relación abierta.
    expect(lex('Su esposa ya me dijo que está de acuerdo con la relación abierta')).toEqual([{ predicate: 'consiente_relacion_abierta', about: 'pareja' }]);
    expect(lex('Vi a su esposo con otra mujer')).toEqual([{ predicate: 'infiel', about: 'pareja' }]);
    expect(lex('Le están poniendo los cachos')).toEqual([{ predicate: 'infiel', about: 'pareja' }]);
    expect(lex('Su jefe anda diciendo que usted es un inútil')).toEqual([{ predicate: 'habla_mal_de_ti', about: 'jefe' }]);
    expect(lex('Su mamá me dijo que lo extraña mucho')).toEqual([{ predicate: 'te_extrana', about: 'madre' }]);
  });

  it('reglas léxicas: sin afirmación, o sin saber de quién habla, no hay nada; «padre» no está en «compadre»', () => {
    expect(lex('Buenas tardes, ¿cómo le va?')).toEqual([]);
    expect(lex('Anda diciendo cosas raras')).toEqual([]); // habla_mal_de_ti admite varias relaciones y no nombra ninguna
    expect(lex('Mi compadre anda diciendo que usted es flojo')).toEqual([]);
  });

  it('el clasificador LLM manda cuando responde; descarta relaciones que la afirmación no admite; sin respuesta, las léxicas', async () => {
    const said = 'Su esposa está de acuerdo con la relación abierta, y su jefe le es infiel a todos';
    const llm = '{"tone":"invasivo","claims":[{"predicate":"consiente_relacion_abierta","about":"pareja"},{"predicate":"infiel","about":"jefe"}]}';
    const g = new Gateway({ config: cfg(), adapters: { mock: mockAdapter(byPurpose({ classify: llm })) } });
    const a = await classifyTone(g, cats, said);
    expect(a.visitorClaims).toEqual([{ predicate: 'consiente_relacion_abierta', about: 'pareja' }]);
    expect(a.visitorClaimsLexical.map((c) => c.predicate)).toContain('consiente_relacion_abierta');
    // Si el clasificador no responde algo válido, quedan las léxicas.
    const bad = new Gateway({ config: cfg(), adapters: { mock: mockAdapter(byPurpose({ classify: 'no es JSON' })) } });
    const b = await classifyTone(bad, cats, said);
    expect(b.toneLlm).toBeUndefined();
    expect(b.visitorClaims).toEqual(b.visitorClaimsLexical);
  });

  it('el turno de la charla lleva las afirmaciones detectadas; sin catálogo, la charla sigue igual', async () => {
    const g = new Gateway({ config: cfg(), adapters: { mock: mockAdapter(byPurpose({ classify: '{"tone":"invasivo","claims":[{"predicate":"infiel","about":"pareja"}]}' })) } });
    const t = await session(g).turn('Su esposa lo engaña');
    expect(t.tone.visitorClaims).toEqual([{ predicate: 'infiel', about: 'pareja' }]);
    const plain = chatCatalogs({ chat_tones: catalogs.chat_tones, chat_stances: catalogs.chat_stances, chat_scripts: catalogs.chat_scripts });
    const r = await classifyTone(new Gateway({ config: cfg(), adapters: { mock: mockAdapter(byPurpose()) } }), plain, 'Su esposa lo engaña');
    expect(r.visitorClaims).toEqual([]);
  });
});
