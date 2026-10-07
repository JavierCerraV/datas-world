// Intervenciones de un experimento como entradas externas validadas (spec 028 R-003; CLAUDE.md regla 4, 023 R-004).
// Cada manejador valida sin cambiar nada (`check`) y solo entonces aplica con patches y eventos con causas.
import type { InputHandler } from '../tick.ts';
import { idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import { applyPatches } from '../simulation/patches.ts';
import type { WorldView } from '../simulation/system.ts';
import { JobChanges } from '../work/jobs.ts';
import type { World } from '../world.ts';

/** Tipos de entrada cuyos eventos deben llegar al aprendizaje y a la memoria (`Runner` `feedKinds`). */
export const EXPERIMENT_FEED_KINDS: ReadonlySet<string> = new Set(['force_job_loss', 'grant_money']);

const person = (world: World, id: unknown): id is EntityId => typeof id === 'string' && world.citizens.get(id as EntityId)?.status === 'active' && !world.citizens.get(id as EntityId)?.ancestor;

/** Manejadores `force_job_loss` y `grant_money` para el Runner (`opts.inputs`). */
export function experimentInputs(): Record<string, InputHandler> {
  return {
    force_job_loss: (world, input) => {
      const p = input.payload as { citizenId?: string };
      if (!person(world, p?.citizenId)) return { ok: false, reason: 'force_job_loss: persona inexistente o inactiva' };
      const id = p.citizenId as EntityId;
      if (world.citizens.get(id)?.occupation?.kind !== 'formal') return { ok: false, reason: `force_job_loss: ${id} no tiene empleo formal` };
      return {
        ok: true,
        apply: (cause, emit) => {
          // La misma salida del empleo que un despido del motor (006 R-006): puesto liberado, desempleo y tristeza, miedo y vergüenza.
          const jobs = new JobChanges(world as unknown as WorldView);
          jobs.fire(idNumber(id), 'experiment', []);
          applyPatches(world, jobs.finish(), 'force_job_loss');
          for (const e of jobs.events) emit({ type: e.type, payload: e.payload, participants: e.participants as never, causes: cause });
        },
      };
    },
    grant_money: (world, input) => {
      const p = input.payload as { citizenId?: string; amount?: unknown };
      if (!person(world, p?.citizenId)) return { ok: false, reason: 'grant_money: persona inexistente o inactiva' };
      if (!Number.isInteger(p.amount) || (p.amount as number) <= 0) return { ok: false, reason: 'grant_money: el monto debe ser un entero positivo' };
      const id = p.citizenId as EntityId;
      const amount = p.amount as number;
      return {
        ok: true,
        apply: (cause, emit) => {
          // El dinero solo se mueve con `transfer` (015 R-006): sale del resto del país.
          applyPatches(world, [{ op: 'transfer', from: { kind: 'rest' }, to: { kind: 'citizen', row: idNumber(id) }, amount }], 'grant_money');
          emit({ type: 'MONEY_GRANTED', payload: { citizenId: id, amount, reason: 'experiment' }, participants: [{ id, role: 'beneficiario' }], causes: cause });
        },
      };
    },
  };
}
