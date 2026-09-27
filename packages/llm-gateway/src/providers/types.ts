// Contrato común de los adaptadores de proveedor (spec 026 §2).
import type { ChatMessage, PromptPart, Usage } from '../types.ts';

export interface ProviderCall {
  model: string;
  temperature: number;
  maxOutputTokens: number;
  system: PromptPart[];
  messages: ChatMessage[];
  /** Esquema JSON de la salida estructurada (R-010); sin él, texto. */
  jsonSchema?: Record<string, unknown>;
  /** Streaming (R-007). */
  onText?: (chunk: string) => void;
  signal: AbortSignal;
}

export interface ProviderResponse {
  text: string;
  usage: Usage;
  /** Milisegundos hasta el primer fragmento (solo en streaming). */
  firstTokenMs?: number;
  /** El proveedor declinó responder (por ejemplo, `stop_reason: "refusal"`). */
  refused?: boolean;
}

export interface ProviderAdapter {
  call(c: ProviderCall): Promise<ProviderResponse>;
}
