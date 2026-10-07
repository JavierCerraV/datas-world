// Núcleo de la pasarela (spec 026 R-003 a R-013): la única puerta a los proveedores. Busca en el registro,
// comprueba el presupuesto, llama con tiempo máximo, valida y repara las salidas estructuradas, registra y mide.
// Nunca lanza por un fallo del proveedor: devuelve `source: 'fallback'` y quien llama usa su respaldo.
import { z } from 'zod';
import { recordKey } from './key.ts';
import { MemoryRecordStore } from './records.ts';
import type { ProviderAdapter } from './providers/types.ts';
import { NO_USAGE } from './types.ts';
import type { FallbackReason, GatewayConfig, LlmRequest, LlmResult, ModelConfig, ProviderName, Purpose, RecordStore, Source, Usage } from './types.ts';

export interface GatewayOptions {
  config: GatewayConfig;
  adapters: Partial<Record<ProviderName, ProviderAdapter>>;
  records?: RecordStore;
  /** Reloj real (la pasarela no es el motor); inyectable en las pruebas. */
  now?: () => Date;
}

interface PurposeMetrics {
  calls: number;
  bySource: Record<Source, number>;
  byFallback: Partial<Record<FallbackReason, number>>;
  usage: Usage;
  costMicros: number;
  firstToken: number[];
  total: number[];
}

const MAX_SAMPLES = 1000;
const pct = (xs: number[], p: number) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};

/** R-013: coste en millonésimas de dólar; lo leído del caché cuesta el 10 % y lo escrito el 125 %. */
export function costMicros(cfg: ModelConfig, u: Usage): number {
  if (!cfg.price) return 0;
  const { input, output } = cfg.price; // dólares por millón = micros por token
  return Math.round(u.inputTokens * input + u.outputTokens * output + u.cachedTokens * input * 0.1 + u.cacheWriteTokens * input * 1.25);
}

/** El esquema que se envía al proveedor, sin la clave `$schema` que añade Zod. */
const withoutMeta = (s: Record<string, unknown>): Record<string, unknown> => {
  const { $schema: _meta, ...rest } = s;
  return rest;
};

/** Extrae el JSON de una respuesta de texto (tolera un bloque ```json). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1]! : text;
  const a = body.indexOf('{');
  const b = body.lastIndexOf('}');
  return JSON.parse(a >= 0 && b > a ? body.slice(a, b + 1) : body);
}

export class Gateway {
  readonly config: GatewayConfig;
  readonly records: RecordStore;
  #adapters: Partial<Record<ProviderName, ProviderAdapter>>;
  #now: () => Date;
  #day = { key: '', tokens: 0 };
  #month = { key: '', micros: 0 };
  #metrics = new Map<Purpose, PurposeMetrics>();

  constructor(o: GatewayOptions) {
    this.config = o.config;
    this.#adapters = o.adapters;
    this.records = o.records ?? new MemoryRecordStore(o.config.recordLru);
    this.#now = o.now ?? (() => new Date());
  }

  /** R-004: ¿queda presupuesto hoy y este mes? */
  budgetLeft(): boolean {
    this.#roll();
    return this.#day.tokens < this.config.budget.dailyTokens && this.#month.micros < this.config.budget.monthlyCostCents * 10_000;
  }

  async run<T>(req: LlmRequest<T>): Promise<LlmResult<T>> {
    const t0 = performance.now();
    const cfg = this.config.purposes[req.purpose];
    let errorDetail: string | undefined;
    const fallback = (reason: FallbackReason, key = '', partial?: string): LlmResult<T> => {
      const r: LlmResult<T> = {
        ...(errorDetail ? { errorDetail } : {}),
        ...(partial ? { text: partial } : {}),
        source: partial ? 'network' : 'fallback',
        fallbackReason: reason,
        usage: NO_USAGE,
        costMicros: 0,
        latencyMs: { total: performance.now() - t0 },
        model: cfg?.model ?? '',
        recordKey: key,
      };
      this.#measure(req.purpose, r);
      return r;
    };
    if (!cfg) return fallback('disabled');
    const key = recordKey(cfg, req as LlmRequest<unknown>);

    // R-003: una petición ya registrada no llama a la red.
    const rec = this.records.get(key);
    if (rec) {
      if (req.onText && rec.response.text) req.onText(rec.response.text);
      const r: LlmResult<T> = {
        ...(rec.response.text !== undefined ? { text: rec.response.text } : {}),
        ...(rec.response.data !== undefined ? { data: rec.response.data as T } : {}),
        source: 'record', usage: rec.usage, costMicros: 0, latencyMs: { total: performance.now() - t0 }, model: rec.model, recordKey: key,
      };
      this.#measure(req.purpose, r);
      return r;
    }
    if (!this.budgetLeft()) return fallback('budget', key);
    const adapter = this.#adapters[cfg.provider];
    if (!adapter) return fallback('disabled', key);

    const jsonSchema = req.schema ? withoutMeta(z.toJSONSchema(req.schema) as Record<string, unknown>) : undefined;
    let messages = req.messages;
    const usage: Usage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0, cacheWriteTokens: 0 };
    for (let attempt = 0; attempt <= (req.schema ? this.config.repairRetries : 0); attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(new Error('timeout')), cfg.timeoutMs);
      let streamed = '';
      let res;
      try {
        res = await adapter.call({
          model: cfg.model, temperature: cfg.temperature, maxOutputTokens: cfg.maxOutputTokens, system: req.system, messages,
          ...(jsonSchema ? { jsonSchema } : {}),
          ...(req.onText && !req.schema ? { onText: (s: string) => { streamed += s; req.onText!(s); } } : {}),
          signal: ctrl.signal,
        });
      } catch (err) {
        // Solo el mensaje del proveedor (estado y tipo de error), nunca la petición: no arrastra claves (026 INV-004).
        errorDetail = String((err as { status?: number }).status ?? '') + ' ' + ((err as Error).message ?? '').slice(0, 200).replace(/sk-[A-Za-z0-9_-]+/g, '[clave]');
        return fallback(ctrl.signal.aborted ? 'timeout' : 'network_error', key, streamed || undefined);
      } finally {
        clearTimeout(timer);
      }
      for (const k of Object.keys(usage) as (keyof Usage)[]) usage[k] += res.usage[k];
      this.#spend(cfg, res.usage);
      if (res.refused) return fallback('invalid', key);
      let data: T | undefined;
      if (req.schema) {
        let error = '';
        try {
          const parsed = req.schema.safeParse(extractJson(res.text));
          if (parsed.success) data = parsed.data;
          else error = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        } catch (e) {
          error = (e as Error).message;
        }
        if (data === undefined) {
          // R-010: se reintenta con el error de validación en el mensaje.
          messages = [...messages, { role: 'assistant', text: res.text }, { role: 'user', text: `Tu respuesta no cumple el formato pedido (${error}). Responde solo con el JSON válido.` }];
          continue;
        }
      }
      const result: LlmResult<T> = {
        ...(req.schema ? { data: data as T } : { text: res.text }),
        source: cfg.provider === 'mock' ? 'mock' : 'network',
        usage, costMicros: costMicros(cfg, usage),
        latencyMs: { ...(res.firstTokenMs !== undefined ? { firstToken: res.firstTokenMs } : {}), total: performance.now() - t0 },
        model: cfg.model, recordKey: key,
      };
      this.records.put({
        key, purpose: req.purpose, model: cfg.model, response: req.schema ? { data } : { text: res.text }, usage, costMicros: result.costMicros,
        createdAt: this.#now().toISOString(), affectsWorld: false,
      });
      this.#measure(req.purpose, result);
      return result;
    }
    return fallback('invalid', key);
  }

  /** R-013: métricas por propósito (tokens, coste, fuentes, respaldos y latencias p50/p95). */
  metrics() {
    return Object.fromEntries([...this.#metrics].map(([p, m]) => [p, {
      calls: m.calls, bySource: m.bySource, byFallback: m.byFallback, usage: m.usage, costMicros: m.costMicros,
      firstTokenP50: pct(m.firstToken, 0.5), firstTokenP95: pct(m.firstToken, 0.95), totalP50: pct(m.total, 0.5), totalP95: pct(m.total, 0.95),
    }]));
  }

  #roll(): void {
    const iso = this.#now().toISOString();
    if (this.#day.key !== iso.slice(0, 10)) this.#day = { key: iso.slice(0, 10), tokens: 0 };
    if (this.#month.key !== iso.slice(0, 7)) this.#month = { key: iso.slice(0, 7), micros: 0 };
  }

  #spend(cfg: ModelConfig, u: Usage): void {
    this.#roll();
    this.#day.tokens += u.inputTokens + u.outputTokens + u.cachedTokens + u.cacheWriteTokens;
    this.#month.micros += costMicros(cfg, u);
  }

  #measure(purpose: Purpose, r: LlmResult<unknown>): void {
    let m = this.#metrics.get(purpose);
    if (!m) {
      m = { calls: 0, bySource: { network: 0, record: 0, mock: 0, fallback: 0 }, byFallback: {}, usage: { ...NO_USAGE }, costMicros: 0, firstToken: [], total: [] };
      this.#metrics.set(purpose, m);
    }
    m.calls++;
    m.bySource[r.source]++;
    if (r.fallbackReason) m.byFallback[r.fallbackReason] = (m.byFallback[r.fallbackReason] ?? 0) + 1;
    for (const k of Object.keys(m.usage) as (keyof Usage)[]) m.usage[k] += r.source === 'record' ? 0 : r.usage[k];
    m.costMicros += r.costMicros;
    if (r.latencyMs.firstToken !== undefined) m.firstToken = [...m.firstToken, r.latencyMs.firstToken].slice(-MAX_SAMPLES);
    m.total = [...m.total, r.latencyMs.total].slice(-MAX_SAMPLES);
  }
}
