// Tipos del bucle de simulación (spec 021 §3): sistemas enchufables por fases, parches y niveles.
import type { WorldMinute } from '../calendar.ts';
import type { Capability } from '../capabilities.ts';
import type { ColumnType } from '../components.ts';
import type { NewEvent } from '../events.ts';
import type { EntityId } from '../ids.ts';
import type { Rng } from '../rng.ts';
import type { World } from '../world.ts';

/** 0 estadístico · 1 rutina por bloques · 2 decisión por tick · 3 detalle social · 4 observada. */
export type SimLevel = 0 | 1 | 2 | 3 | 4;

/** Cada cuánto corre un sistema: cada tick, en punto cada hora o a medianoche. */
export type Cadence = 'tick' | 'hour' | 'day';

/** Fases del tick, en su orden (021 R-001). `scheduler` la atiende el propio tick, antes de los sistemas. */
export const PHASES = Object.freeze([
  'needs',
  'decision',
  'actions',
  'interactions',
  'economy',
  'information',
  'memory',
  'end_of_day',
] as const);
export type Phase = (typeof PHASES)[number];

/** Vista de solo lectura del mundo (R-007). En pruebas, además, se congela en tiempo de ejecución. */
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends Float32Array | Int32Array | Uint8Array
    ? Readonly<T>
    : T extends Map<infer K, infer V>
      ? ReadonlyMap<K, DeepReadonly<V>>
      : T extends object
        ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
        : T;
export type WorldView = DeepReadonly<World>;

export interface TickCtx {
  now: WorldMinute;
  /** Filas (número del CIT) de las personas que tocan a este sistema, en orden ascendente. */
  citizens: readonly number[];
  level: (row: number) => SimLevel;
}

/**
 * Cambio pedido por un sistema; el bucle lo aplica al final de su fase, en orden de sistema y de emisión.
 * - `set`/`add`: una celda de una columna de ciudadanos (`add` suma; en `i32`, el resultado debe ser entero).
 * - `entity`: campos de primer nivel de una entidad existente (ciudadano, hogar, lugar, organización u objeto).
 */
export type Patch =
  | { op: 'set'; type: ColumnType; column: string; row: number; value: number }
  | { op: 'add'; type: ColumnType; column: string; row: number; delta: number }
  | { op: 'entity'; id: EntityId; fields: Record<string, unknown> };

/** Petición de acción (017): la valida y aplica el validador que se registre con los sistemas. */
export interface ActionRequest {
  actor: EntityId;
  kind: string;
  target?: EntityId;
  params?: unknown;
  reason: NewEvent['causes'];
}

export interface SystemOutput {
  patches?: Patch[];
  /** Eventos nuevos; el bucle les asigna id y minuto al aplicar la fase, en orden. */
  events?: NewEvent[];
  actions?: ActionRequest[];
}

export interface System {
  id: string;
  phase: Phase;
  order: number;
  capability: Capability;
  cadence: Cadence;
  /** Personas con nivel < `minLevel` no pasan por `run` (sí por `runCoarse`, si existe). */
  minLevel: SimLevel;
  run(view: WorldView, ctx: TickCtx, rng: Rng): SystemOutput;
  runCoarse?(view: WorldView, ctx: TickCtx, rng: Rng): SystemOutput;
}

/** Resultado de validar y aplicar una acción (017). Se inyecta al crear el bucle. */
export interface ActionOutcome {
  ok: boolean;
  rejected?: string;
  patches?: Patch[];
  events?: NewEvent[];
}
export type ActionValidator = (view: WorldView, action: ActionRequest) => ActionOutcome;
