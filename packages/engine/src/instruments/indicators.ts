// Catálogo cerrado de indicadores (spec 045 R-004). Cada indicador es una función pura sobre el estado y la
// historia de una persona en la ventana de `recallDays` días, con valor en [0,1]: 0 = sin síntoma, 1 = extremo.
// Lo que el motor no modela (apetito, ideación suicida…) no está aquí: el ítem queda «sin base en el motor».
import { MINUTES_PER_DAY } from '../calendar.ts';
import type { WorldEvent } from '../events.ts';
import type { EntityId } from '../ids.ts';
import { idNumber } from '../ids.ts';
import type { DayPoint } from '../lifereport/types.ts';
import type { WorldView } from '../simulation/system.ts';

export const INDICATORS_VERSION = 1;

export const INDICATORS = Object.freeze([
  'animo_bajo',
  'tristeza',
  'anhedonia',
  'sueno_alterado',
  'energia_baja',
  'culpa',
  'rumiacion',
  'aislamiento',
  'estres',
  'miedo',
  'irritabilidad',
  'preocupacion_economica',
] as const);
export type IndicatorKey = (typeof INDICATORS)[number];
export const isIndicator = (k: string): k is IndicatorKey => (INDICATORS as readonly string[]).includes(k);

/**
 * Umbrales [M] que convierten el estado en síntoma: por encima de `from` (o por debajo, según el caso) no cuenta,
 * y en `to` vale 1. Se calibran con la validación del mundo de ejemplo (045 CA-004, CA-005; tarea I10).
 */
export const INDICATOR_PARAMS = Object.freeze({
  mood: { from: 0.6, to: 0.2 },
  stress: { from: 0.2, to: 0.8 },
  energy: { from: 0.7, to: 0.1 },
  social: { from: 0.6, to: 0.1 },
  fun: { from: 0.6, to: 0.1 },
  /** Deuda de sueño (minutos) que vale 1. */
  sleepDebtMax: 480,
  /** Fracción de días de la ventana con el hecho que vale 1. */
  daysFull: 0.5,
  /** Ventana cuando el instrumento pregunta por el estado actual (`recallDays: null`). */
  defaultDays: 14,
});

export interface IndicatorInput {
  view: WorldView;
  id: EntityId;
  /** Los hechos en que participa la persona, en orden de id. */
  events: readonly WorldEvent[];
  /** Su trayectoria diaria (020 R-001), en orden de día. */
  trajectory: readonly DayPoint[];
  now: number;
  recallDays: number | null;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** 0 en `from`, 1 en `to` (en cualquier sentido). */
const ramp = (x: number, p: { from: number; to: number }) => clamp01((x - p.from) / (p.to - p.from));
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Valores de todos los indicadores para una persona. Determinista y sin E/S. */
export function indicatorValues(input: IndicatorInput): Record<IndicatorKey, number> {
  const { view, id, events, trajectory, now } = input;
  const days = input.recallDays ?? INDICATOR_PARAMS.defaultDays;
  const row = idNumber(id);
  const f = view.components.f32;
  const at = (col: string, d: number) => f[col]?.[row] ?? d;
  const since = now - days * MINUTES_PER_DAY;
  const today = Math.floor(now / MINUTES_PER_DAY);
  const window = trajectory.filter((p) => p.day > today - days && p.day <= today);
  const mean = (key: 'mood' | 'stress', current: number) =>
    window.length ? window.reduce((s, p) => s + p[key], 0) / window.length : current;
  const recent = events.filter((e) => e.at > since && e.at <= now && e.participants.some((p) => p.id === id));
  const daysWith = (type: string) => new Set(recent.filter((e) => e.type === type).map((e) => Math.floor(e.at / MINUTES_PER_DAY))).size;
  const byDays = (n: number) => clamp01(n / (days * INDICATOR_PARAMS.daysFull));

  // Anhedonia: necesidad de disfrute baja y caída del ocio frente a la ventana anterior.
  const leisure = (from: number, to: number) => events.filter((e) => e.type === 'LEISURE_DONE' && e.at > from && e.at <= to && e.participants.some((p) => p.id === id)).length;
  const now_ = leisure(since, now);
  const before = leisure(since - days * MINUTES_PER_DAY, since);
  const drop = before > 0 ? clamp01(1 - now_ / before) : 0;

  const encounters = recent.filter((e) => e.type === 'ENCOUNTER' || e.type === 'CONVERSATION_HELD' || e.type === 'PHONE_CALL_MADE').length;
  const money = recent.filter((e) => e.type === 'PAYMENT_MISSED' || e.type === 'RENT_LATE').length;
  const pressure = (view.components.u8['econ.debtPressure']?.[row] ?? 0) === 1 ? 0.6 : 0;

  const v: Record<IndicatorKey, number> = {
    animo_bajo: ramp(mean('mood', at('state.mood', 0.5)), INDICATOR_PARAMS.mood),
    tristeza: clamp01(at('emo.sadness', 0)),
    anhedonia: 0.5 * ramp(at('need.fun', 1), INDICATOR_PARAMS.fun) + 0.5 * drop,
    sueno_alterado: Math.max(byDays(daysWith('OVERSLEPT')), clamp01((view.components.i32['state.sleepDebt']?.[row] ?? 0) / INDICATOR_PARAMS.sleepDebtMax)),
    energia_baja: ramp(at('need.energy', 1), INDICATOR_PARAMS.energy),
    culpa: clamp01(at('emo.shame', 0)),
    rumiacion: byDays(daysWith('PNR_EPISODE')),
    aislamiento: 0.5 * ramp(at('need.social', 1), INDICATOR_PARAMS.social) + 0.5 * (1 - byDays(encounters)),
    estres: ramp(mean('stress', at('state.stress', 0)), INDICATOR_PARAMS.stress),
    miedo: clamp01(at('emo.fear', 0)),
    irritabilidad: clamp01(at('emo.anger', 0)),
    preocupacion_economica: clamp01(pressure + 0.2 * money),
  };
  for (const k of INDICATORS) v[k] = r3(v[k]);
  return v;
}
