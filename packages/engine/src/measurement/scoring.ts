// Corrección de los instrumentos (spec 045 R-001, INV-003): suma de ítems, subescalas del DASS-21 y banda de la ficha.
import { INSTRUMENTS } from './instruments.ts';
import type { Cutoff, InstrumentId } from './instruments.ts';

export interface Score {
  total: number;
  /** Subescalas (solo DASS-21): suma cruda de sus ítems. */
  subscales?: Record<string, number>;
  /** Banda de la ficha del total (o, en el DASS-21, de cada subescala). */
  band: string;
  bands?: Record<string, string>;
}

const bandOf = (cuts: readonly Cutoff[], v: number, subscale?: string): string =>
  cuts.find((c) => c.subscale === subscale && v >= c.from && v <= c.to)?.label ?? 'fuera de rango';

/** Puntuación de un vector de respuestas (una por ítem, en orden). Lanza si falta alguna o sale de la escala. */
export function scoreInstrument(id: InstrumentId, responses: readonly number[]): Score {
  const ins = INSTRUMENTS[id];
  if (responses.length !== ins.items.length) throw new Error(`${id}: se esperaban ${ins.items.length} respuestas y llegaron ${responses.length}`);
  for (const r of responses) if (!Number.isInteger(r) || r < ins.min || r > ins.max) throw new Error(`${id}: respuesta fuera de la escala (${r})`);
  const total = responses.reduce((s, r) => s + r, 0);
  if (!ins.subscales) return { total, band: bandOf(ins.cutoffs, total) };
  const subscales: Record<string, number> = {};
  for (const s of ins.subscales) subscales[s] = ins.items.reduce((sum, it, i) => sum + (it.subscale === s ? responses[i]! : 0), 0);
  const bands = Object.fromEntries(ins.subscales.map((s) => [s, bandOf(ins.cutoffs, subscales[s]!, s)]));
  return { total, subscales, band: ins.subscales.map((s) => bands[s]).join(' · '), bands };
}
