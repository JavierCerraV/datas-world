// Sesión de escritura: une un Runner con el repositorio y decide cuándo hacer flush e instantánea
// (spec 027 R-002, R-004). La usan el worker y `world:advance` de la CLI.
import { MINUTES_PER_DAY } from '@datas-world/engine';
import type { Runner, World } from '@datas-world/engine';
import { FLUSH_TICKS, SNAPSHOT_EVERY_DAYS } from './params.ts';
import type { WorldRepository } from './repository.ts';

const SNAPSHOT_MINUTES = SNAPSHOT_EVERY_DAYS * MINUTES_PER_DAY;

export class WorldSession {
  readonly repo: WorldRepository;
  readonly runner: Runner;
  #ticksSinceFlush = 0;
  #inputsWritten = 0;
  #lastSnapshotPeriod: number;

  /** El Runner debe ser nuevo (sin entradas aún registradas por otra sesión). */
  constructor(repo: WorldRepository, runner: Runner) {
    this.repo = repo;
    this.runner = runner;
    this.#lastSnapshotPeriod = Math.floor(runner.world.now / SNAPSHOT_MINUTES);
    runner.continueInputsAfter(repo.lastInput());
  }

  get world(): World {
    return this.runner.world;
  }

  /** Anota ticks ejecutados; hace flush al llegar a FLUSH_TICKS. */
  ticked(n: number): void {
    this.#ticksSinceFlush += n;
    if (this.#ticksSinceFlush >= FLUSH_TICKS) this.flush();
  }

  /**
   * Eventos, entradas nuevas y estado en una transacción; instantánea si empezó otro periodo. Con
   * `checkpoint`, guarda también el hash del estado (R-012): al terminar un avance, al pausar y al cerrar.
   */
  flush(checkpoint = false): void {
    const inputs = this.runner.inputs();
    this.repo.flush({
      world: this.world,
      events: this.runner.drainEvents(),
      inputs: inputs.slice(this.#inputsWritten),
      checkpoint,
    });
    this.#inputsWritten = inputs.length;
    this.#ticksSinceFlush = 0;
    const period = Math.floor(this.world.now / SNAPSHOT_MINUTES);
    if (period > this.#lastSnapshotPeriod) {
      this.repo.saveSnapshot(this.world);
      this.#lastSnapshotPeriod = period;
    }
  }

  /** Avanza `ticks` ticks sin mirar el tiempo real (CLI, pruebas), con flush cada FLUSH_TICKS. */
  advanceTicks(ticks: number, onProgress?: (fraction: number) => void): void {
    const every = Math.max(1, Math.floor(ticks / 20)); // progreso cada 5 % (spec 002 R-005)
    for (let done = 0; done < ticks;) {
      const n = Math.min(FLUSH_TICKS - this.#ticksSinceFlush, ticks - done);
      this.runner.advanceTicks(n);
      const before = done;
      done += n;
      this.ticked(n);
      if (onProgress && Math.floor(done / every) > Math.floor(before / every)) onProgress(done / ticks);
    }
    this.flush(true);
  }
}
