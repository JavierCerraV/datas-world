// Adaptador de Anthropic con el SDK oficial (spec 026; ADR-003). Haiku 4.5 no usa pensamiento adaptativo ni
// `effort`, y admite `temperature`; Haiku 5.5 es al revés y rechaza `temperature`, así que cada parámetro viaja
// solo si está configurado (R-014). Caché de prompts (R-008): la última parte cacheable del sistema lleva
// `cache_control`, así que todo lo anterior (instrucciones y vista de la persona) se reutiliza entre turnos.
import Anthropic from '@anthropic-ai/sdk';
import type { ProviderAdapter, ProviderCall, ProviderResponse } from './types.ts';

/** Petición de la API de mensajes (exportada para la prueba del constructor, CA-006). */
export function buildAnthropicParams(c: Omit<ProviderCall, 'signal' | 'onText'>): Anthropic.MessageCreateParamsNonStreaming {
  const cacheable = c.system.filter((p) => p.cacheable);
  const ordered = [...cacheable, ...c.system.filter((p) => !p.cacheable)];
  const system: Anthropic.TextBlockParam[] = ordered.map((p, i) => ({
    type: 'text',
    text: p.text,
    ...(i === cacheable.length - 1 ? { cache_control: { type: 'ephemeral' } } : {}),
  }));
  const outputConfig: Anthropic.OutputConfig = {
    ...(c.effort ? { effort: c.effort } : {}),
    ...(c.jsonSchema ? { format: { type: 'json_schema', schema: c.jsonSchema } } : {}),
  };
  return {
    model: c.model,
    max_tokens: c.maxOutputTokens,
    ...(c.temperature !== undefined ? { temperature: c.temperature } : {}),
    ...(c.thinking ? { thinking: { type: c.thinking } } : {}),
    system,
    messages: c.messages.map((m) => ({ role: m.role, content: m.text })),
    ...(c.effort || c.jsonSchema ? { output_config: outputConfig } : {}),
  };
}

const usageOf = (u: Anthropic.Usage) => ({
  inputTokens: u.input_tokens,
  outputTokens: u.output_tokens,
  cachedTokens: u.cache_read_input_tokens ?? 0,
  cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
});

const textOf = (m: Anthropic.Message) =>
  m.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');

/** Adaptador; sin cliente, `new Anthropic()` resuelve la credencial del entorno (`ANTHROPIC_API_KEY`). */
export function anthropicAdapter(client: Anthropic = new Anthropic()): ProviderAdapter {
  return {
    async call(c: ProviderCall): Promise<ProviderResponse> {
      const params = buildAnthropicParams(c);
      if (!c.onText) {
        const m = await client.messages.create(params, { signal: c.signal });
        return { text: textOf(m), usage: usageOf(m.usage), refused: m.stop_reason === 'refusal' };
      }
      const start = performance.now();
      let firstTokenMs: number | undefined;
      const stream = client.messages.stream(params, { signal: c.signal });
      for await (const ev of stream) {
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
          firstTokenMs ??= performance.now() - start;
          c.onText(ev.delta.text);
        }
      }
      const m = await stream.finalMessage();
      return { text: textOf(m), usage: usageOf(m.usage), ...(firstTokenMs !== undefined ? { firstTokenMs } : {}), refused: m.stop_reason === 'refusal' };
    },
  };
}
