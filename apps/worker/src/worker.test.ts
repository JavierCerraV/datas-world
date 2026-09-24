import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorld, stateHash } from '@mundo-social/engine';
import type { WorldConfig } from '@mundo-social/engine';
import {
  FLUSH_TICKS,
  WorldRepository,
  acquireWriterLock,
  closeDb,
  enqueueCommand,
  openWorldDb,
  releaseWriterLock,
  writerLock,
} from '@mundo-social/persistence';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorldWorker } from './worker.ts';

const config: WorldConfig = {
  name: 'Villa Cordillera',
  seed: 482917,
  epoch: '2027-01-04T00:00',
  tickMinutes: 5,
  currency: { code: 'COP', minorUnit: 1 },
  population: { target: 200 },
  engineVersion: '0.0.0',
  params: {},
  initialCapabilities: ['clock'],
  holidays: [],
};
const TICK_MS_1X = config.tickMinutes * 1000; // ms reales por tick a 1x

let dir: string;
let path: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mundo-worker-'));
  path = join(dir, 'w.db');
  const db = openWorldDb(path);
  const { world, events } = createWorld(config);
  new WorldRepository(db).flush({ world, events });
  closeDb(db);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Lee la base sin el worker. */
function inspect<T>(fn: (repo: WorldRepository) => T): T {
  const db = openWorldDb(path);
  try {
    return fn(new WorldRepository(db));
  } finally {
    closeDb(db);
  }
}

const now = () => inspect((r) => r.loadWorld().now);

describe('worker: avance y persistencia por lotes (027 R-002, R-004)', () => {
  it('arranca un mundo recién creado y lo avanza según el tiempo real y la velocidad', () => {
    const w = new WorldWorker(path, { speed: 100 });
    expect(w.world.status).toBe('running');
    expect(w.pump(10 * TICK_MS_1X).ticks).toBe(1000); // 100x: 10 s reales × 100 = 1000 ticks
    expect(w.world.now).toBe(5000);
    w.shutdown('prueba');
  });

  it('hace flush cada FLUSH_TICKS ticks: lo persistido nunca va más de un lote por detrás', () => {
    const w = new WorldWorker(path, { speed: 10 });
    w.pump(7 * TICK_MS_1X); // 70 ticks
    const saved = inspect((r) => r.loadWorld().now);
    expect(saved).toBe(Math.floor(70 / FLUSH_TICKS) * FLUSH_TICKS * config.tickMinutes);
    w.shutdown('prueba');
  });

  it('deja una instantánea por día de mundo', () => {
    const w = new WorldWorker(path, { speed: 1000 });
    w.pump(3 * 1440 * 60); // 3 días de mundo a 1000x
    w.shutdown('prueba');
    expect(inspect((r) => r.countSnapshots())).toBeGreaterThanOrEqual(4); // arranque + 3 días (+ cierre)
  });
});

describe('worker: órdenes de control', () => {
  it('pausa, paso y velocidad; una orden inválida se rechaza sin cambiar el mundo', () => {
    const w = new WorldWorker(path);
    enqueueCommand(w.db, 'pause', null, 't');
    enqueueCommand(w.db, 'speed', '7', 't');
    w.pump(0);
    expect(w.world.status).toBe('paused');
    expect(now()).toBe(0);
    expect(w.pump(60_000).ticks).toBe(0); // en pausa no avanza
    expect(w.db.prepare('SELECT cmd, done FROM control_commands ORDER BY id').all()).toEqual([
      { cmd: 'pause', done: 1 },
      { cmd: 'speed', done: -1 },
    ]);

    enqueueCommand(w.db, 'step', null, 't');
    w.pump(0);
    expect(w.world.now).toBe(5);
    expect(now()).toBe(5); // la orden se persiste enseguida

    enqueueCommand(w.db, 'speed', '1000', 't');
    enqueueCommand(w.db, 'resume', null, 't');
    w.pump(0);
    expect(w.runner.speed).toBe(1000);
    expect(w.pump(1000).ticks).toBe(200);
    w.shutdown('prueba');
  });

  it('stop pide parar y el cierre registra WORLD_CLOSED con el hash previo', () => {
    const w = new WorldWorker(path, { speed: 1000 });
    w.pump(5000);
    const before = stateHash(w.world);
    enqueueCommand(w.db, 'stop', null, 't');
    expect(w.pump(5000)).toEqual({ ticks: 0, stop: true });
    const closed = w.shutdown('orden stop');
    expect(closed.hash).toBe(before);
    const last = inspect((r) => r.readEvents(r.lastSeq - 1));
    expect(last[0]!.payload).toEqual({ minute: closed.minute, hash: before, reason: 'orden stop' });
  });
});

describe('worker: un solo escritor y reinicio (027 R-001, R-007)', () => {
  it('no arranca si otro proceso vivo tiene el cerrojo; tras cerrar, el cerrojo queda libre', () => {
    const db = openWorldDb(path);
    acquireWriterLock(db, process.ppid); // el proceso padre de la prueba está vivo
    closeDb(db);
    expect(() => new WorldWorker(path)).toThrow(`PID ${process.ppid}`);
    inspect((r) => releaseWriterLock(r.db, process.ppid));
    const w = new WorldWorker(path);
    expect(inspect((r) => writerLock(r.db))).toBe(process.pid);
    w.shutdown('prueba');
    expect(inspect((r) => writerLock(r.db))).toBeNull();
  });

  it('al reiniciar continúa desde el minuto y el estado en que se cerró', () => {
    const a = new WorldWorker(path, { speed: 1000 });
    a.pump(7000);
    enqueueCommand(a.db, 'pause', null, 't');
    a.pump(0);
    const { minute } = a.shutdown('prueba');
    const b = new WorldWorker(path);
    expect(b.world.now).toBe(minute);
    expect(b.world.status).toBe('paused');
    b.shutdown('prueba');
  });
});

describe('worker como proceso', () => {
  const MAIN = join(import.meta.dirname, 'main.ts');

  /** Lanza el worker a 1000x, espera a que arranque y lo detiene con `stopWith`. */
  function runProcess(
    stopWith: (child: ReturnType<typeof spawn>) => void,
  ): Promise<{ code: number | null; out: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [MAIN, '--db', path, '--speed', '1000'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '';
      let err = '';
      let asked = false;
      child.stdout.on('data', (d: Buffer) => {
        out += d.toString();
        if (!asked && out.includes('worker: WLD-0001')) {
          asked = true;
          setTimeout(() => stopWith(child), 300);
        }
      });
      child.stderr.on('data', (d: Buffer) => (err += d.toString()));
      child.on('error', reject);
      child.on('exit', (code) => (code === 0 ? resolve({ code, out }) : reject(new Error(`código ${code}: ${err}`))));
    });
  }

  it('se detiene limpio con la orden stop', async () => {
    const { out } = await runProcess(() => {
      const db = openWorldDb(path);
      enqueueCommand(db, 'stop', null, 't');
      closeDb(db);
    });
    expect(out).toMatch(/cerrado en el minuto \d+ \(orden stop\)/);
    inspect((r) => {
      expect(r.countEvents('WORLD_CLOSED')).toBe(1);
      expect(r.loadWorld().now).toBeGreaterThan(0);
      expect(writerLock(r.db)).toBeNull();
    });
  }, 30_000);

  // En Windows las señales no llegan a los manejadores: `kill` termina el proceso en seco (lo cubre la CA-003).
  it.skipIf(process.platform === 'win32')(
    '027 CA-003 / R-007: con SIGTERM vuelca todo y cierra limpio',
    async () => {
      const { out } = await runProcess((child) => child.kill('SIGTERM'));
      expect(out).toMatch(/cerrado en el minuto \d+ \(SIGTERM\)/);
      inspect((r) => {
        expect(r.countEvents('WORLD_CLOSED')).toBe(1);
        const world = r.loadWorld();
        expect(r.readEvents(r.lastSeq - 1)[0]!.payload).toMatchObject({ minute: world.now, reason: 'SIGTERM' });
      });
    },
    30_000,
  );
});
