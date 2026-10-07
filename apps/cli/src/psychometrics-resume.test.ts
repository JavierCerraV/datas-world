// Spec 046: reanudar no reescribe lo ya medido. Una corrida real recalculó los indicadores de las tomas 0 y 1 con el
// mundo ya avanzado a la toma 2 (los dejó iguales a los de la toma 2); esta prueba lo impide.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run, runAsync } from './commands.ts';

let dir: string;
const io = (err: string[] = []) => ({ out: () => {}, err: (l: string) => err.push(l), now: () => '2026-10-07T00:00:00Z' });

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'psico-resume-'));
  expect(run(['world:new', '--seed', '482917', '--population', '80', '--db', join(dir, 'w.db')], io())).toBe(0);
}, 180_000);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

interface Take { citizenId: string; toma: number; indicators?: Record<string, number>; instruments?: unknown }
const args = (out: string, ...extra: string[]) => ['psychometrics', '--provider', 'mock', '--n', '8', '--month-days', '3', '--year-days', '3', '--db', join(dir, 'w.db'), '--work', join(dir, 'copia.db'), '--out', out, ...extra];

describe('046 psychometrics --resume', () => {
  it('conserva los indicadores y las fechas de las tomas ya medidas', async () => {
    const out = join(dir, 'b');
    expect(await runAsync(args(out), io())).toBe(0);
    const first = JSON.parse(readFileSync(`${out}.json`, 'utf8')) as { takes: Take[]; tomas: { toma: number; date: string }[] };
    // Se simula una corrida cortada: a tres personas de la toma 2 se les quita la medición del punto de control.
    const ck = JSON.parse(readFileSync(`${out}.ckpt.json`, 'utf8')) as { battery: { takes: Take[] } };
    let cut = 0;
    for (const t of ck.battery.takes) {
      if (t.toma !== 2 || cut >= 3) continue;
      delete t.instruments;
      cut++;
    }
    writeFileSync(`${out}.ckpt.json`, JSON.stringify(ck));
    const err: string[] = [];
    expect(await runAsync(args(out, '--resume'), io(err))).toBe(0);
    const after = JSON.parse(readFileSync(`${out}.json`, 'utf8')) as { takes: Take[]; tomas: { toma: number; date: string }[] };

    expect(after.tomas).toEqual(first.tomas);
    for (const toma of [0, 1]) {
      const a = first.takes.filter((t) => t.toma === toma).map((t) => JSON.stringify(t.indicators));
      expect(after.takes.filter((t) => t.toma === toma).map((t) => JSON.stringify(t.indicators))).toEqual(a);
    }
    // Las tomas son distintas entre sí: de lo contrario la prueba no distinguiría nada.
    const ind = (toma: number) => first.takes.filter((t) => t.toma === toma).map((t) => JSON.stringify(t.indicators));
    expect(ind(0)).not.toEqual(ind(2));
    expect(err.join('\n')).toMatch(/Toma 0: ya medida/);
    expect(after.takes.filter((t) => t.toma === 2).every((t) => t.instruments)).toBe(true);
  }, 600_000);
});
