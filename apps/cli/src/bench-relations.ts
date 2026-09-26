// `bench:relations` (bloque MF4, 037 CA-004): tiempo del valor funcional de un estímulo para 200 personas con
// 500 relaciones cada una, con redes de distinta densidad (100, 250 y 500 estímulos). Mediana de 10 consultas.
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createRng, emptyNetwork, functionalValue, teach } from '@datas-world/engine';
import type { RelationType, RelationalNetwork } from '@datas-world/engine';
import type { Io } from './common.ts';

const TYPES: readonly RelationType[] = ['coordination', 'opposition', 'more', 'less', 'contains', 'part_of', 'causes', 'distinction'];
const LIMIT_MS = 5;

function networks(people: number, edges: number, nodes: number): RelationalNetwork[] {
  const rng = createRng(1).fork(`bench:relations/${nodes}`);
  return Array.from({ length: people }, () => {
    const net = emptyNetwork();
    for (let k = 0; k < edges; k++)
      teach(net, { a: `s${rng.int(0, nodes - 1)}`, b: `s${rng.int(0, nodes - 1)}`, t: TYPES[rng.int(0, TYPES.length - 1)]!, s: 0.5 + 0.5 * rng.next(), now: k });
    return net;
  });
}

export function benchRelations(args: string[], io: Io): void {
  const { values: v } = parseArgs({ args, options: { out: { type: 'string' } } });
  const direct = (x: string) => (x.endsWith('7') ? -0.5 : 0);
  const lines = [
    '# bench:relations — valor funcional de un estímulo (037 CA-004)',
    '',
    '200 personas con 500 relaciones al azar cada una; mediana y máximo de 10 consultas (estímulos distintos), después de 3 de calentamiento.',
    '',
    '| Estímulos en la red | Aristas por estímulo | Mediana | Máximo | < 5 ms |',
    '|---|---|---|---|---|',
  ];
  for (const nodes of [100, 250, 500]) {
    const nets = networks(200, 500, nodes);
    for (let w = 0; w < 3; w++) for (const n of nets) functionalValue(n, direct, `s${w}`);
    const times: number[] = [];
    for (let rep = 0; rep < 10; rep++) {
      const t0 = performance.now();
      for (const n of nets) functionalValue(n, direct, `s${10 + rep}`);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const median = (times[4]! + times[5]!) / 2;
    lines.push(`| ${nodes} | ${(500 / nodes).toFixed(1)} | ${median.toFixed(2)} ms | ${times[9]!.toFixed(2)} ms | ${median < LIMIT_MS ? '✔' : '✘'} |`);
  }
  const text = lines.join('\n') + '\n';
  if (v.out) writeFileSync(v.out, text);
  io.out(text);
}
