import { Runner, addCitizen, columns, createRng, createWorld, defineColumn, stateHash } from '@datas-world/engine';
import type { World, WorldConfig, WorldEvent } from '@datas-world/engine';
import { afterEach, describe, expect, it } from 'vitest';
import { columnToLE } from './codec.ts';
import { closeDb, openReadonly, openWorldDb } from './db.ts';
import { WorldRepository } from './repository.ts';
import { tempDir, testConfig } from './testing.ts';

let tmp = tempDir();
afterEach(() => {
  tmp.cleanup();
  tmp = tempDir();
});

/** Mundo recién creado con su Runner y todos los eventos emitidos hasta ahora. */
function start(cfg: WorldConfig = testConfig()) {
  const { world, events } = createWorld(cfg);
  const runner = new Runner(world, createRng(cfg.seed));
  return { world, runner, events: [...events] as WorldEvent[] };
}

/** Mundo con columnas de los tres tipos y valores que no son triviales en binario. */
function withComponents(): World {
  const { world } = start();
  defineColumn(world.components, 'f32', 'mood', 0.5);
  defineColumn(world.components, 'i32', 'money', -7);
  defineColumn(world.components, 'u8', 'energy', 200);
  for (let i = 0; i < 40; i++) addCitizen(world); // obliga a crecer la capacidad (16 → 64)
  const c = world.components;
  c.f32.mood![3] = 0.1; // no representable exacto: se guarda el f32 redondeado
  c.f32.mood![7] = -1e-30;
  c.i32.money![5] = -2_147_483_648;
  c.i32.money![40] = 123_456_789;
  c.u8.energy![1] = 255;
  return world;
}

const columnBytes = (w: World) =>
  columns(w.components).map(({ name, data }) => [name, columnToLE(data.subarray(0, w.counters.CIT + 1))]);

describe('027 CA-001: guardar, cerrar, cargar y continuar', () => {
  it('determinismo: tras 10 días el hash coincide y seguir 5 días da lo mismo que no haber cerrado', () => {
    const ref = start();
    ref.runner.setSpeed(10);
    ref.runner.advanceDays(15);
    ref.events.push(...ref.runner.drainEvents());

    const a = start();
    a.runner.setSpeed(10);
    a.runner.advanceDays(10);
    const path = tmp.file('w.db');
    const db = openWorldDb(path);
    new WorldRepository(db).flush({
      world: a.world,
      events: [...a.events, ...a.runner.drainEvents()],
      inputs: a.runner.inputs(),
    });
    const hash10 = stateHash(a.world);
    closeDb(db);

    const db2 = openWorldDb(path);
    const repo = new WorldRepository(db2);
    const loaded = repo.loadWorld();
    expect(stateHash(loaded)).toBe(hash10);
    const b = new Runner(loaded, createRng(loaded.config.seed));
    b.advanceDays(5);
    repo.flush({ world: loaded, events: b.drainEvents() });
    expect(stateHash(loaded)).toBe(stateHash(ref.world));
    expect(repo.readEvents()).toEqual(ref.events);
    expect(repo.readInputs()).toEqual(ref.runner.inputs());
    closeDb(db2);
  });

  it('la configuración cargada es idéntica y sigue congelada', () => {
    const a = start();
    const db = openWorldDb(tmp.file('w.db'));
    const repo = new WorldRepository(db);
    repo.flush({ world: a.world, events: a.events });
    const loaded = new WorldRepository(db).loadWorld();
    expect(loaded.config).toEqual(a.world.config);
    expect(Object.isFrozen(loaded.config)).toBe(true);
    closeDb(db);
  });
});

describe('027 CA-006: componentes idénticos byte a byte', () => {
  it('guardar y cargar conserva cada columna, su valor inicial y el hash', () => {
    const world = withComponents();
    const db = openWorldDb(tmp.file('w.db'));
    new WorldRepository(db).flush({ world });
    closeDb(db);

    const db2 = openWorldDb(tmp.file('w.db'));
    const loaded = new WorldRepository(db2).loadWorld();
    expect(columnBytes(loaded)).toEqual(columnBytes(world));
    expect(loaded.components.initial).toEqual(world.components.initial);
    expect(stateHash(loaded)).toBe(stateHash(world));
    // Crecer después de cargar rellena igual que sin haber cerrado.
    for (let i = 0; i < 30; i++) {
      addCitizen(world);
      addCitizen(loaded);
    }
    expect(stateHash(loaded)).toBe(stateHash(world));
    closeDb(db2);
  });

  it('las columnas se guardan en binario little-endian, no en JSON', () => {
    const world = withComponents();
    const db = openWorldDb(tmp.file('w.db'));
    new WorldRepository(db).flush({ world });
    const row = db.prepare("SELECT type, length, data FROM components WHERE name = 'money'").get() as {
      type: string;
      length: number;
      data: Buffer;
    };
    expect(row.type).toBe('i32');
    expect(row.length).toBe(41);
    expect(row.data.byteLength).toBe(41 * 4);
    expect(row.data.readInt32LE(5 * 4)).toBe(-2_147_483_648);
    closeDb(db);
  });

  it('la instantánea comprimida reproduce el mundo con el mismo hash (R-004)', () => {
    const world = withComponents();
    const db = openWorldDb(tmp.file('w.db'));
    const repo = new WorldRepository(db);
    const hash = repo.saveSnapshot(world);
    expect(repo.loadSnapshot(-1)).toBeNull();
    const back = repo.loadSnapshot()!;
    expect(stateHash(back)).toBe(hash);
    expect(columnBytes(back)).toEqual(columnBytes(world));
    closeDb(db);
  });
});

describe('R-008: solo se reescribe lo que cambió', () => {
  it('una columna sin cambios conserva su updated_at; al cambiar, se reescribe', () => {
    const a = start();
    const db = openWorldDb(tmp.file('w.db'));
    const repo = new WorldRepository(db);
    repo.flush({ world: a.world, events: a.events });
    const updatedAt = () =>
      (db.prepare("SELECT updated_at AS u FROM components WHERE name = 'active'").get() as { u: number }).u;
    a.runner.advanceDays(1);
    repo.flush({ world: a.world, events: a.runner.drainEvents() });
    expect(updatedAt()).toBe(0);
    addCitizen(a.world);
    repo.flush({ world: a.world });
    expect(updatedAt()).toBe(a.world.now);
    closeDb(db);
  });
});

describe('INV-001 y validaciones al cargar', () => {
  it('rechaza un lote con seq no creciente y la transacción entera se deshace', () => {
    const a = start();
    const db = openWorldDb(tmp.file('w.db'));
    const repo = new WorldRepository(db);
    repo.flush({ world: a.world, events: a.events });
    a.runner.advanceDays(1);
    const next = a.runner.drainEvents();
    expect(() => repo.flush({ world: a.world, events: [...next, ...a.events] })).toThrow(/INV-001/);
    expect(repo.readEvents()).toEqual(a.events);
    expect(repo.lastSeq).toBe(1);
    expect(() => repo.loadWorld()).not.toThrow(); // el estado sigue siendo el del primer flush
    repo.flush({ world: a.world, events: next });
    expect(repo.readEvents()).toEqual([...a.events, ...next]);
    closeDb(db);
  });

  it('R-009: rechaza un mundo con capacidades que el motor no conoce', () => {
    const a = start();
    const db = openWorldDb(tmp.file('w.db'));
    new WorldRepository(db).flush({ world: a.world, events: a.events });
    db.prepare(`UPDATE meta SET value = '["clock","telepathy"]' WHERE key = 'capabilities'`).run();
    expect(() => new WorldRepository(db).loadWorld()).toThrow(/R-009.*telepathy/);
    closeDb(db);
  });

  it('detecta un estado alterado fuera del repositorio por su hash', () => {
    const a = start();
    const db = openWorldDb(tmp.file('w.db'));
    new WorldRepository(db).flush({ world: a.world, events: a.events });
    db.prepare(`UPDATE meta SET value = '60' WHERE key = 'now'`).run();
    expect(() => new WorldRepository(db).loadWorld()).toThrow(/hash/);
    closeDb(db);
  });

  it('no mezcla dos mundos en la misma base', () => {
    const db = openWorldDb(tmp.file('w.db'));
    const repo = new WorldRepository(db);
    repo.flush({ world: start().world });
    const other = createWorld(testConfig(), 'WLD-0002').world;
    expect(() => repo.flush({ world: other })).toThrow(/WLD-0001/);
    closeDb(db);
  });
});

describe('027 CA-004: lectura mientras el worker escribe', () => {
  it('un lector con una transacción abierta no bloquea al escritor ni recibe SQLITE_BUSY', () => {
    const a = start();
    const path = tmp.file('w.db');
    const db = openWorldDb(path);
    const repo = new WorldRepository(db);
    repo.flush({ world: a.world, events: a.events });

    const ro = openReadonly(path);
    const count = ro.prepare('SELECT COUNT(*) AS n FROM events');
    ro.exec('BEGIN');
    expect(count.get()).toEqual({ n: 1 });
    for (let day = 0; day < 20; day++) {
      a.runner.advanceDays(1);
      repo.flush({ world: a.world, events: a.runner.drainEvents() });
      expect(count.get()).toEqual({ n: 1 }); // el lector ve su instantánea, sin errores
    }
    ro.exec('COMMIT');
    expect(count.get()).toEqual({ n: 21 });
    closeDb(ro);
    closeDb(db);
  });
});
