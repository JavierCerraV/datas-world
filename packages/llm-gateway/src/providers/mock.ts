// Proveedor `mock` (spec 026 R-011): determinista. La respuesta sale de una función de quien llama (o de un eco),
// con una latencia simulada por fragmento para probar el streaming y los tiempos máximos.
import type { ProviderAdapter, ProviderCall, ProviderResponse } from './types.ts';

export type MockResponder = (c: Omit<ProviderCall, 'signal' | 'onText'>) => string | Promise<string>;

const tokens = (s: string) => Math.ceil(s.length / 4);
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (ms <= 0) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(signal.reason ?? new Error('abortado'));
    }, { once: true });
  });

export function mockAdapter(respond: MockResponder = (c) => c.messages.at(-1)?.text ?? '', opts: { chunkDelayMs?: number } = {}): ProviderAdapter {
  const delay = opts.chunkDelayMs ?? 0;
  return {
    async call(c: ProviderCall): Promise<ProviderResponse> {
      const { signal, onText, ...rest } = c;
      const text = await respond(rest);
      const usage = { inputTokens: tokens(c.system.map((p) => p.text).join('') + c.messages.map((m) => m.text).join('')), outputTokens: tokens(text), cachedTokens: 0, cacheWriteTokens: 0 };
      if (!onText) {
        await sleep(delay, signal);
        return { text, usage };
      }
      const start = performance.now();
      let firstTokenMs: number | undefined;
      for (const piece of text.match(/\S+\s*/g) ?? []) {
        await sleep(delay, signal);
        firstTokenMs ??= performance.now() - start;
        onText(piece);
      }
      return { text, usage, ...(firstTokenMs !== undefined ? { firstTokenMs } : {}) };
    },
  };
}
