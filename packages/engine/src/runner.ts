// Controles de tiempo (spec 002): velocidad, pausa, paso, avanzar N días y replay de entradas (spec 023 R-004).
// El Runner no lee el reloj real: el worker le pasa el tiempo real transcurrido (R-008).
import { MINUTES_PER_DAY } from './calendar.ts';
import type { WorldEvent } from './events.ts';
import type { Rng } from './rng.ts';
import { applyExternalInput, tick } from './tick.ts';
import type { ExternalInput, InputHandler, ScheduledHandler } from './tick.ts';
import type { LoopOptions } from './simulation/loop.ts';
import { EMPTY_REGISTRY } from './simulation/registry.ts';
import type { SystemRegistry } from './simulation/registry.ts';
import type { World } from './world.ts';

/** 002 R-003: `REAL_TIME` (1/60) es 1 min de mundo por minuto real; lo usa la charla en el mundo (043 R-019.3). */
export type Speed = 0 | 0.016666666666666666 | 1 | 10 | 100 | 1000;
export const REAL_TIME = (1 / 60) as Speed;

export class Runner {
  readonly world: World;
  readonly #rng: Rng;
  readonly #handlers: Readonly<Record<string, ScheduledHandler>>;
  #speed: Speed = 1;
  /** Tiempo real acumulado aún no convertido en ticks, en (minutos de mundo × 1000). */
  #carry = 0;
  #outbox: WorldEvent[] = [];
  #applied: ExternalInput[] = [];
  #replay: ExternalInput[] = [];
  #seqAt = -1;
  #seq = 0;

  readonly #systems: SystemRegistry;
  readonly #loop: LoopOptions;
  readonly #inputs: Readonly<Record<string, InputHandler>>;

  constructor(
    world: World,
    rng: Rng,
    handlers: Readonly<Record<string, ScheduledHandler>> = {},
    opts: { systems?: SystemRegistry; loop?: LoopOptions; inputs?: Readonly<Record<string, InputHandler>> } = {},
  ) {
    this.world = world;
    this.#rng = rng;
    this.#handlers = handlers;
    this.#systems = opts.systems ?? EMPTY_REGISTRY;
    this.#loop = opts.loop ?? {};
    this.#inputs = opts.inputs ?? {};
  }

  get speed(): Speed {
    return this.#speed;
  }

  /**
   * Al retomar un mundo guardado: la próxima entrada de ese minuto sigue la numeración de la última
   * registrada, para que `(at, seq)` no se repita (023 R-004).
   */
  continueInputsAfter(last: Pick<ExternalInput, 'at' | 'seq'> | null): void {
    if (last && last.at === this.world.now) [this.#seqAt, this.#seq] = [last.at, last.seq + 1];
  }

  /** Aplica una entrada externa ahora y la registra para el replay. Lanza si se rechaza. */
  submit(kind: string, payload: unknown): { input: ExternalInput; events: WorldEvent[] } {
    if (this.#seqAt !== this.world.now) [this.#seqAt, this.#seq] = [this.world.now, 0];
    const input: ExternalInput = { at: this.world.now, seq: this.#seq, kind, payload: structuredClone(payload) };
    const events = this.#apply(input);
    this.#seq += 1;
    return { input, events };
  }

  #apply(input: ExternalInput): WorldEvent[] {
    const r = applyExternalInput(this.world, input, this.#inputs);
    if (!r.ok) throw new Error(`Entrada externa rechazada (${input.kind}): ${r.reason}`);
    if (input.kind === 'set_speed') this.#speed = (input.payload as { to: Speed }).to;
    this.#applied.push(input);
    this.#outbox.push(...r.events);
    return r.events;
  }

  setSpeed(to: Speed): WorldEvent[] {
    return this.submit('set_speed', { from: this.#speed, to }).events;
  }
  pause(reason = ''): WorldEvent[] {
    return this.submit('pause', { reason }).events;
  }
  resume(reason = ''): WorldEvent[] {
    return this.submit('resume', { reason }).events;
  }

  /** Entradas registradas, en orden (at, seq), para persistirlas o reproducirlas. */
  inputs(): ExternalInput[] {
    return this.#applied.map((i) => structuredClone(i));
  }

  /** Programa entradas registradas para reinyectarlas en su (at, seq) exacto al avanzar. */
  enqueueReplay(inputs: readonly ExternalInput[]): void {
    this.#replay.push(...inputs.map((i) => structuredClone(i)));
    this.#replay.sort((a, b) => a.at - b.at || a.seq - b.seq);
    if (this.#replay[0] && this.#replay[0].at < this.world.now)
      throw new Error('Replay: hay entradas anteriores al minuto actual');
  }

  /** Aplica las entradas de replay del minuto actual (también al final de un avance). */
  flushReplay(): void {
    while (this.#replay[0]?.at === this.world.now) this.#apply(this.#replay.shift()!);
  }

  #tick(): void {
    this.flushReplay();
    this.#outbox.push(...tick(this.world, this.#rng, this.#handlers, this.#systems, this.#loop));
  }

  /** Ejecuta n ticks seguidos, sin mirar la velocidad ni el estado (CLI, pruebas, replay). */
  advanceTicks(n: number): void {
    for (let i = 0; i < n; i++) this.#tick();
  }

  /** R-005: "avanzar N días". `onProgress` recibe la fracción completada cada 5 %. */
  advanceDays(days: number, onProgress?: (fraction: number) => void): void {
    const total = (days * MINUTES_PER_DAY) / this.world.config.tickMinutes;
    const every = Math.max(1, Math.floor(total / 20));
    for (let i = 1; i <= total; i++) {
      this.#tick();
      if (onProgress && i % every === 0) onProgress(i / total);
    }
  }

  /** R-006: un tick exacto y el mundo queda en pausa. */
  step(): void {
    if (this.world.status === 'running') this.pause('paso');
    this.#tick();
  }

  /**
   * R-002, R-003, R-008: convierte tiempo real transcurrido en ticks según la velocidad.
   * Devuelve los ticks ejecutados. En pausa o a velocidad 0 no avanza y descarta el acumulado.
   */
  onRealTime(elapsedMs: number): number {
    if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0) throw new RangeError(`elapsedMs inválido: ${elapsedMs}`);
    if (this.world.status !== 'running' || this.#speed === 0) {
      this.#carry = 0;
      return 0;
    }
    this.#carry += this.#speed * elapsedMs;
    const perTick = this.world.config.tickMinutes * 1000;
    const n = Math.floor(this.#carry / perTick);
    this.#carry -= n * perTick;
    this.advanceTicks(n);
    return n;
  }

  /** Devuelve y vacía los eventos pendientes de persistir. */
  drainEvents(): WorldEvent[] {
    const out = this.#outbox;
    this.#outbox = [];
    return out;
  }
}
