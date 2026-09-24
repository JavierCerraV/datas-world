// Punto de entrada de la CLI: `node apps/cli/src/main.ts <comando> …` (desde la raíz: `pnpm cli …`).
import { run } from './commands.ts';

process.exitCode = run(process.argv.slice(2), {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
  now: () => new Date().toISOString(),
});
