// Movimientos para el visor y avance sin observar (spec 027 R-013 a R-015; CA-009, CA-010).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stateHash } from '@datas-world/engine';
import { generateWorld, lifeRunner } from '@datas-world/generators';
import { FLUSH_MS, WorldRepository, closeDb, enqueueCommand, movesSince, openWorldDb } from '@datas-world/persistence';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorldWorker } from './worker.ts';

const DAY_TICKS = 288;
let dir: string;
let path: string;

/** Un mundo generado y puesto en marcha, guardado en su base. */
function saveGenerated(file: string): void {
  const gen = generateWorld({ seed: 482917 });
  const db = openWorldDb(file);
  new WorldRepository(db).flush({ world: gen.world, events: gen.events });
  closeDb(db);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mundo-moves-'));
  path = join(dir, 'w.db');
  saveGenerated(path);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('027 R-013: movimientos para el visor', () => {
  it('CA-009: cada viaje iniciado aparece una vez con su salida y su llegada, y el hash es el de avanzar sin anotarlos', () => {
    const w = new WorldWorker(path);
    const start = w.world.now;
    w.pump(DAY_TICKS * 5000); // un día a 1x (5 s reales por tick)
    expect(w.world.now).toBe(start + DAY_TICKS * 5);
    const moves = movesSince(w.db, start - 1);
    const hash = stateHash(w.world);
    w.shutdown('prueba');

    // Referencia: el mismo mundo avanzado sin worker, mirando las columnas de viaje tras cada tick.
    const gen = generateWorld({ seed: 482917 });
    const r = lifeRunner(gen.world);
    r.resume('arranque del worker');
    const expected = new Set<string>();
    for (let k = 0; k < DAY_TICKS; k++) {
      r.advanceTicks(1);
      const i = gen.world.components.i32;
      for (const c of gen.world.citizens.values()) {
        const row = Number(c.id.slice(4));
        if (c.status === 'active' && !c.ancestor && i['trip.to']![row]! > 0) expected.add(`${c.id}@${i['trip.departAt']![row]}`);
      }
    }
    expect(moves.length).toBeGreaterThan(50);
    expect(new Set(moves.map((m) => `${m.citizenId}@${m.departAt}`))).toEqual(expected);
    expect(moves.length).toBe(expected.size); // sin repetidos
    for (const m of moves) {
      expect(m.arriveAt).toBeGreaterThan(m.departAt);
      expect(m.from).not.toBe(m.to);
    }
    // Los viajes de una persona no se solapan: el siguiente sale cuando el anterior ya llegó.
    const byCitizen = Map.groupBy(moves, (m) => m.citizenId);
    for (const list of byCitizen.values()) for (let k = 1; k < list.length; k++) expect(list[k]!.departAt).toBeGreaterThanOrEqual(list[k - 1]!.arriveAt);
    expect(hash).toBe(stateHash(gen.world));
  }, 120_000);

  it('R-014: con ticks sin guardar, hace flush al pasar FLUSH_MS de tiempo real aunque no lleguen a FLUSH_TICKS', () => {
    const w = new WorldWorker(path, { speed: 10 }); // un tick cada 500 ms reales
    const saved = () => Number((w.db.prepare("SELECT value FROM meta WHERE key = 'now'").get() as { value: string }).value);
    const start = w.world.now;
    w.pump(500);
    expect(w.world.now).toBe(start + 5);
    expect(saved()).toBe(start); // aún sin guardar
    w.pump(FLUSH_MS - 500); // 3 ticks más y FLUSH_MS con ticks pendientes
    expect(saved()).toBe(start + 20);
    w.shutdown('prueba');
  }, 60_000);
});

describe('027 R-015: avance sin observar', () => {
  it('CA-010: llega exactamente al minuto pedido, muestra el progreso mientras dura y sigue a su velocidad', () => {
    let t = 0;
    const w = new WorldWorker(path, { clock: () => (t += 10) }); // cada lectura del reloj, 10 ms: tramos de 25 ticks
    enqueueCommand(w.db, 'speed', '10', 't');
    w.pump(0);
    const from = w.world.now;
    enqueueCommand(w.db, 'advance', '1440', 't');
    enqueueCommand(w.db, 'advance', '777', 't'); // no admitido
    w.pump(0);
    expect(w.db.prepare("SELECT cmd, done FROM control_commands WHERE cmd = 'advance' ORDER BY id").all()).toEqual([
      { cmd: 'advance', done: 1 },
      { cmd: 'advance', done: -1 },
    ]);
    const meta = () => w.db.prepare("SELECT value FROM meta WHERE key = 'advance'").get() as { value: string } | undefined;
    expect(w.world.now).toBeGreaterThan(from);
    expect(JSON.parse(meta()!.value)).toEqual({ from, to: from + 1440 });
    let guard = 0;
    while (w.advance && guard++ < 1000) w.pump(100);
    expect(w.world.now).toBe(from + 1440);
    expect(meta()).toBeUndefined();
    expect(w.runner.speed).toBe(10);
    expect(w.world.status).toBe('running');
    expect(movesSince(w.db, from).filter((m) => m.departAt > from + 60)).toEqual([]); // sin anotar durante el avance
    w.shutdown('prueba');
  }, 120_000);

  it('una pausa interrumpe el avance', () => {
    let t = 0;
    const w = new WorldWorker(path, { clock: () => (t += 10) });
    enqueueCommand(w.db, 'advance', '10080', 't');
    w.pump(0);
    enqueueCommand(w.db, 'pause', null, 't');
    w.pump(0);
    expect(w.advance).toBeNull();
    expect(w.world.status).toBe('paused');
    expect(w.db.prepare("SELECT value FROM meta WHERE key = 'advance'").get()).toBeUndefined();
    w.shutdown('prueba');
  }, 60_000);
});
