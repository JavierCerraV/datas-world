#!/usr/bin/env node
// `pnpm dev` (spec 024 V2.4): arranca el mundo en local y lo muestra en el navegador.
// 1. Si no existe data/world.db, crea un mundo (semilla 482917, perfil colombiano).
// 2. Arranca el worker (que avanza el mundo), la API (022) y el visor (024, Vite).
// Ctrl+C detiene los tres. Opciones: --db RUTA, --speed 0|1|10|100|1000 (por defecto 10), --seed N.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';

const { values: v } = parseArgs({
  options: {
    db: { type: 'string', default: 'data/world.db' },
    speed: { type: 'string', default: '10' },
    seed: { type: 'string', default: '482917' },
  },
});

if (!existsSync(v.db)) {
  mkdirSync(dirname(v.db), { recursive: true });
  console.log(`Creando un mundo nuevo en ${v.db} (semilla ${v.seed})…`);
  const r = spawnSync(process.execPath, ['apps/cli/src/main.ts', 'world:new', '--seed', v.seed, '--db', v.db], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const colors = { worker: '\x1b[36m', api: '\x1b[35m', web: '\x1b[32m' };
const children = [];
function run(name, args) {
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  const prefix = (chunk) =>
    String(chunk)
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => `${colors[name]}[${name}]\x1b[0m ${l}`)
      .join('\n') + '\n';
  child.stdout.on('data', (c) => process.stdout.write(prefix(c)));
  child.stderr.on('data', (c) => process.stderr.write(prefix(c)));
  child.on('exit', (code) => {
    console.log(`[${name}] terminó (${code ?? 'señal'})`);
    stop();
  });
  children.push(child);
}

let stopping = false;
/**
 * Detiene los tres procesos. Al worker se le pide la orden `stop` (cierre limpio con instantánea, 027 R-007):
 * en Windows las señales no llegan a sus manejadores y `kill` lo terminaría en seco.
 */
function stop() {
  if (stopping) return;
  stopping = true;
  const [worker, ...rest] = children;
  for (const c of rest) if (c.exitCode === null) c.kill();
  if (worker && worker.exitCode === null) {
    spawnSync(process.execPath, ['apps/cli/src/main.ts', 'control', 'stop', '--db', v.db], { stdio: 'ignore' });
    const deadline = setTimeout(() => worker.kill(), 5000);
    worker.on('exit', () => {
      clearTimeout(deadline);
      process.exit(0);
    });
  } else process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

run('worker', ['apps/worker/src/main.ts', '--db', v.db, '--speed', v.speed]);
run('api', ['apps/api/src/main.ts', '--db', v.db]);
run('web', ['apps/web/node_modules/vite/bin/vite.js', '--config', 'apps/web/vite.config.ts']);
console.log('\nAbre http://127.0.0.1:5173 en el navegador. Ctrl+C para detener.\n');
