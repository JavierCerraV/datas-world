// Respuesta de una persona a un instrumento (spec 045 R-005): determinista, explicable y sin LLM.
import type { EntityId } from '../ids.ts';
import type { Rng } from '../rng.ts';
import { isIndicator } from './indicators.ts';
import type { IndicatorKey } from './indicators.ts';
import type { Answer, Instrument, InstrumentItem, ResponseResult } from './types.ts';

/** Ruido de la respuesta (045 §8, [M]). */
export const RESPONSE_NOISE = 0.05;

/** Flujo con nombre de una respuesta (023): `sys:instrument` → aplicación → persona. */
export const responseRng = (root: Rng, administration: string, citizen: EntityId): Rng =>
  root.fork('sys:instrument').fork(administration).fork(citizen);

/** Flujo del muestreo de una aplicación: no consume del de ninguna respuesta. */
export const samplingRng = (root: Rng, administration: string): Rng => root.fork('sys:instrument').fork(administration).fork('muestreo');

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** 045 INV-003: solo instrumentos revisados y solo indicadores del catálogo. */
export function checkInstrument(ins: Instrument): void {
  if (ins.status !== 'revisado') throw new Error(`El instrumento ${ins.id} no está revisado (${ins.status})`);
  for (const it of ins.items) {
    if (!it.options.length) throw new Error(`El ítem ${it.n} de ${ins.id} no tiene opciones`);
    for (const m of it.mapping) if (!isIndicator(m.indicator)) throw new Error(`Indicador fuera del catálogo en el ítem ${it.n}: ${m.indicator}`);
  }
}

function answerItem(it: InstrumentItem, values: Readonly<Record<IndicatorKey, number>>, rng: Rng): Answer {
  const basis = it.mapping.map((m) => ({ indicator: m.indicator, value: values[m.indicator as IndicatorKey] }));
  const total = it.mapping.reduce((s, m) => s + Math.abs(m.weight), 0);
  if (!total) return { n: it.n, value: null, basis, intensity: null };
  const latent = it.mapping.reduce((s, m, i) => s + Math.abs(m.weight) * (m.weight >= 0 ? basis[i]!.value : 1 - basis[i]!.value), 0) / total;
  const noisy = clamp01(latent + rng.normal(0, RESPONSE_NOISE));
  const intensity = it.reversed ? 1 - noisy : noisy;
  const vals = it.options.map((o) => o.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const target = lo + intensity * (hi - lo);
  let best = it.options[0]!.value;
  for (const o of it.options) {
    const d = Math.abs(o.value - target) - Math.abs(best - target);
    if (d < -1e-9 || (Math.abs(d) <= 1e-9 && o.value < best)) best = o.value;
  }
  return { n: it.n, value: best, basis, intensity: r3(intensity) };
}

/** Puntuación: suma o media de los ítems que puntúan. */
export function scoreOf(ins: Instrument, answers: readonly Answer[], items?: readonly number[]): number {
  const vals = answers.filter((a) => a.value !== null && (!items || items.includes(a.n))).map((a) => a.value!);
  if (!vals.length) return 0;
  const sum = vals.reduce((s, x) => s + x, 0);
  return ins.scoring.method === 'mean' ? r3(sum / vals.length) : sum;
}

/** Etiqueta del punto de corte que contiene la puntuación, o «sin categoría». */
export function categoryOf(ins: Instrument, score: number): string {
  return ins.cutoffs.find((c) => score >= c.min && score <= c.max)?.label ?? 'sin categoría';
}

/**
 * CA-003: la respuesta de la persona. `values` son sus indicadores (`indicatorValues`) y `rng` su flujo
 * (`responseRng`). El estilo de respuesta (R-006) es neutro hasta decidir de dónde sale (MODULE.md §8).
 */
export function answerInstrument(ins: Instrument, values: Readonly<Record<IndicatorKey, number>>, rng: Rng): ResponseResult {
  checkInstrument(ins);
  const items = [...ins.items].sort((a, b) => a.n - b.n);
  const answers = items.map((it) => answerItem(it, values, rng.fork(it.n)));
  const score = scoreOf(ins, answers);
  const result: ResponseResult = {
    answers,
    score,
    category: categoryOf(ins, score),
    style: { acquiescence: 0, desirability: 0, noise: RESPONSE_NOISE },
  };
  if (ins.scoring.subscales?.length)
    result.subscores = Object.fromEntries(ins.scoring.subscales.map((s) => [s.name, scoreOf(ins, answers, s.items)]));
  return result;
}
