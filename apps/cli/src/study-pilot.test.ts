// Spec 047 (R-001b, R-003, R-010): `study:pilot` aplica el protocolo completo a varias personas, con una semana entre
// sesiones en una copia, y se puede reanudar sin repetir lo hecho.
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run, runAsync } from './commands.ts';

let dir: string;
let db: string;
const io = { out: () => undefined, err: () => undefined, now: () => '2026-10-08T00:00:00Z' };
const PEOPLE = 'CIT-000019,CIT-000021';

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'piloto-'));
  db = join(dir, 'w.db');
  expect(run(['world:new', '--seed', '482917', '--population', '60', '--db', db], io)).toBe(0);
}, 120_000);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

interface Session {
  meta: { citizen: string; session: number; date: string; minLevel: number };
  history: { session: number }[];
  patient: { level: number }[];
  transcript: { speaker: string; read?: string }[];
}
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as Session;
const days = (a: string, b: string) => (Date.parse(`${b.replace(' ', 'T')}Z`) - Date.parse(`${a.replace(' ', 'T')}Z`)) / 86_400_000;

describe('study:pilot (047)', () => {
  it('tres sesiones por persona, una semana entre ellas, con la memoria del terapeuta y la persona abierta desde el principio', async () => {
    const out = join(dir, 'p');
    const args = ['study:pilot', '--db', db, '--work', join(dir, 'p.db'), '--citizens', PEOPLE, '--max-turns', '3', '--out', out];
    expect(await runAsync(args, io)).toBe(0);
    for (const id of PEOPLE.split(',')) {
      const [s1, s2, s3] = [1, 2, 3].map((n) => read(join(out, `${id}-s${n}.json`))) as [Session, Session, Session];
      expect([s1, s2, s3].map((s) => s.meta.session)).toEqual([1, 2, 3]);
      expect(days(s1.meta.date, s2.meta.date)).toBe(7);
      expect(days(s2.meta.date, s3.meta.date)).toBe(7);
      expect(s3.history.map((h) => h.session)).toEqual([1, 2]);
      expect(s1.meta.minLevel).toBe(2);
      expect(s1.meta.date.endsWith(' 10:00')).toBe(true);
      expect(s1.patient.every((p) => p.level === 2)).toBe(true);
      expect(s1.transcript.filter((t) => t.speaker === 'terapeuta').every((t) => !!t.read)).toBe(true);
    }
    // Las dos personas tienen cada sesión el mismo día del mundo.
    expect(read(join(out, 'CIT-000019-s2.json')).meta.date).toBe(read(join(out, 'CIT-000021-s2.json')).meta.date);
    const summary = readFileSync(join(out, 'resumen.md'), 'utf8');
    expect(summary.match(/\| \d \| \d{4}-/g)).toHaveLength(6);
    expect(summary).toContain('| therapist | 24 |'); // 6 sesiones × (3 turnos + 1 nota)

    // Reanudar no repite nada: los archivos de las sesiones no se reescriben y no hay llamadas nuevas.
    const before = statSync(join(out, 'CIT-000019-s1.json')).mtimeMs;
    expect(await runAsync([...args, '--resume'], io)).toBe(0);
    expect(statSync(join(out, 'CIT-000019-s1.json')).mtimeMs).toBe(before);
    expect(readFileSync(join(out, 'resumen.md'), 'utf8')).toContain('| **total** | 0 |');
  }, 240_000);

  it('rechaza una lista vacía y una persona que no existe', async () => {
    expect(await runAsync(['study:pilot', '--db', db, '--work', join(dir, 'x.db'), '--out', join(dir, 'x')], io)).toBe(2);
    expect(await runAsync(['study:pilot', '--db', db, '--work', join(dir, 'x.db'), '--citizens', 'CIT-999999', '--out', join(dir, 'x')], io)).toBe(2);
  });
});
