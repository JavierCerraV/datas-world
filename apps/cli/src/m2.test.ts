// Mundo de ejemplo de M2 (bloque H5, 027 R-011): se carga con el motor actual (hash verificado), sigue con la vida
// diaria y el de M1 sigue siendo un mundo estático.
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorldRepository, closeDb, openReadonly } from '@datas-world/persistence';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run } from './commands.ts';

const MUNDOS = join(import.meta.dirname, '..', '..', '..', 'docs', 'validaciones', 'mundos');
const M2 = join(MUNDOS, 'm2-482917.db');
const M1 = join(MUNDOS, 'm1-482917.db');

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mundo-m2-'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const cli = (...argv: string[]) => run(argv, { out: () => {}, err: () => {}, now: () => '2026-09-25T00:00:00Z' });

function counts(db: string): { events: number; leisure: number; salary: number; capabilities: string[] } {
  const h = openReadonly(db);
  try {
    const repo = new WorldRepository(h);
    const world = repo.loadWorld();
    return { events: repo.countEvents(), leisure: repo.countEvents('LEISURE_DONE'), salary: repo.countEvents('SALARY_PAID'), capabilities: world.capabilities };
  } finally {
    closeDb(h);
  }
}

describe('mundos de ejemplo (027 R-011)', () => {
  it.skipIf(!existsSync(M2))('el de M2 se carga (hash verificado) y sigue con la vida diaria un día más', () => {
    const copy = join(dir, 'm2.db');
    copyFileSync(M2, copy);
    const before = counts(copy);
    expect(before.capabilities).toContain('economy');
    expect(before.leisure).toBeGreaterThan(0);
    expect(cli('world:advance', '--days', '1', '--db', copy)).toBe(0);
    const after = counts(copy);
    expect(after.leisure).toBeGreaterThan(before.leisure);
    expect(after.events).toBeGreaterThan(before.events + 50);
  }, 120_000);

  it.skipIf(!existsSync(M1))('el de M1 sigue siendo estático: sin sus capacidades, solo avanza el reloj', () => {
    const copy = join(dir, 'm1.db');
    copyFileSync(M1, copy);
    const before = counts(copy);
    expect(before.capabilities).toEqual(['clock']);
    expect(cli('world:advance', '--days', '1', '--db', copy)).toBe(0);
    const after = counts(copy);
    expect(after.events - before.events).toBe(1); // solo DAY_STARTED
  }, 120_000);
});
