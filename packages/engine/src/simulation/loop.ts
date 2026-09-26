// Bucle de sistemas de un tick (spec 021 R-001, R-005 a R-008, R-011).
import { MINUTES_PER_DAY } from '../calendar.ts';
import { makeEvent } from '../events.ts';
import type { WorldEvent } from '../events.ts';
import { idNumber } from '../ids.ts';
import type { Rng } from '../rng.ts';
import type { World } from '../world.ts';
import { applyPatches } from './patches.ts';
import { activeSystems } from './registry.ts';
import type { SystemRegistry } from './registry.ts';
import { PHASES } from './system.ts';
import type { ActionValidator, Cadence, SimLevel, System, SystemOutput, TickCtx } from './system.ts';
import { viewOf } from './view.ts';

export interface LoopOptions {
  /** Congelar la vista en tiempo de ejecución (R-007, CA-005): en pruebas. */
  guard?: boolean;
  /** Validador de acciones (017). Sin él, un sistema que devuelve acciones es un error. */
  validate?: ActionValidator;
  /** Nivel de todas las personas (R-011; 021 CA-001 compara el 1 con el 2). Sin él, `levelOf` (2 en M2). */
  level?: SimLevel;
}

const due = (cadence: Cadence, now: number) =>
  cadence === 'tick' || (cadence === 'hour' && now % 60 === 0) || (cadence === 'day' && now % MINUTES_PER_DAY === 0);

/** R-011: en M2, todas las personas activas están en nivel 2 (los niveles 0, 1, 3 y 4 llegan después). */
export const levelOf = (_world: World, _row: number): SimLevel => 2;

/** Filas de las personas activas (no antepasados ni dados de baja), en orden ascendente. */
function activeRows(world: World): number[] {
  const active = world.components.u8.active!;
  const rows: number[] = [];
  for (let row = 1; row <= world.counters.CIT; row++) if (active[row] === 1) rows.push(row);
  return rows;
}

/**
 * Corre los sistemas activos del minuto actual, fase por fase. Dentro de una fase, cada sistema lee el mundo
 * tal como quedó al terminar la fase anterior; sus parches, eventos y acciones se aplican al final de la
 * fase, en orden de sistema y luego de emisión (R-007). El azar de cada sistema en este tick es
 * `rng.fork('sys:' + id).fork(now)` (R-008): añadir un sistema no cambia el de los demás.
 */
export function runSystems(world: World, rng: Rng, registry: SystemRegistry, opts: LoopOptions = {}): WorldEvent[] {
  const systems = activeSystems(registry, world.capabilities);
  if (systems.length === 0) return [];
  const view = viewOf(world, opts.guard ?? false);
  const rows = activeRows(world);
  const level = (row: number) => opts.level ?? levelOf(world, row);
  const events: WorldEvent[] = [];

  for (const phase of PHASES) {
    const now = world.now;
    const outputs: [System, SystemOutput][] = [];
    for (const s of systems) {
      if (s.phase !== phase || !due(s.cadence, now)) continue;
      const r = rng.fork(`sys:${s.id}`).fork(now);
      const full = rows.filter((row) => level(row) >= s.minLevel);
      const coarse = rows.filter((row) => level(row) < s.minLevel);
      const ctx = (citizens: number[]): TickCtx => ({ now, citizens, level, events });
      outputs.push([s, s.run(view, ctx(full), r)]);
      if (s.runCoarse && coarse.length > 0) outputs.push([s, s.runCoarse(view, ctx(coarse), r.fork('coarse'))]);
    }
    for (const [s, out] of outputs) {
      applyPatches(world, out.patches ?? [], s.id);
      for (const { recordAs, ...e } of out.events ?? []) {
        const made = makeEvent(world.counters, now, e);
        events.push(made);
        if (recordAs) applyPatches(world, [{ op: 'set', type: 'i32', column: recordAs.column, row: recordAs.row, value: idNumber(made.id) }], s.id);
      }
      for (const action of out.actions ?? []) {
        if (!opts.validate) throw new Error(`${s.id}: devolvió acciones y no hay validador (spec 017)`);
        const result = opts.validate(viewOf(world, opts.guard ?? false), action);
        if (!result.ok) continue; // 017 R-006: se registra solo en depuración o nivel ≥ 3
        applyPatches(world, result.patches ?? [], `${s.id}/${action.kind}`);
        for (const e of result.events ?? []) events.push(makeEvent(world.counters, now, e));
      }
    }
  }
  return events;
}
