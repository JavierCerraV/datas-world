// Punto de entrada de la CLI: `node apps/cli/src/main.ts <comando> …` (desde la raíz: `pnpm cli …`).
import { runAsync } from './commands.ts';

// Si la salida se corta (p. ej. `… | head`), se termina sin error en lugar de lanzar EPIPE.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

process.exitCode = await runAsync(process.argv.slice(2), {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
  now: () => new Date().toISOString(),
});
