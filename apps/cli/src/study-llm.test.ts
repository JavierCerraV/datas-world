// Spec 026 R-003 y 047 (piloto con proveedores de cuota baja): varias claves que se relevan cuando una se queda sin
// cuota, y un registro de respuestas en disco para retomar una sesión cortada sin repetir (ni volver a gastar) llamadas.
import { mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProviderAdapter } from '@datas-world/llm-gateway';
import { afterAll, describe, expect, it } from 'vitest';
import { FileRecordStore, keysOf, rotatingAdapter } from './study-llm.ts';

const dir = mkdtempSync(join(tmpdir(), 'llm-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const call = { model: 'm', maxOutputTokens: 10, system: [], messages: [{ role: 'user' as const, text: 'hola' }], signal: new AbortController().signal };
const usage = { inputTokens: 1, outputTokens: 1, cachedTokens: 0, cacheWriteTokens: 0 };
/** Adaptador que falla con `error` las primeras `fails` veces y luego responde con su nombre. */
const fake = (name: string, error: string | null, fails = Infinity) => {
  let n = 0;
  const a: ProviderAdapter & { calls: number } = {
    calls: 0,
    async call() {
      a.calls++;
      if (error && n++ < fails) throw new Error(error);
      return { text: name, usage };
    },
  };
  return a;
};
const quiet = { log: () => undefined, wait: async () => undefined };

describe('claves que se relevan', () => {
  it('lee una o varias claves del entorno, separadas por comas o espacios, sin repetir', () => {
    expect(keysOf({ LLM_API_KEYS: 'a, b\nc,a' })).toEqual(['a', 'b', 'c']);
    expect(keysOf({ LLM_API_KEY: 'sola' })).toEqual(['sola']);
    expect(keysOf({ LLM_API_KEYS: 'a,b', LLM_API_KEY: 'c' })).toEqual(['a', 'b']);
    expect(keysOf({})).toEqual([]);
  });

  it('cuando una clave se queda sin cuota pasa a la siguiente y se queda en ella', async () => {
    const a = fake('A', 'openai_compatible: HTTP 429 rate limit'), b = fake('B', null);
    const logs: string[] = [];
    const r = rotatingAdapter([a, b], { ...quiet, log: (l) => logs.push(l) });
    expect((await r.call(call)).text).toBe('B');
    expect((await r.call(call)).text).toBe('B');
    expect(a.calls).toBe(1); // no vuelve a probar la agotada mientras la otra responda
    expect(logs.join('\n')).toMatch(/clave 1 de 2/);
  });

  it('también releva con clave inválida o sin crédito (401, 402, 403)', async () => {
    for (const status of [401, 402, 403]) {
      const r = rotatingAdapter([fake('A', `openai_compatible: HTTP ${status}`), fake('B', null)], quiet);
      expect((await r.call(call)).text).toBe('B');
    }
  });

  it('un límite pasajero se supera esperando; si todas siguen sin cuota, falla diciendo cuántas claves probó', async () => {
    const waits: number[] = [];
    const flaky = rotatingAdapter([fake('A', 'HTTP 429', 2)], { log: () => undefined, wait: async (ms) => void waits.push(ms) });
    expect((await flaky.call(call)).text).toBe('A');
    expect(waits).toHaveLength(2);
    const dead = rotatingAdapter([fake('A', 'HTTP 429'), fake('B', 'HTTP 402 insufficient credits')], quiet);
    await expect(dead.call(call)).rejects.toThrow(/las 2 claves.*sin cuota/);
  });

  it('un error que no es de cuota no cambia de clave ni se reintenta', async () => {
    const a = fake('A', 'openai_compatible: HTTP 400 schema inválido'), b = fake('B', null);
    await expect(rotatingAdapter([a, b], quiet).call(call)).rejects.toThrow(/HTTP 400/);
    expect(b.calls).toBe(0);
  });
});

describe('registro de respuestas en disco', () => {
  const rec = (key: string, text: string) => ({ key, purpose: 'dialogue' as const, model: 'm', response: { text }, usage, costMicros: 7, createdAt: '2026-10-09T00:00:00Z', affectsWorld: false });

  it('lo guardado se recupera al reabrir, y una última línea cortada no impide leer el resto', () => {
    const path = join(dir, 'r.jsonl');
    const s = new FileRecordStore(path);
    s.put(rec('k1', 'uno'));
    s.put(rec('k2', 'dos'));
    appendFileSync(path, '{"key":"k3","purpo'); // el proceso murió escribiendo
    const again = new FileRecordStore(path);
    expect(again.get('k1')?.response.text).toBe('uno');
    expect(again.get('k2')?.costMicros).toBe(7);
    expect(again.get('k3')).toBeUndefined();
    expect(again.size).toBe(2);
    // Tras una línea cortada, lo nuevo se sigue pudiendo leer.
    again.put(rec('k4', 'cuatro'));
    expect(new FileRecordStore(path).get('k4')?.response.text).toBe('cuatro');
  });

  it('una respuesta vacía no se guarda: al reanudar hay que volver a pedirla', () => {
    const path = join(dir, 'v.jsonl');
    const s = new FileRecordStore(path);
    s.put(rec('k1', '   '));
    s.put({ ...rec('k2', ''), response: { data: { ok: true } } });
    expect(s.get('k1')).toBeUndefined();
    expect(new FileRecordStore(path).get('k2')?.response.data).toEqual({ ok: true });
    expect(readFileSync(path, 'utf8').trim().split('\n')).toHaveLength(1);
  });

  it('un archivo que no es un registro se rechaza en vez de pisarlo', () => {
    const path = join(dir, 'otro.jsonl');
    writeFileSync(path, 'esto no es JSON\notra línea\n');
    expect(() => new FileRecordStore(path)).toThrow(/no es un registro/);
  });
});
