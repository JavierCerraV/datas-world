// Spec 047 (CA-005, CA-013): `study:session` corre una sesión del protocolo con una persona, guarda la transcripción con
// la postura de cada turno y la nota del terapeuta, no cambia el mundo y encadena la sesión siguiente con su memoria.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openReadonly, queryEvents } from '@datas-world/persistence';
import { run, runAsync } from './commands.ts';
import { withDb } from './common.ts';

let dir: string;
let db: string;
const io = { out: () => undefined, err: () => undefined, now: () => '2026-10-08T00:00:00Z' };

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'estudio-'));
  db = join(dir, 'w.db');
  expect(run(['world:new', '--seed', '482917', '--population', '60', '--db', db], io)).toBe(0);
}, 120_000);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

interface Saved {
  meta: { citizen: string; name: string; session: number; date: string; hashBefore: string; hashAfter: string; provider: string };
  result: { ended: string; fidelity: number; therapistTurns: number; covered: string[]; missing: string[] };
  note: string;
  history: { session: number; note: string }[];
  transcript: { speaker: string; text: string; section: string; stance?: string }[];
  patient: { turn: number; stance: string; level: number; expression: string; stanceCheck: string }[];
  usage: Record<string, { calls: number }>;
}
const read = (p: string) => JSON.parse(readFileSync(`${p}.json`, 'utf8')) as Saved;

describe('study:session (047)', () => {
  it('con mock: guarda la transcripción con posturas, no cambia el mundo y es reproducible (CA-005)', async () => {
    const a = join(dir, 's1');
    const b = join(dir, 's1b');
    expect(await runAsync(['study:session', '--db', db, '--citizen', 'CIT-000019', '--max-turns', '8', '--out', a], io)).toBe(0);
    expect(await runAsync(['study:session', '--db', db, '--citizen', 'CIT-000019', '--max-turns', '8', '--out', b], io)).toBe(0);
    expect(readFileSync(`${a}.json`, 'utf8')).toBe(readFileSync(`${b}.json`, 'utf8'));
    const s = read(a);
    expect(s.meta).toMatchObject({ citizen: 'CIT-000019', session: 1, provider: 'mock' });
    expect(s.meta.hashAfter).toBe(s.meta.hashBefore);
    expect(s.result.therapistTurns).toBe(8);
    expect(s.result.ended).toBe('tope');
    expect(s.result.fidelity).toBeGreaterThan(0);
    expect(s.transcript).toHaveLength(16);
    expect(s.transcript.filter((t) => t.speaker === 'persona').every((t) => !!t.stance)).toBe(true);
    expect(s.patient).toHaveLength(8);
    expect(s.note.length).toBeGreaterThan(0);
    expect(s.usage.therapist!.calls).toBe(9);
    const md = readFileSync(`${a}.md`, 'utf8');
    expect(md).toContain('**Terapeuta:**');
    expect(md).toContain(`**${s.meta.name.split(' ')[0]}`);
  }, 60_000);

  it('la sesión 2 parte de la anterior: el terapeuta lleva su nota (CA-013)', async () => {
    const s1 = join(dir, 's1');
    const s2 = join(dir, 's2');
    const work = join(dir, 'trabajo.db');
    expect(await runAsync(['study:session', '--db', db, '--work', work, '--previous', `${s1}.json`, '--max-turns', '4', '--out', s2], io)).toBe(0);
    const s = read(s2);
    expect(s.meta).toMatchObject({ citizen: 'CIT-000019', session: 2 });
    expect(s.history).toEqual([{ session: 1, note: read(s1).note }]);
    expect(s.transcript[0]!.section.startsWith('s2.')).toBe(true);
  }, 120_000);

  it('entre una sesión y la siguiente pasa una semana en una copia, y la persona recuerda la consulta (R-003, R-010)', async () => {
    const [s1, s2, s3] = ['s1', 's2', 's3'].map((x) => join(dir, x)) as [string, string, string];
    const work = join(dir, 'trabajo.db');
    const days = (a: Saved, b: Saved) => (Date.parse(`${String(b.meta.date).replace(' ', 'T')}Z`) - Date.parse(`${String(a.meta.date).replace(' ', 'T')}Z`)) / 86_400_000;
    expect(days(read(s1), read(s2))).toBe(7);
    expect(read(s2).meta.hashBefore).not.toBe(read(s1).meta.hashBefore);
    // La charla de la sesión 1 quedó consolidada en la copia como una conversación de la persona (043 R-019).
    const held = withDb(openReadonly(work), (d) => queryEvents(d, { participant: 'CIT-000019', limit: 100_000 }).filter((e) => e.type === 'CONVERSATION_HELD'));
    expect(held).toHaveLength(1);
    // La sesión 3 sigue sobre la misma copia: otra semana, y la sesión 2 consolidada.
    expect(await runAsync(['study:session', '--db', db, '--work', work, '--previous', `${s2}.json`, '--max-turns', '3', '--out', s3], io)).toBe(0);
    expect(days(read(s2), read(s3))).toBe(7);
    expect(read(s3).history.map((h) => h.session)).toEqual([1, 2]);
    const held2 = withDb(openReadonly(work), (d) => queryEvents(d, { participant: 'CIT-000019', limit: 100_000 }).filter((e) => e.type === 'CONVERSATION_HELD'));
    expect(held2).toHaveLength(2);
    // La base de origen no cambió: la sesión 1 sobre ella da lo mismo que antes.
    const again = join(dir, 's1c');
    expect(await runAsync(['study:session', '--db', db, '--citizen', 'CIT-000019', '--max-turns', '8', '--out', again], io)).toBe(0);
    expect(readFileSync(`${again}.json`, 'utf8')).toBe(readFileSync(`${s1}.json`, 'utf8'));
    // Una copia que no está en la fecha de la sesión anterior se rechaza, en vez de mezclar tiempos.
    expect(await runAsync(['study:session', '--db', db, '--work', work, '--previous', `${s1}.json`, '--out', join(dir, 'mal')], io)).toBe(2);
  }, 240_000);

  it('rechaza un proveedor desconocido y una persona que no existe', async () => {
    expect(await runAsync(['study:session', '--db', db, '--provider', 'otro'], io)).toBe(2);
    expect(await runAsync(['study:session', '--db', db, '--citizen', 'CIT-999999', '--out', join(dir, 'x')], io)).toBe(2);
    expect(existsSync(join(dir, 'x.json'))).toBe(false);
  });
});
