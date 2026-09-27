// Clave de registro (spec 026 R-003): sha256 del proveedor, el modelo, el propósito, los parámetros y el prompt
// serializado de forma canónica. La misma petición da la misma clave en cualquier proceso.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { LlmRequest, ModelConfig } from './types.ts';

const canonical = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
};

export function recordKey(cfg: ModelConfig, req: LlmRequest<unknown>): string {
  const body = {
    provider: cfg.provider,
    model: cfg.model,
    purpose: req.purpose,
    temperature: cfg.temperature,
    maxOutputTokens: cfg.maxOutputTokens,
    system: req.system.map((p) => p.text),
    messages: req.messages,
    schema: req.schema ? z.toJSONSchema(req.schema) : null,
  };
  return createHash('sha256').update(canonical(body)).digest('hex');
}
