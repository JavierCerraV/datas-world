// Adaptador para APIs compatibles con OpenAI (spec 026 R-006): otro proveedor o un modelo local. No es la vía
// de Claude (esa es el SDK oficial, `anthropic.ts`). Usa `fetch` y las variables `LLM_BASE_URL` y `LLM_API_KEY`.
import type { ProviderAdapter, ProviderCall, ProviderResponse } from './types.ts';

interface Chunk {
  choices?: { delta?: { content?: string }; message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const usageOf = (u: Chunk['usage']) => ({ inputTokens: u?.prompt_tokens ?? 0, outputTokens: u?.completion_tokens ?? 0, cachedTokens: 0, cacheWriteTokens: 0 });

export function openaiCompatibleAdapter(opts: { baseUrl?: string; apiKey?: string } = {}): ProviderAdapter {
  return {
    async call(c: ProviderCall): Promise<ProviderResponse> {
      const baseUrl = (opts.baseUrl ?? process.env.LLM_BASE_URL ?? '').replace(/\/$/, '');
      if (!baseUrl) throw new Error('openai_compatible: falta la URL base (LLM_BASE_URL)');
      const apiKey = opts.apiKey ?? process.env.LLM_API_KEY;
      const body = {
        model: c.model,
        temperature: c.temperature,
        max_tokens: c.maxOutputTokens,
        stream: Boolean(c.onText),
        ...(c.onText ? { stream_options: { include_usage: true } } : {}),
        messages: [{ role: 'system', content: c.system.map((p) => p.text).join('\n\n') }, ...c.messages.map((m) => ({ role: m.role, content: m.text }))],
        ...(c.jsonSchema ? { response_format: { type: 'json_schema', json_schema: { name: 'salida', schema: c.jsonSchema, strict: true } } } : {}),
      };
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify(body),
        signal: c.signal,
      });
      if (!res.ok) throw new Error(`openai_compatible: HTTP ${res.status}`);
      if (!c.onText) {
        const j = (await res.json()) as Chunk;
        return { text: j.choices?.[0]?.message?.content ?? '', usage: usageOf(j.usage) };
      }
      // Server-sent events: líneas `data: {...}` y `data: [DONE]`.
      const start = performance.now();
      let firstTokenMs: number | undefined;
      let text = '';
      let usage: Chunk['usage'];
      let buf = '';
      const decoder = new TextDecoder();
      for await (const part of res.body as unknown as AsyncIterable<Uint8Array>) {
        buf += decoder.decode(part, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          const j = JSON.parse(data) as Chunk;
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) {
            firstTokenMs ??= performance.now() - start;
            text += delta;
            c.onText(delta);
          }
          if (j.usage) usage = j.usage;
        }
      }
      return { text, usage: usageOf(usage), ...(firstTokenMs !== undefined ? { firstTokenMs } : {}) };
    },
  };
}
