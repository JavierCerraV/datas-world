// `bench:life` (bloque H3 de M2): tiempo y memoria de la vida diaria con N personas × N días (021 CA-002:
// 500 personas, 1 año en < 10 min) y memoria por persona (CLAUDE.md regla 8).
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { stateHash } from '@datas-world/engine';
import { generateWorld, lifeRunner, loadCatalogs } from '@datas-world/generators';
import { toInt } from './common.ts';
import type { Io } from './common.ts';

const MB = 1024 * 1024;
const LIMIT_MS = 10 * 60 * 1000;

export function benchLife(args: string[], io: Io): void {
  const { values: v } = parseArgs({
    args,
    options: {
      population: { type: 'string', default: '500' },
      days: { type: 'string', default: '365' },
      profile: { type: 'string', default: 'CO-2026.09' },
      seed: { type: 'string', default: '482917' },
      out: { type: 'string' },
    },
  });
  const population = toInt('population', v.population, 10);
  const days = toInt('days', v.days, 1);
  const seed = toInt('seed', v.seed, 0);
  const gc = (globalThis as { gc?: () => void }).gc;
  gc?.();
  const heap0 = process.memoryUsage().heapUsed;
  const t0 = performance.now();
  const catalogs = loadCatalogs();
  const { world } = generateWorld({ seed, profileId: v.profile!, population, catalogs });
  const genMs = performance.now() - t0;
  gc?.();
  const heapWorld = process.memoryUsage().heapUsed;
  const living = [...world.citizens.values()].filter((c) => !c.ancestor).length;
  const runner = lifeRunner(world, catalogs);
  const t1 = performance.now();
  for (let d = 1; d <= days; d++) {
    runner.advanceDays(1);
    runner.drainEvents(); // el registro de eventos es de la persistencia; aquí no se acumula
    if (d % 30 === 0) io.err(`día ${d}: ${Math.round((performance.now() - t1) / 1000)} s`);
  }
  const simMs = performance.now() - t1;
  gc?.();
  const mem = process.memoryUsage();
  const kbPerPerson = (mem.heapUsed - heap0) / 1024 / living;
  const lines = [
    `# bench:life — ${living} personas × ${days} días (perfil ${v.profile}, semilla ${seed})`,
    '',
    '| Métrica | Valor | Objetivo |',
    '|---|---|---|',
    `| Generación | ${(genMs / 1000).toFixed(1)} s | — |`,
    `| Simulación | ${(simMs / 1000).toFixed(1)} s (${(days / (simMs / 1000)).toFixed(2)} días/s) | < 600 s para 500 personas × 1 año (021 CA-002) ${living >= 500 && days >= 365 ? (simMs < LIMIT_MS ? '✔' : '✘') : '(no aplica a este tamaño)'} |`,
    `| Memoria del mundo al generarlo | ${((heapWorld - heap0) / MB).toFixed(1)} MB | — |`,
    `| Memoria al final (heap) | ${(mem.heapUsed / MB).toFixed(1)} MB · RSS ${(mem.rss / MB).toFixed(1)} MB | < 1 GB (CLAUDE.md regla 8) |`,
    `| Memoria por persona viva | ≈ ${kbPerPerson.toFixed(1)} KB (incluye antepasados y la parte fija) | < 40 KB (peldaño 4) |`,
    `| Hash final | \`${stateHash(world)}\` | — |`,
    '',
    gc ? 'Medido con `node --expose-gc`.' : 'Sin `--expose-gc`: la memoria incluye basura sin recoger (cota superior).',
  ];
  if (v.out) writeFileSync(v.out, lines.join('\n') + '\n');
  for (const l of lines) io.out(l);
}
