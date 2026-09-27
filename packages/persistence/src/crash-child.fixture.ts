// Proceso hijo de la prueba CA-003: avanza el mundo con flush cada FLUSH_TICKS ticks hasta el día indicado.
// Tras cada flush escribe `flush <now> <lastSeq>` en stdout y espera 1 ms, para dar tiempo a que lo maten.
// Uso: node crash-child.fixture.ts <ruta.db> <días> [checkpoint]
// Con `checkpoint`, cada flush es un punto de control (guarda el hash, como el worker al recibir órdenes).
import { Runner, createRng, createWorld } from '@datas-world/engine';
import type { World, WorldEvent } from '@datas-world/engine';
import { closeDb, openWorldDb } from './db.ts';
import { FLUSH_TICKS } from './params.ts';
import { WorldRepository } from './repository.ts';
import { testConfig } from './testing.ts';

const [path, daysArg, mode] = process.argv.slice(2);
const checkpoint = mode === 'checkpoint';
const db = openWorldDb(path!);
const repo = new WorldRepository(db);
let world: World;
let first: WorldEvent[] = [];
if (repo.hasWorld()) world = repo.loadWorld();
else ({ world, events: first } = createWorld(testConfig()));
const runner = new Runner(world, createRng(world.config.seed));
repo.flush({ world, events: first });

const pause = new Int32Array(new SharedArrayBuffer(4));
const end = Number(daysArg) * 1440;
let ticks = 0;
while (world.now < end) {
  runner.advanceTicks(1);
  if (++ticks % FLUSH_TICKS === 0 || world.now >= end) {
    repo.flush({ world, events: runner.drainEvents(), checkpoint });
    process.stdout.write(`flush ${world.now} ${repo.lastSeq}\n`);
    Atomics.wait(pause, 0, 0, 1);
  }
}
closeDb(db);
process.stdout.write('done\n');
