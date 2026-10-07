// Tipos de la pasarela LLM (spec 026 §3). Quien llama pide "un resultado para este propósito"; no sabe qué
// proveedor ni qué modelo lo produce (R-006).
import type { z } from 'zod';

export const PURPOSES = ['dialogue', 'classify', 'verify', 'summarize', 'decision', 'diary', 'session'] as const;
export type Purpose = (typeof PURPOSES)[number];

export type ProviderName = 'anthropic' | 'openai_compatible' | 'mock';

export interface ModelConfig {
  provider: ProviderName;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  /** Tiempo máximo de la respuesta completa (R-009). */
  timeoutMs: number;
  /** Solo `openai_compatible`. */
  baseUrl?: string;
  /** Precio por millón de tokens en dólares, para el coste (R-013). Sin él, el coste es 0. */
  price?: { input: number; output: number };
}

export interface GatewayConfig {
  /** `null` = propósito desactivado: se usa directamente el respaldo de quien llama. */
  purposes: Record<Purpose, ModelConfig | null>;
  budget: { dailyTokens: number; monthlyCostCents: number };
  /** Reintentos si una salida estructurada no valida (R-010). */
  repairRetries: number;
  /** Registros que se guardan en memoria (026 §8, `RECORD_LRU`). */
  recordLru: number;
  /** Días tras los que se podan los registros que no afectan al mundo (`RECORD_TTL_DAYS`). */
  recordTtlDays: number;
}

/** Parte del prompt; las cacheables van primero (R-008). */
export interface PromptPart {
  text: string;
  cacheable: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface LlmRequest<T = unknown> {
  purpose: Purpose;
  citizenId?: string;
  system: PromptPart[];
  messages: ChatMessage[];
  /** Salida estructurada validada con Zod (R-010); sin schema, la salida es texto. */
  schema?: z.ZodType<T>;
  /** Streaming de texto (R-007): cada fragmento según llega. Solo sin schema. */
  onText?: (chunk: string) => void;
}

export type Source = 'network' | 'record' | 'mock' | 'fallback';
export type FallbackReason = 'budget' | 'timeout' | 'invalid' | 'disabled' | 'network_error';

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
}

export const NO_USAGE: Usage = Object.freeze({ inputTokens: 0, outputTokens: 0, cachedTokens: 0, cacheWriteTokens: 0 });

export interface LlmResult<T = unknown> {
  text?: string;
  data?: T;
  source: Source;
  fallbackReason?: FallbackReason;
  /** Mensaje del proveedor cuando falló (sin claves), para diagnosticar. */
  errorDetail?: string;
  usage: Usage;
  /** Millonésimas de dólar (entero). */
  costMicros: number;
  latencyMs: { firstToken?: number; total: number };
  model: string;
  recordKey: string;
}

/** Registro de una respuesta (tabla `llm_records`, fuera del stateHash; R-003). */
export interface LlmRecord {
  key: string;
  purpose: Purpose;
  model: string;
  response: { text?: string; data?: unknown };
  usage: Usage;
  costMicros: number;
  /** Fecha real ISO: la pasarela no es el motor. */
  createdAt: string;
  affectsWorld: boolean;
}

/** Almacén de registros. La versión SQLite llega con la persistencia (L3); aquí hay una en memoria. */
export interface RecordStore {
  get(key: string): LlmRecord | undefined;
  put(record: LlmRecord): void;
  markAffectsWorld(key: string): void;
  /** Borra los que no afectan al mundo creados antes de `beforeIso`; devuelve cuántos. */
  prune(beforeIso: string): number;
}
