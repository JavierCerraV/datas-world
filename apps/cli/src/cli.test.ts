import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { acquireWriterLock, closeDb, openWorldDb, pendingCommands } from '@datas-world/persistence';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from './commands.ts';

const MAIN = join(import.meta.dirname, 'main.ts');

let dir: string;
let db: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mundo-cli-'));
  db = join(dir, 'data', 'w.db');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function cli(...argv: string[]): { code: number; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  const code = run(argv, { out: (l) => out.push(l), err: (l) => err.push(l), now: () => '2026-09-24T00:00:00Z' });
  return { code, out, err };
}

const info = (path = db) => JSON.parse(cli('world:info', '--json', '--db', path).out[0]!) as Record<string, unknown>;

describe('world:new', () => {
  it('crea el mundo y su carpeta; no pisa un mundo existente', () => {
    expect(cli('world:new', '--seed', '482917', '--empty', '--db', db).code).toBe(0);
    expect(info()).toMatchObject({ id: 'WLD-0001', seed: 482917, now: 0, status: 'created', events: 1, snapshots: 1 });
    const again = cli('world:new', '--seed', '1', '--db', db);
    expect(again.code).toBe(2);
    expect(again.err[0]).toMatch(/ya contiene un mundo/);
    expect(info()).toMatchObject({ seed: 482917 });
  });

  it('rechaza opciones inválidas sin crear nada', () => {
    expect(cli('world:new', '--db', db).code).toBe(2); // falta --seed
    expect(cli('world:new', '--seed', '-3', '--db', db).code).toBe(2);
    expect(cli('world:new', '--seed', '1', '--tick', '7', '--db', db).code).toBe(1); // 7 no divide 1440
    expect(cli('world:new', '--seed', '1', '--color', 'rojo', '--db', db).code).toBe(2);
    expect(cli('world:info', '--db', db).code).toBe(1);
  });

  it('un comando desconocido muestra la ayuda', () => {
    const r = cli('world:borrar');
    expect(r.code).toBe(2);
    expect(r.err[0]).toMatch(/^Uso:/);
  });
});

describe('world:advance', () => {
  // El límite de 2 s de la 002 CA-005 lo comprueba `pnpm bench --check` en un paso propio de la CI:
  // medido aquí, en paralelo con el resto de la suite, daba falsos fallos (2,08 s en GitHub Actions).
  it('002 CA-005: 365 días desde la CLI emiten 365 DAY_STARTED y una instantánea por día', () => {
    cli('world:new', '--seed', '482917', '--empty', '--db', db);
    expect(cli('world:advance', '--days', '365', '--db', db).code).toBe(0);
    expect(info()).toMatchObject({ now: 365 * 1440, daysStarted: 365, snapshots: 366, writerPid: null });
  }, 30_000); // ≈ 1 s sola; en paralelo con las simulaciones de la charla (044) supera los 5 s por defecto

  it('bench --check falla con --days distinto de 365', () => {
    const r = cli('bench', '--days', '1', '--check');
    expect(r.code).toBe(1);
    expect(r.err[0]).toMatch(/--days 365/);
  });

  it('avanzar 10 + 5 días da lo mismo que 15 seguidos', () => {
    const other = join(dir, 'b.db');
    cli('world:new', '--seed', '482917', '--empty', '--db', db);
    cli('world:new', '--seed', '482917', '--empty', '--db', other);
    cli('world:advance', '--days', '10', '--db', db);
    cli('world:advance', '--days', '5', '--db', db);
    cli('world:advance', '--days', '15', '--db', other);
    expect(info().hash).toBe(info(other).hash);
  });

  it('no avanza si otro proceso vivo escribe en el mundo (R-001)', () => {
    cli('world:new', '--seed', '482917', '--empty', '--db', db);
    const h = openWorldDb(db);
    acquireWriterLock(h, process.ppid);
    closeDb(h);
    const r = cli('world:advance', '--days', '1', '--db', db);
    expect(r.code).toBe(1);
    expect(r.err[0]).toMatch(`PID ${process.ppid}`);
    expect(info()).toMatchObject({ now: 0 });
  });
});

describe('control', () => {
  it('encola órdenes válidas para el worker y rechaza las inválidas', () => {
    cli('world:new', '--seed', '482917', '--empty', '--db', db);
    expect(cli('control', 'pause', '--db', db).code).toBe(0);
    expect(cli('control', 'speed', '100', '--db', db).code).toBe(0);
    expect(cli('control', 'speed', '--db', db).code).toBe(2);
    expect(cli('control', 'borrar', '--db', db).code).toBe(2);
    const h = openWorldDb(db);
    expect(pendingCommands(h).map((c) => [c.cmd, c.arg, c.createdAt])).toEqual([
      ['pause', null, '2026-09-24T00:00:00Z'],
      ['speed', '100', '2026-09-24T00:00:00Z'],
    ]);
    closeDb(h);
  });
});

describe('023 CA-001 entre procesos, con la población de M1', () => {
  const exec = promisify(execFile);
  const node = (...args: string[]) => exec(process.execPath, [MAIN, ...args]);

  it('determinismo: un mundo de 100 personas, dos procesos con la misma semilla, mismo hash tras 30 días', async () => {
    const chain = async (path: string) => {
      await node('world:new', '--seed', '482917', '--population', '100', '--db', path);
      await node('world:advance', '--days', '30', '--db', path);
      return JSON.parse((await node('world:info', '--json', '--db', path)).stdout) as {
        hash: string;
        now: number;
        citizens: number;
      };
    };
    const [a, b] = await Promise.all([chain(join(dir, 'a.db')), chain(join(dir, 'b.db'))]);
    expect(a.now).toBe(30 * 1440);
    expect(a.hash).toBe(b.hash);
    expect(a.citizens).toBeGreaterThanOrEqual(95);
    cli('world:new', '--seed', '482917', '--population', '100', '--db', db);
    cli('world:advance', '--days', '30', '--db', db);
    expect(info().hash).toBe(a.hash); // y el mismo que dentro de este proceso
  }, 120_000);
});
