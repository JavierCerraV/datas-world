// Worker de un mundo (specs 002, 027): avanza según el tiempo real, atiende órdenes y persiste por lotes.
// No lee el reloj: `pump` recibe los milisegundos transcurridos (lo mide main.ts). Así se prueba sin esperas.
import type { Runner, Speed, World } from '@datas-world/engine';
import { lifeRunner } from '@datas-world/generators';
import {
  FLUSH_TICKS,
  WorldRepository,
  WorldSession,
  acquireWriterLock,
  closeDb,
  finishCommand,
  openWorldDb,
  pendingCommands,
  releaseWriterLock,
} from '@datas-world/persistence';
import type { ControlCommand, Db } from '@datas-world/persistence';

export interface WorkerOptions {
  /** Velocidad con que arranca. Si difiere de la del Runner (1x), se aplica como entrada externa. */
  speed?: Speed;
}

export class WorldWorker {
  readonly db: Db;
  readonly repo: WorldRepository;
  readonly world: World;
  readonly runner: Runner;
  readonly session: WorldSession;
  #closed = false;

  /** Abre la base (migrando si hace falta), toma el cerrojo de escritor y carga el mundo. */
  constructor(path: string, opts: WorkerOptions = {}) {
    this.db = openWorldDb(path);
    try {
      acquireWriterLock(this.db);
      this.repo = new WorldRepository(this.db);
      if (!this.repo.hasWorld())
        throw new Error(`La base ${path} no contiene ningún mundo: créalo con \`pnpm cli world:new\``);
      this.world = this.repo.loadWorld();
    } catch (err) {
      closeDb(this.db);
      throw err;
    }
    this.runner = lifeRunner(this.world); // vida diaria de M2 si el mundo tiene sus capacidades
    this.session = new WorldSession(this.repo, this.runner);
    // spec 001 R-006: un mundo recién creado empieza a vivir; uno en pausa sigue en pausa.
    if (this.world.status === 'created') this.runner.resume('arranque del worker');
    if (opts.speed !== undefined && opts.speed !== this.runner.speed) this.runner.setSpeed(opts.speed);
    this.session.flush();
    if (this.repo.countSnapshots() === 0) this.repo.saveSnapshot(this.world);
  }

  /** Aplica una orden de control. Devuelve false si se rechaza (el mundo no cambia). */
  #apply(c: ControlCommand): boolean {
    try {
      switch (c.cmd) {
        case 'pause':
          this.runner.pause('orden de control');
          return true;
        case 'resume':
          this.runner.resume('orden de control');
          return true;
        case 'speed':
          this.runner.setSpeed(Number(c.arg) as Speed);
          return true;
        case 'step':
          this.runner.step();
          return true;
        case 'stop':
          return true;
        default:
          return false;
      }
    } catch {
      return false; // entrada externa rechazada por el motor
    }
  }

  /**
   * Una vuelta del bucle: órdenes pendientes y luego el tiempo real transcurrido, en trozos de como mucho
   * FLUSH_TICKS ticks para hacer flush cada FLUSH_TICKS (R-002). Devuelve los ticks y si hay que parar.
   */
  pump(elapsedMs: number): { ticks: number; stop: boolean } {
    if (this.#closed) throw new Error('El worker ya está cerrado');
    let changed = false;
    for (const c of pendingCommands(this.db)) {
      const ok = this.#apply(c);
      finishCommand(this.db, c.id, ok);
      changed ||= ok;
      if (ok && c.cmd === 'stop') return { ticks: 0, stop: true };
    }
    // "o al pausar": cualquier cambio de control se persiste enseguida, como punto de control (027 R-012)
    if (changed) this.session.flush(true);

    let ticks = 0;
    if (this.world.status === 'running' && this.runner.speed > 0) {
      const chunk = Math.max(1, Math.floor((FLUSH_TICKS * this.world.config.tickMinutes * 1000) / this.runner.speed));
      for (let left = elapsedMs; left > 0; left -= chunk) {
        const n = this.runner.onRealTime(Math.min(left, chunk));
        ticks += n;
        this.session.ticked(n);
      }
    } else {
      this.runner.onRealTime(elapsedMs); // descarta el acumulado en pausa
    }
    return { ticks, stop: false };
  }

  /** R-007: registra WORLD_CLOSED, vuelca todo, deja instantánea, libera el cerrojo y cierra la base. */
  shutdown(reason: string): { minute: number; hash: string } {
    if (this.#closed) throw new Error('El worker ya está cerrado');
    const events = this.runner.submit('close', { reason }).events;
    this.session.flush();
    this.repo.saveSnapshot(this.world);
    releaseWriterLock(this.db);
    closeDb(this.db);
    this.#closed = true;
    const closed = events.find((e) => e.type === 'WORLD_CLOSED')!;
    return { minute: this.world.now, hash: (closed.payload as { hash: string }).hash };
  }
}
