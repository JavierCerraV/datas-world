// Spec 028: la CLI corre un experimento sobre una base sin cambiarla (CA-005), da el mismo informe dos veces (CA-006) y
// el informe trae sus límites y metadatos (CA-008).
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run } from './commands.ts';

let dir: string;
let db: string;
const io = (out: string[], err: string[] = []) => ({ out: (l: string) => out.push(l), err: (l: string) => err.push(l), now: () => '2026-10-07T00:00:00Z' });

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'exp-cli-'));
  db = join(dir, 'w.db');
  expect(run(['world:new', '--seed', '482917', '--population', '60', '--db', db], io([]))).toBe(0);
}, 120_000);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const def = {
  id: 'prueba-cli', base: { db: 'w.db' }, durationDays: 3, seeds: [1, 2], sampleEveryDays: 1,
  arms: [{ name: 'control' }, { name: 'despido', interventions: [{ afterDays: 0, kind: 'force_job_loss', target: 'subjects' }] }],
  metrics: ['mood', 'money', 'employed', 'events:JOB_LOST'], subjects: { sample: 12 },
};

function zipFiles(buf: Buffer): Map<string, string> {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let off = buf.readUInt32LE(end + 16);
  const files = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(off + 28);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    const local = buf.readUInt32LE(off + 42);
    const size = buf.readUInt32LE(off + 20);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    files.set(name, inflateRawSync(buf.subarray(start, start + size)).toString('utf8'));
    off += 46 + nameLen;
  }
  return files;
}

describe('028 experiment:run', () => {
  it('CA-005, CA-006, CA-008: no cambia la base, repite byte a byte y trae límites y metadatos', () => {
    const file = join(dir, 'exp.json');
    writeFileSync(file, JSON.stringify(def));
    const before = statSync(db);
    const go = (name: string) => {
      const out: string[] = [];
      const err: string[] = [];
      expect(run(['experiment:run', file, '--out', join(dir, name)], io(out, err))).toBe(0);
      return { out, err };
    };
    const a = go('a');
    go('b');
    const after = statSync(db);
    expect([after.size, after.mtimeMs]).toEqual([before.size, before.mtimeMs]);
    for (const ext of ['json', 'csv', 'xlsx']) expect(readFileSync(join(dir, `b.${ext}`)).equals(readFileSync(join(dir, `a.${ext}`)))).toBe(true);
    expect(a.out[0]).toMatch(/contrastes/);
    const res = JSON.parse(readFileSync(join(dir, 'a.json'), 'utf8')) as { runs: { branchHash: string }[]; interventions: { ok: boolean; reason?: string }[]; contrasts: { arm: string; metric: string }[]; meta: { baseHash: string; engine: string } };
    expect(new Set(res.runs.map((r) => r.branchHash)).size).toBe(1);
    expect(res.meta.baseHash).toMatch(/^[0-9a-f]{16,}$/);
    expect(res.interventions.some((i) => i.ok) || res.interventions.some((i) => i.reason)).toBe(true);
    expect(res.contrasts.some((c) => c.arm === 'despido' && c.metric === 'employed')).toBe(true);
    const files = zipFiles(readFileSync(join(dir, 'a.xlsx')));
    const wb = files.get('xl/workbook.xml')!;
    for (const s of ['Método y límites', 'Contrastes', 'Brazos y semillas', 'Intervenciones', 'Observaciones']) expect(wb).toContain(`name="${s}"`);
    expect(files.get('xl/worksheets/sheet1.xml')).toContain('predice el MODELO');
    expect(files.get('xl/worksheets/sheet1.xml')).toContain('Hash de la rama');
    expect(readFileSync(join(dir, 'a.csv'), 'utf8').split('\n')[0]).toBe('seed,arm,citizen,day,metric,value');
  }, 600_000);

  it('rechaza definiciones inválidas y la métrica psychometrics (pendiente)', () => {
    const bad = (patch: object) => {
      const file = join(dir, 'bad.json');
      writeFileSync(file, JSON.stringify({ ...def, ...patch }));
      const err: string[] = [];
      return { code: run(['experiment:run', file], io([], err)), err };
    };
    expect(bad({ arms: [{ name: 'solo' }] }).code).not.toBe(0);
    const p = bad({ metrics: ['psychometrics'] });
    expect(p.code).toBe(2);
    expect(p.err[0]).toMatch(/psychometrics/);
  });
});
