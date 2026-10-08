import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DEFAULT_CONFIG, HAIKU_5_5, parseConfig } from './config.ts';
import { Gateway } from './gateway.ts';
import { recordKey } from './key.ts';
import { buildAnthropicParams } from './providers/anthropic.ts';
import { mockAdapter } from './providers/mock.ts';
import type { MockResponder } from './providers/mock.ts';
import { openaiCompatibleAdapter } from './providers/openai.ts';
import type { GatewayConfig, ModelConfig } from './types.ts';

const mockCfg = (over: Partial<ModelConfig> = {}): ModelConfig => ({ provider: 'mock', model: 'mock-1', temperature: 0, maxOutputTokens: 100, timeoutMs: 2_000, price: { input: 1, output: 5 }, ...over });
const config = (over: Partial<GatewayConfig> = {}): GatewayConfig => ({
  ...DEFAULT_CONFIG,
  purposes: { ...DEFAULT_CONFIG.purposes, dialogue: mockCfg(), classify: mockCfg({ model: 'mock-clasificador' }), verify: mockCfg() },
  ...over,
});
const gw = (respond: MockResponder, over: Partial<GatewayConfig> = {}, delay = 0) =>
  new Gateway({ config: config(over), adapters: { mock: mockAdapter(respond, { chunkDelayMs: delay }) } });
const ask = (text: string) => ({ purpose: 'dialogue' as const, system: [{ text: 'sistema', cacheable: true }], messages: [{ role: 'user' as const, text }] });

describe('pasarela LLM (026)', () => {
  it('CA-003: sin presupuesto, la petición devuelve el respaldo por presupuesto y no falla', async () => {
    const g = gw(() => 'hola', { budget: { dailyTokens: 5, monthlyCostCents: 2_000 } });
    const first = await g.run(ask('una pregunta bastante larga para gastar tokens'));
    expect(first.source).toBe('mock');
    const second = await g.run(ask('otra'));
    expect(second).toMatchObject({ source: 'fallback', fallbackReason: 'budget' });
  });

  it('CA-004: cada propósito usa su modelo y un cambio de configuración cambia el modelo sin tocar código', async () => {
    const seen: string[] = [];
    const g = gw((c) => { seen.push(c.model); return '{"tone":"amable"}'; });
    await g.run(ask('a'));
    await g.run({ ...ask('b'), purpose: 'classify', schema: z.object({ tone: z.string() }) });
    expect(seen).toEqual(['mock-1', 'mock-clasificador']);
    const cfg = parseConfig({ purposes: { dialogue: mockCfg({ model: 'mock-2' }) } });
    expect(cfg.purposes.dialogue!.model).toBe('mock-2');
    expect(cfg.purposes.classify).toEqual(DEFAULT_CONFIG.purposes.classify);
    const g2 = new Gateway({ config: cfg, adapters: { mock: mockAdapter((c) => { seen.push(c.model); return 'x'; }) } });
    await g2.run(ask('c'));
    expect(seen.at(-1)).toBe('mock-2');
    expect(() => parseConfig({ purposes: { dialogue: { provider: 'otro' } } })).toThrow();
  });

  it('CA-005: en streaming el primer fragmento llega antes del final y se mide su latencia', async () => {
    const chunks: string[] = [];
    let firstAt = 0;
    const t0 = performance.now();
    const r = await gw(() => 'uno dos tres cuatro', {}, 50).run({ ...ask('x'), onText: (s) => { chunks.push(s); firstAt ||= performance.now() - t0; } });
    expect(chunks.join('')).toBe('uno dos tres cuatro');
    expect(firstAt).toBeLessThan(r.latencyMs.total);
    expect(r.latencyMs.firstToken!).toBeLessThan(r.latencyMs.total);
  });

  it('CA-006: el adaptador de Anthropic envía primero las partes cacheables y marca la última para caché', () => {
    const p = buildAnthropicParams({
      model: 'claude-haiku-4-5-20251001', temperature: 0.8, maxOutputTokens: 300,
      system: [{ text: 'instrucciones', cacheable: true }, { text: 'postura', cacheable: false }, { text: 'vista', cacheable: true }],
      messages: [{ role: 'user', text: 'hola' }],
    });
    const system = p.system as { text: string; cache_control?: unknown }[];
    expect(system.map((s) => s.text)).toEqual(['instrucciones', 'vista', 'postura']);
    expect(system[1]!.cache_control).toEqual({ type: 'ephemeral' });
    expect(system[0]!.cache_control).toBeUndefined();
    expect(system[2]!.cache_control).toBeUndefined();
    expect(p).toMatchObject({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, temperature: 0.8, messages: [{ role: 'user', content: 'hola' }] });
    expect(buildAnthropicParams({ model: 'm', temperature: 0, maxOutputTokens: 10, system: [], messages: [], jsonSchema: { type: 'object' } }).output_config)
      .toEqual({ format: { type: 'json_schema', schema: { type: 'object' } } });
  });

  it('CA-012: sin temperatura no se envía el campo; el esfuerzo y el pensamiento apagado viajan solo si están configurados', () => {
    const base = { model: 'claude-haiku-5-5', maxOutputTokens: 300, system: [], messages: [{ role: 'user' as const, text: 'hola' }] };
    const p = buildAnthropicParams({ ...base, effort: 'low', thinking: 'disabled' });
    expect('temperature' in p).toBe(false);
    expect(p.output_config).toEqual({ effort: 'low' });
    expect(p.thinking).toEqual({ type: 'disabled' });
    expect(buildAnthropicParams({ ...base, effort: 'low', jsonSchema: { type: 'object' } }).output_config)
      .toEqual({ effort: 'low', format: { type: 'json_schema', schema: { type: 'object' } } });
    const old = buildAnthropicParams({ ...base, temperature: 0.8 });
    expect(old.temperature).toBe(0.8);
    expect('output_config' in old).toBe(false);
    expect('thinking' in old).toBe(false);
    const cfg = parseConfig({ purposes: { therapist: { ...HAIKU_5_5, effort: 'low', thinking: 'disabled', maxOutputTokens: 800, timeoutMs: 60_000 } } });
    expect(cfg.purposes.therapist).toMatchObject({ model: 'claude-haiku-5-5', effort: 'low', price: { input: 0.1, output: 0.5 } });
    expect(cfg.purposes.therapist!.temperature).toBeUndefined();
    expect(DEFAULT_CONFIG.purposes.therapist).toBeNull();
    expect(() => parseConfig({ purposes: { therapist: { ...HAIKU_5_5, effort: 'mucho', maxOutputTokens: 800, timeoutMs: 60_000 } } })).toThrow();
  });

  it('CA-013: el esfuerzo entra en la clave del registro solo cuando está, y la clave de antes no cambia', () => {
    const req = ask('hola');
    const plain = recordKey(mockCfg(), req);
    expect(plain).toBe('875fa9b21d31301990f4aebc06ebc5c34ae599f82afb535c1438ef2f6006cf99');
    expect(recordKey(mockCfg({ effort: 'low' }), req)).not.toBe(plain);
    expect(recordKey(mockCfg({ effort: 'low' }), req)).not.toBe(recordKey(mockCfg({ effort: 'high' }), req));
    expect(recordKey(mockCfg({ thinking: 'disabled' }), req)).not.toBe(plain);
  });

  it('CA-007: con un tiempo máximo de 200 ms y 1 s de latencia, devuelve el respaldo por tiempo antes de 300 ms', async () => {
    const g = gw(() => 'tarde', { purposes: { ...config().purposes, dialogue: mockCfg({ timeoutMs: 200 }) } }, 1_000);
    const t0 = performance.now();
    const r = await g.run(ask('x'));
    expect(r).toMatchObject({ source: 'fallback', fallbackReason: 'timeout' });
    expect(performance.now() - t0).toBeLessThan(300);
  });

  it('CA-008: una salida estructurada inválida se repara una vez; si nunca valida, respaldo por inválida', async () => {
    const schema = z.object({ tone: z.enum(['amable', 'grosero']) });
    let n = 0;
    const once = gw(() => (n++ === 0 ? 'no es json' : '```json\n{"tone":"grosero"}\n```'));
    const r = await once.run({ ...ask('x'), purpose: 'classify', schema });
    expect(r.data).toEqual({ tone: 'grosero' });
    const never = await gw(() => '{"tone":"otro"}').run({ ...ask('x'), purpose: 'classify', schema });
    expect(never).toMatchObject({ source: 'fallback', fallbackReason: 'invalid' });
  });

  it('CA-009: la misma petición sale del registro sin llamar a la red; otro modelo hace una llamada nueva', async () => {
    let calls = 0;
    const g = gw(() => { calls++; return 'respuesta'; });
    const a = await g.run(ask('igual'));
    const b = await g.run(ask('igual'));
    expect(calls).toBe(1);
    expect(b).toMatchObject({ source: 'record', text: 'respuesta', recordKey: a.recordKey });
    const other = new Gateway({ config: config({ purposes: { ...config().purposes, dialogue: mockCfg({ model: 'mock-9' }) } }), adapters: { mock: mockAdapter(() => { calls++; return 'otra'; }) }, records: g.records });
    await other.run(ask('igual'));
    expect(calls).toBe(2);
  });

  it('CA-010: la clave de API no aparece en los registros ni en las métricas', async () => {
    const secret = 'sk-ant-api03-SECRETO-DE-PRUEBA';
    process.env.ANTHROPIC_API_KEY = secret;
    try {
      const g = gw(() => 'hola');
      await g.run(ask('x'));
      const dump = JSON.stringify({ records: (g.records as unknown as { all(): unknown[] }).all(), metrics: g.metrics() });
      expect(dump).not.toContain(secret);
    } finally {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('CA-011: el adaptador compatible con OpenAI envía una petición válida y lee la respuesta, también en streaming', async () => {
    const bodies: Record<string, unknown>[] = [];
    const server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const body = JSON.parse(raw) as Record<string, unknown>;
        bodies.push({ ...body, auth: req.headers.authorization, path: req.url });
        if (body.stream) {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          res.write('data: {"choices":[{"delta":{"content":"Hola "}}]}\n\n');
          res.write('data: {"choices":[{"delta":{"content":"vecino"}}]}\n\n');
          res.write('data: {"choices":[],"usage":{"prompt_tokens":7,"completion_tokens":2}}\n\n');
          res.end('data: [DONE]\n\n');
        } else {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ choices: [{ message: { content: 'Hola' } }], usage: { prompt_tokens: 5, completion_tokens: 1 } }));
        }
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
    try {
      const adapter = openaiCompatibleAdapter({ baseUrl, apiKey: 'clave-local' });
      const call = { model: 'local', temperature: 0, maxOutputTokens: 20, system: [{ text: 'sistema', cacheable: true }], messages: [{ role: 'user' as const, text: 'hola' }] };
      const plain = await adapter.call({ ...call, signal: new AbortController().signal });
      expect(plain).toMatchObject({ text: 'Hola', usage: { inputTokens: 5, outputTokens: 1 } });
      const parts: string[] = [];
      const streamed = await adapter.call({ ...call, onText: (s) => parts.push(s), signal: new AbortController().signal });
      expect(parts).toEqual(['Hola ', 'vecino']);
      expect(streamed).toMatchObject({ text: 'Hola vecino', usage: { inputTokens: 7, outputTokens: 2 } });
      expect(bodies[0]).toMatchObject({ path: '/v1/chat/completions', auth: 'Bearer clave-local', model: 'local', messages: [{ role: 'system', content: 'sistema' }, { role: 'user', content: 'hola' }] });
    } finally {
      server.close();
    }
  });
});
