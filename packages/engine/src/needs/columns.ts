// Columnas de la spec 010 y sus valores iniciales (del prototipo, `newAgent`), según la personalidad (009).
import { ACTIVITY_COLUMN } from '../activity.ts';
import { defineColumn } from '../components.ts';
import type { ColumnType } from '../components.ts';
import type { Rng } from '../rng.ts';
import type { World } from '../world.ts';

export const NEEDS = ['need.hunger', 'need.energy', 'need.hygiene', 'need.social', 'need.fun'] as const;
export const EMOTIONS = ['emo.joy', 'emo.sadness', 'emo.anger', 'emo.fear', 'emo.shame'] as const;

export const NEEDS_COLUMNS: readonly [ColumnType, string, number][] = [
  ...NEEDS.map((n) => ['f32', n, 1] as [ColumnType, string, number]),
  ...EMOTIONS.map((e) => ['f32', e, 0] as [ColumnType, string, number]),
  ['f32', 'state.stress', 0],
  ['f32', 'state.mood', 0.5],
  ['f32', 'state.moodBaseline', 0.5],
  ['i32', 'state.sleepDebt', 0],
  ['i32', 'state.sleptToday', 0],
  ['u8', 'health.acute', 0],
  ['i32', 'health.acuteUntil', 0],
  ['f32', 'health.energyFactor', 1],
  ['u8', ACTIVITY_COLUMN, 0],
];

export function defineNeedsColumns(world: World): void {
  const c = world.components;
  for (const [type, name, initial] of NEEDS_COLUMNS) if (!(name in c[type])) defineColumn(c, type, name, initial);
}

/** Estabilidad emocional (el "estabilidad" del prototipo) = 1 − neuroticismo (009). */
export const stability = (world: World, row: number): number => 1 - (world.components.f32['pers.neuroticism']?.[row] ?? 0.5);

/**
 * Estado inicial de las personas activas (flujo `init:needs/<fila>`): rangos de `newAgent` del prototipo,
 * convertidos a "1 = satisfecha" (hambre 0,1–0,35 → 0,65–0,9; soledad 0,1–0,45 → compañía 0,55–0,9), y la línea
 * base del ánimo según la estabilidad emocional. Es parte de la creación del mundo, no un tick.
 */
export function initNeeds(world: World, rng: Rng): void {
  defineNeedsColumns(world);
  const f = world.components.f32;
  const active = world.components.u8.active!;
  for (let row = 1; row <= world.counters.CIT; row++) {
    if (active[row] !== 1) continue;
    const r = rng.fork('init:needs').fork(row);
    const range = (a: number, b: number) => a + (b - a) * r.next();
    f['need.hunger']![row] = range(0.65, 0.9);
    f['need.energy']![row] = range(0.65, 0.9);
    f['need.social']![row] = range(0.55, 0.9);
    f['need.hygiene']![row] = range(0.7, 1);
    f['need.fun']![row] = range(0.5, 0.9);
    f['state.stress']![row] = range(0.1, 0.35);
    f['state.mood']![row] = range(0.5, 0.72);
    f['state.moodBaseline']![row] = 0.55 + 0.12 * (stability(world, row) - 0.5);
  }
}
