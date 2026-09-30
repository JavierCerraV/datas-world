// Worker de un mundo (specs 002, 027): avanza según el tiempo real, atiende órdenes y persiste por lotes.
// No lee el reloj: `pump` recibe los milisegundos transcurridos (lo mide main.ts). Así se prueba sin esperas.
import type { Runner, Speed, World } from '@datas-world/engine';
import { lifeRunner } from '@datas-world/generators';
import {
  ADVANCE_MINUTES,
  ADVANCE_SLICE_MS,
  FLUSH_MS,
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
  /** Reloj en ms para medir los tramos de un avance sin observar (027 R-015); main.ts pasa `performance.now`. */
  clock?: () => number;
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
    this.#clock = opts.clock ?? (() => 0);
    this.session.trackMoves(); // 027 R-013
    this.repo.setAdvance(null); // un avance interrumpido por un cierre no se reanuda
    this.session.flush();
    if (this.repo.countSnapshots() === 0) this.repo.saveSnapshot(this.world);
  }

  /** Aplica una orden de control. Devuelve false si se rechaza (el mundo no cambia). */
  #apply(c: ControlCommand): boolean {
    try {
      switch (c.cmd) {
        case 'pause':
          this.#endAdvance(); // 027 R-015: una pausa interrumpe el avance
          this.runner.pause('orden de control');
          return true;
        case 'advance': {
          const minutes = Number(c.arg);
          if (!ADVANCE_MINUTES.includes(minutes) || this.#advance) return false;
          this.#advance = { from: this.world.now, to: this.world.now + minutes };
          this.repo.setAdvance(this.#advance);
          return true;
        }
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
        // 043 R-019: la charla en el mundo entra como entrada externa (y así el replay la reproduce).
        case 'chat_open':
        case 'chat_session':
          this.runner.submit(c.cmd, JSON.parse(c.arg ?? '{}'));
          return true;
        default:
          return false;
      }
    } catch {
      return false; // entrada externa rechazada por el motor
    }
  }

  /**
   * Una vuelta del bucle: órdenes pendientes y luego el tiempo real transcurrido, tick a tick, con flush cada
   * FLUSH_TICKS ticks (R-002) o cada FLUSH_MS de tiempo real (R-014); durante un avance sin observar, un tramo de él
   * (R-015). Devuelve los ticks y si hay que parar.
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

    if (this.#advance) return { ticks: this.#advanceSlice(), stop: false };

    let ticks = 0;
    if (this.world.status === 'running' && this.runner.speed > 0) {
      // Trozos del tiempo real de un tick: cada uno da como mucho un tick, y tras cada tick se anotan los viajes
      // que empiezan (027 R-013). El resultado es el mismo que con trozos mayores (el Runner acumula el resto).
      const chunk = Math.max(1, Math.floor((this.world.config.tickMinutes * 1000) / this.runner.speed));
      for (let left = elapsedMs; left > 0; left -= chunk) {
        const n = this.runner.onRealTime(Math.min(left, chunk));
        ticks += n;
        this.session.ticked(n);
      }
    } else {
      this.runner.onRealTime(elapsedMs); // descarta el acumulado en pausa
    }
    // R-014: flush también por tiempo real, para que el visor vea el mundo con pocos segundos de retraso.
    this.#sinceFlush = this.session.pendingTicks === 0 ? 0 : this.#sinceFlush + elapsedMs;
    if (this.#sinceFlush >= FLUSH_MS) {
      this.session.flush();
      this.#sinceFlush = 0;
    }
    return { ticks, stop: false };
  }

  #clock: () => number;
  #sinceFlush = 0;
  #advance: { from: number; to: number } | null = null;

  /** 027 R-015: un tramo del avance sin observar, tan rápido como se pueda, y flush; al llegar, punto de control. */
  #advanceSlice(): number {
    const start = this.#clock();
    const to = this.#advance!.to;
    let ticks = 0;
    while (this.world.now < to && (ticks === 0 || this.#clock() - start < ADVANCE_SLICE_MS)) {
      this.runner.advanceTicks(1);
      this.session.ticked(1, false);
      ticks++;
    }
    if (this.world.now >= to) {
      this.#endAdvance();
      this.session.flush(true);
    } else this.session.flush();
    return ticks;
  }

  #endAdvance(): void {
    if (!this.#advance) return;
    this.#advance = null;
    this.repo.setAdvance(null);
  }

  /** El avance sin observar en curso, o ninguno. */
  get advance(): { from: number; to: number } | null {
    return this.#advance;
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
