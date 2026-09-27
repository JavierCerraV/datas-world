// Tono del turno del visitante (spec 043 R-004): la etiqueta del modo prueba, si no el clasificador LLM con
// salida validada y tiempo máximo, y si no (o con `mock`) las reglas léxicas del catálogo.
import { z } from 'zod';
import type { Gateway } from '../gateway.ts';
import type { ToneInfo } from './catalog.ts';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Reglas léxicas: gana el tono con más palabras clave; en empate, el de mayor intensidad; sin coincidencias, neutro o curioso. */
export function lexicalTone(tones: readonly ToneInfo[], text: string): string {
  const t = fold(text);
  let best: { key: string; hits: number; magnitude: number } | undefined;
  for (const tone of tones) {
    const hits = tone.keywords.filter((k) => t.includes(fold(k))).length;
    if (hits === 0) continue;
    if (!best || hits > best.hits || (hits === best.hits && tone.magnitude > best.magnitude)) best = { key: tone.key, hits, magnitude: tone.magnitude };
  }
  if (best) return best.key;
  return t.includes('?') ? 'curioso' : 'neutro';
}

function classifierPrompt(tones: readonly ToneInfo[]): string {
  return [
    'Clasifica el tono del mensaje que un visitante le escribe a una persona en un chat. Elige exactamente uno de estos tonos:',
    ...tones.map((t) => `- ${t.key}: ${t.description} Ejemplos: ${t.examples.map((x) => `«${x}»`).join(' ')}`),
    'Responde solo con JSON: {"tone": "<clave>"}.',
  ].join('\n');
}

export interface ToneResult {
  /** El que se usa. */
  tone: string;
  toneTag?: string;
  toneLlm?: string;
  toneLexical: string;
  llmRef?: string;
}

export async function classifyTone(gw: Gateway, tones: readonly ToneInfo[], text: string, toneTag?: string): Promise<ToneResult> {
  const toneLexical = lexicalTone(tones, text);
  const keys = tones.map((t) => t.key) as [string, ...string[]];
  const r = await gw.run({
    purpose: 'classify',
    system: [{ text: classifierPrompt(tones), cacheable: true }],
    messages: [{ role: 'user', text }],
    schema: z.object({ tone: z.enum(keys) }),
  });
  const toneLlm = r.source !== 'fallback' ? r.data?.tone : undefined;
  const tone = toneTag ?? toneLlm ?? toneLexical;
  return { tone, ...(toneTag ? { toneTag } : {}), ...(toneLlm ? { toneLlm } : {}), toneLexical, ...(r.recordKey && r.source !== 'fallback' ? { llmRef: r.recordKey } : {}) };
}
