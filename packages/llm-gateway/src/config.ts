// Configuración por propósito (spec 026 R-006, §8): se lee de `config/llm.json` (quien llama lee el archivo) y se
// valida con Zod. Las claves de API nunca van aquí: solo por variables de entorno.
import { z } from 'zod';
import { EFFORTS, PURPOSES } from './types.ts';
import type { GatewayConfig, ModelConfig } from './types.ts';

/** Haiku 4.5 (decisión del usuario, 2026-09-27): 1 USD por millón de tokens de entrada y 5 de salida. */
export const HAIKU: Pick<ModelConfig, 'provider' | 'model' | 'price'> = Object.freeze({
  provider: 'anthropic',
  model: 'claude-haiku-4-5-20251001',
  price: { input: 1, output: 5 },
});

/**
 * Haiku 5.5 (047, 2026-10-08): 0,10 USD por millón de tokens de entrada y 0,50 de salida hasta 100 000 tokens de
 * prompt. Rechaza `temperature`; se regula con `effort` (026 R-014).
 */
export const HAIKU_5_5: Pick<ModelConfig, 'provider' | 'model' | 'price'> = Object.freeze({
  provider: 'anthropic',
  model: 'claude-haiku-5-5',
  price: { input: 0.1, output: 0.5 },
});

export const DEFAULT_CONFIG: GatewayConfig = Object.freeze({
  purposes: {
    dialogue: { ...HAIKU, temperature: 0.8, maxOutputTokens: 300, timeoutMs: 8_000 },
    classify: { ...HAIKU, temperature: 0, maxOutputTokens: 50, timeoutMs: 800 },
    verify: { ...HAIKU, temperature: 0, maxOutputTokens: 400, timeoutMs: 10_000 },
    summarize: { ...HAIKU, temperature: 0.3, maxOutputTokens: 200, timeoutMs: 10_000 },
    therapist: null,
    decision: null,
    diary: null,
    session: null,
  },
  budget: { dailyTokens: 2_000_000, monthlyCostCents: 2_000 },
  repairRetries: 1,
  recordLru: 500,
  recordTtlDays: 90,
});

const modelSchema = z
  .object({
    provider: z.enum(['anthropic', 'openai_compatible', 'mock']),
    model: z.string().min(1),
    temperature: z.number().min(0).max(1).optional(),
    effort: z.enum(EFFORTS).optional(),
    thinking: z.literal('disabled').optional(),
    maxOutputTokens: z.number().int().positive(),
    timeoutMs: z.number().int().positive(),
    baseUrl: z.string().url().optional(),
    price: z.object({ input: z.number().nonnegative(), output: z.number().nonnegative() }).optional(),
  })
  .strict();

const configSchema = z
  .object({
    purposes: z.object(Object.fromEntries(PURPOSES.map((p) => [p, modelSchema.nullable()])) as Record<(typeof PURPOSES)[number], z.ZodNullable<typeof modelSchema>>).partial(),
    budget: z.object({ dailyTokens: z.number().int().positive(), monthlyCostCents: z.number().int().positive() }).partial().optional(),
    repairRetries: z.number().int().min(0).max(3).optional(),
    recordLru: z.number().int().min(100).max(5000).optional(),
    recordTtlDays: z.number().int().min(7).optional(),
  })
  .strict();

/** Valida `config/llm.json` y lo combina con los valores por defecto (un propósito ausente conserva el suyo). */
export function parseConfig(json: unknown): GatewayConfig {
  const c = configSchema.parse(json);
  return {
    purposes: { ...DEFAULT_CONFIG.purposes, ...c.purposes } as GatewayConfig['purposes'],
    budget: {
      dailyTokens: c.budget?.dailyTokens ?? DEFAULT_CONFIG.budget.dailyTokens,
      monthlyCostCents: c.budget?.monthlyCostCents ?? DEFAULT_CONFIG.budget.monthlyCostCents,
    },
    repairRetries: c.repairRetries ?? DEFAULT_CONFIG.repairRetries,
    recordLru: c.recordLru ?? DEFAULT_CONFIG.recordLru,
    recordTtlDays: c.recordTtlDays ?? DEFAULT_CONFIG.recordTtlDays,
  };
}
