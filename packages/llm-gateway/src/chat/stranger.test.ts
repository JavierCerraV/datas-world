// Prudencia ante un desconocido (spec 043 v0.7, R-024 a R-027; CA-021 a CA-024): la vista que ve el LLM se filtra por
// la familiaridad del visitante, la postura se vuelve cauta y un menor no habla con extraños.
import { CHAT_DEFAULTS, LEARNING_DEFAULTS, STRANGER_DEFAULTS, disclosureLevel, familiarity, startConversation } from '@datas-world/engine';
import type { ConversationState, DisclosureLevel, FunctionStore, WorldEvent, WorldView } from '@datas-world/engine';
import { buildOntology, generateWorld, loadCatalogs } from '@datas-world/generators';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config.ts';
import { Gateway } from '../gateway.ts';
import { mockAdapter } from '../providers/mock.ts';
import type { MockResponder } from '../providers/mock.ts';
import type { GatewayConfig, ModelConfig } from '../types.ts';
import { chatCatalogs } from './catalog.ts';
import { discloseView } from './disclosure.ts';
import { STRANGER_TEMPLATE, ChatSession } from './session.ts';
import { buildPersonView } from './view.ts';

const catalogs = loadCatalogs();
const cats = chatCatalogs(catalogs);
const onto = buildOntology(catalogs);
const gen = generateWorld({ seed: 482917 });
const view = gen.world as unknown as WorldView;
const events: readonly WorldEvent[] = gen.events;
const SANTIAGO = 'CIT-000019';
const NOW = 9355;

const mock = (model: string): ModelConfig => ({ provider: 'mock', model, temperature: 0, maxOutputTokens: 300, timeoutMs: 5_000, price: { input: 1, output: 5 } });
const cfg = (): GatewayConfig => ({
  ...DEFAULT_CONFIG,
  purposes: { ...DEFAULT_CONFIG.purposes, dialogue: mock('m-dialogo'), classify: mock('m-tono'), verify: mock('m-verif'), summarize: mock('m-resumen') },
});

/** Responde y guarda el prompt de la expresión; el clasificador devuelve el tono pedido. */
function gateway(tone: string, prompts: string[], dialogue = 'Le respondo.'): Gateway {
  const responder: MockResponder = (c) => {
    const sys = c.system.map((p) => p.text).join('\n');
    if (sys.startsWith('Clasifica el tono')) return `{"tone":"${tone}"}`;
    if (sys.startsWith('Revisas la respuesta')) return '{"claims":[],"stance":"ok"}';
    if (sys.startsWith('Resume en una sola frase')) return 'Charlaron un rato.';
    prompts.push(sys);
    return dialogue;
  };
  return new Gateway({ config: cfg(), adapters: { mock: mockAdapter(responder) } });
}

const session = (gw: Gateway, citizenId = SANTIAGO, id = 'CHS-000001') =>
  new ChatSession({ gateway: gw, catalogs: cats, onto, P: LEARNING_DEFAULTS, view, citizenId, events, sessionId: id, visitorId: 'EXT-0001', seed: 482917, now: NOW });

describe('043 R-026: revelación gradual por construcción', () => {
  const full = buildPersonView({ view, citizenId: SANTIAGO, now: NOW, events, memoryText: (k) => cats.memories[k] });

  it('cada hecho de la vista lleva su nivel de intimidad y lo íntimo es lo que no se sabe que sea personal', () => {
    expect(full.facts.length).toBeGreaterThan(3);
    for (const f of full.facts) expect([1, 2]).toContain(f.level);
    expect(full.facts.find((f) => /Perdió su empleo/.test(f.text))!.level).toBe(2);
    expect(full.facts.find((f) => /Se fue de .* a vivir en/.test(f.text))!.level).toBe(1);
  });

  it('nivel 0: nombre de pila, edad aproximada y ocupación en general; sin familia, gustos, historia, dinero ni emociones', () => {
    const v = discloseView(full, 0);
    expect(v.name).toBe('Santiago');
    expect(v.age! % 5).toBe(0);
    expect(v.family).toEqual([]);
    expect(v.likes).toEqual([]);
    expect(v.facts).toEqual([]);
    expect(v.birthplace).toBeNull();
    expect(v.situation.money).toBeNull();
    expect(v.state.emotions).toEqual({});
    expect(v.occupation).not.toMatch(/ en /);
  });

  it('nivel 1: familia, gustos y lo personal, pero ni lo íntimo ni el dinero; nivel 2: todo', () => {
    const v = discloseView(full, 1);
    expect(v.family.length).toBe(full.family.length);
    expect(v.facts.length).toBeGreaterThan(0);
    expect(v.facts.every((f) => f.level === 1)).toBe(true);
    expect(v.facts.some((f) => /Perdió su empleo/.test(f.text))).toBe(false);
    expect(v.situation.money).toBeNull();
    expect(discloseView(full, 2)).toBe(full);
  });
});

describe('043 CA-021: el prompt de un desconocido no lleva su intimidad', () => {
  it('en el primer turno el prompt no contiene la familia con nombres, la historia ni el dinero, y dice que es un desconocido', async () => {
    const prompts: string[] = [];
    const s = session(gateway('neutro', prompts));
    const full = s.view;
    const t = await s.turn('Hola, quería preguntarle por su familia y su trabajo');
    expect(t.level).toBe(0);
    const prompt = prompts[0]!;
    expect(prompt).toContain('con un desconocido');
    for (const m of full.family) expect(prompt, m.name).not.toContain(m.name);
    expect(prompt).not.toMatch(/Perdió su empleo|Se fue de .* a vivir|Terminó estudios/);
    expect(prompt).toContain('Santiago');
    expect(prompt).not.toContain(full.name);
    expect(prompt).toContain('Dinero: sin datos');
  });
});

describe('043 CA-022: la confianza se gana con turnos cálidos', () => {
  const state = (store: FunctionStore): ConversationState => startConversation(store, 'EXT-0001');
  const empty: FunctionStore = { f: [], r: [], pruned: 0 };

  it('la familiaridad nace en 0 y los niveles se abren en DISCLOSE_L1 y DISCLOSE_L2 (este último con valor positivo del visitante)', () => {
    const s = state(empty);
    expect(familiarity(s, CHAT_DEFAULTS)).toBe(0);
    expect(disclosureLevel(0, 0, CHAT_DEFAULTS)).toBe(0);
    expect(disclosureLevel(STRANGER_DEFAULTS.discloseL1 - 0.01, 1, CHAT_DEFAULTS)).toBe(0);
    expect(disclosureLevel(STRANGER_DEFAULTS.discloseL1, 0, CHAT_DEFAULTS)).toBe(1);
    expect(disclosureLevel(STRANGER_DEFAULTS.discloseL2, 0, CHAT_DEFAULTS)).toBe(1); // sin valor positivo del visitante, no pasa del 1
    expect(disclosureLevel(STRANGER_DEFAULTS.discloseL2, STRANGER_DEFAULTS.discloseValue + 0.05, CHAT_DEFAULTS)).toBe(2);
  });

  it('turnos previos con el visitante cuentan: quien ya lo conoce parte con familiaridad', () => {
    const known: FunctionStore = { f: [{ s: 'ext.EXT-0001', v: 0.3, c: '', inh: [], hab: 0, n: 10, rs: [], o: 'direct', src: [], at: 0 }], r: [], pruned: 0 };
    expect(familiarity(state(known), CHAT_DEFAULTS)).toBeCloseTo(10 * STRANGER_DEFAULTS.fPrevTurn + 0.3 * STRANGER_DEFAULTS.fValue, 5);
  });

  it('con tono amable el nivel sube sin bajar y llega al 1; con tono hostil nunca sale del 0', async () => {
    const warm = session(gateway('amable', []));
    const levels: DisclosureLevel[] = [];
    for (let k = 0; k < 8; k++) {
      if (warm.ended) break;
      levels.push((await warm.turn('Buenas tardes, ¿cómo le va?', { toneTag: 'amable', forced: 'responder_breve' })).level);
    }
    expect(levels[0]).toBe(0);
    expect(levels.some((l) => l >= 1)).toBe(true);
    for (let k = 1; k < levels.length; k++) expect(levels[k]!).toBeGreaterThanOrEqual(levels[k - 1]!);
    const cold = session(gateway('hostil', []), SANTIAGO, 'CHS-000002');
    for (let k = 0; k < 6; k++) {
      if (cold.ended) break;
      expect((await cold.turn('Usted es un inútil', { toneTag: 'hostil', forced: 'responder_breve' })).level).toBe(0);
    }
  });
});

describe('043 CA-023: la cautela cambia la postura', () => {
  const probs = async (citizenId: string, warmTurns: number) => {
    const s = session(gateway('amable', []), citizenId, `CHS-${citizenId}-${warmTurns}`);
    for (let k = 0; k < warmTurns; k++) await s.turn('Buenas', { toneTag: 'amable', forced: 'responder_breve' });
    const t = await s.turn('Cuénteme de usted', { toneTag: 'neutro' });
    return Object.fromEntries(t.choice.probabilities.map((p) => [p.stance, p.p])) as Record<string, number>;
  };

  it('ante un desconocido, abrirse es menos probable que ante un conocido, y callar o evadir, más', async () => {
    const stranger = await probs(SANTIAGO, 0);
    const known = await probs(SANTIAGO, 8);
    expect(stranger.abrirse!).toBeLessThan(known.abrirse!);
    expect(stranger.evadir! + stranger.callar!).toBeGreaterThan(known.evadir! + known.callar!);
  });

  it('un menor de 14 años ante un desconocido calla, evade o termina más que un adulto', async () => {
    const kid = [...view.citizens.values()].find((c) => {
      const born = view.components.i32['demo.birthMinute']![Number(c.id.slice(4))]!;
      return c.status === 'active' && !c.ancestor && (NOW - born) / (365.25 * 1440) < 12 && (NOW - born) / (365.25 * 1440) > 6;
    });
    expect(kid, 'hay un niño en el mundo de ejemplo').toBeDefined();
    const sum = (p: Record<string, number>) => p.callar! + p.evadir! + p.terminar!;
    expect(sum(await probs(kid!.id, 0))).toBeGreaterThan(sum(await probs(SANTIAGO, 0)));
  });
});

describe('043 CA-024: la primera respuesta a un desconocido dice que no lo conoce', () => {
  it('sin LLM, con una postura de acercamiento o de evasión, la plantilla es «¿Y usted quién es?»', async () => {
    const s = session(gateway('neutro', [], ''), SANTIAGO, 'CHS-000009');
    const t = await s.turn('Hola', { toneTag: 'neutro', forced: 'responder_breve' });
    expect(t.expression).toBe('template');
    expect(t.reply).toBe(STRANGER_TEMPLATE);
    // La segunda ya no es la presentación.
    const u = await s.turn('Hola otra vez', { toneTag: 'neutro', forced: 'responder_breve' });
    expect(u.reply).not.toBe(STRANGER_TEMPLATE);
  });
});
