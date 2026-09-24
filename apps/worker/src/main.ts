// Proceso del worker: `node apps/worker/src/main.ts [--db data/world.db] [--speed 1]`.
// Es el único sitio que lee el reloj real (spec 002 R-008) y atiende señales (spec 027 R-007).
import { parseArgs } from 'node:util';
import type { Speed } from '@mundo-social/engine';
import { WorldWorker } from './worker.ts';

const LOOP_MS = 100;

const { values } = parseArgs({
  options: { db: { type: 'string', default: 'data/world.db' }, speed: { type: 'string' } },
});
const worker = new WorldWorker(values.db, values.speed === undefined ? {} : { speed: Number(values.speed) as Speed });
process.stdout.write(
  `worker: ${worker.world.id} en el minuto ${worker.world.now}, ${worker.world.status}, ${worker.runner.speed}x\n`,
);

let timer: NodeJS.Timeout | undefined;
let last = performance.now();
let fraction = 0;

function stop(reason: string): void {
  clearTimeout(timer);
  const { minute, hash } = worker.shutdown(reason);
  process.stdout.write(`worker: cerrado en el minuto ${minute} (${reason}), hash ${hash}\n`);
  process.exit(0);
}

function loop(): void {
  const t = performance.now();
  const ms = t - last + fraction;
  last = t;
  const whole = Math.floor(ms);
  fraction = ms - whole;
  if (worker.pump(whole).stop) return stop('orden stop');
  timer = setTimeout(loop, LOOP_MS);
}

process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
timer = setTimeout(loop, LOOP_MS);
