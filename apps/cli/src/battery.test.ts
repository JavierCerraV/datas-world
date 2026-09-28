import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runAsync } from './commands.ts';

const M2 = join(import.meta.dirname, '..', '..', '..', 'docs', 'validaciones', 'mundos', 'm2-482917.db');
let dir: string;
let db: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'bateria-'));
  db = join(dir, 'w.db');
  copyFileSync(M2, db);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const io = { out: () => undefined, err: (l: string) => console.error(l), now: () => '2026-09-27T00:00:00Z' };

describe('chat:battery (043 R-015)', () => {
  it.skipIf(!existsSync(M2))('CA-016: con mock, dos ejecuciones sobre 5 ciudadanos y todos los guiones dan informes idénticos', async () => {
    const a = join(dir, 'a');
    const b = join(dir, 'b');
    expect(await runAsync(['chat:battery', '--db', db, '--citizens', '5', '--out', a], io)).toBe(0);
    expect(await runAsync(['chat:battery', '--db', db, '--citizens', '5', '--out', b], io)).toBe(0);
    expect(readFileSync(`${a}.json`, 'utf8')).toBe(readFileSync(`${b}.json`, 'utf8'));
    expect(readFileSync(`${a}.md`, 'utf8')).toBe(readFileSync(`${b}.md`, 'utf8'));
    const report = JSON.parse(readFileSync(`${a}.json`, 'utf8')) as { citizens: string[]; scripts: string[]; byTone: Record<string, Record<string, number>>; turns: number };
    expect(report.citizens).toHaveLength(5);
    expect(report.scripts).toHaveLength(15);
    expect(report.turns).toBeGreaterThan(100);
    // §9: el tono cambia la distribución de posturas.
    const escape = (s: Record<string, number>) => ['evadir', 'poner_limite', 'contraatacar', 'callar', 'terminar'].reduce((x, k) => x + (s[k] ?? 0), 0);
    expect(escape(report.byTone.hostil!)).toBeGreaterThan(escape(report.byTone.amable!));
    // 044 §9: el guion «revelación sobre la pareja» se oye; quien no tiene pareja lo descarta con el motivo.
    const c = (report as unknown as { consequences: { heard: number; discarded: Record<string, number>; formed: number } }).consequences;
    expect(c.heard + (c.discarded['no tiene pareja'] ?? 0)).toBeGreaterThan(0);
  }, 120_000);

  it('rechaza un proveedor desconocido', async () => {
    expect(await runAsync(['chat:battery', '--db', db, '--provider', 'otro'], { ...io, err: () => undefined })).toBe(2);
  });
});
