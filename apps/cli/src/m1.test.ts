// Pruebas de la CLI con el mundo de M1 completo (bloque I): world:new, report, map, history y citizen:report.
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stateHash } from '@datas-world/engine';
import type { World } from '@datas-world/engine';
import { generateWorld } from '@datas-world/generators';
import { WorldRepository, closeDb, openReadonly } from '@datas-world/persistence';
import type { Db } from '@datas-world/persistence';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run } from './commands.ts';
import { citizenLines } from './history.ts';

const EXAMPLE = join(import.meta.dirname, '..', '..', '..', 'docs', 'validaciones', 'mundos', 'm1-482917.db');

let dir: string;
let db: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mundo-m1-'));
  db = join(dir, 'w.db');
  expect(cli('world:new', '--seed', '482917', '--db', db).code).toBe(0);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function cli(...argv: string[]): { code: number; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  const code = run(argv, { out: (l) => out.push(l), err: (l) => err.push(l), now: () => '2026-09-24T00:00:00Z' });
  return { code, out, err };
}

const withWorld = <T>(fn: (world: World, h: Db) => T): T => {
  const h = openReadonly(db);
  try {
    return fn(new WorldRepository(h).loadWorld(), h);
  } finally {
    closeDb(h);
  }
};

describe('world:new con el perfil colombiano', () => {
  it('guarda el mundo completo y al cargarlo el hash es el generado (027 CA-001 y CA-006 con población)', () => {
    const info = JSON.parse(cli('world:info', '--json', '--db', db).out[0]!) as Record<string, number | string>;
    expect(info).toMatchObject({ profile: 'CO-2026.09', now: 0, organizations: 8 });
    expect(info.pending).toContain('stratum.share'); // 029 CA-003: world:info lista las cifras por confirmar
    expect(cli('world:info', '--db', db).out.some((l) => /cifras por confirmar \(\d+\): .*stratum\.share/.test(l))).toBe(true);
    expect(info.citizens).toBeGreaterThanOrEqual(190);
    expect(info.ancestors).toBeGreaterThan(info.citizens as number);
    expect(info.hash).toBe(stateHash(generateWorld({ seed: 482917 }).world));
  });

  it('001 CA-005: semillas distintas dan hashes distintos tras la generación', () => {
    const other = join(dir, 'otro.db');
    cli('world:new', '--seed', '482918', '--db', other);
    const hash = (p: string) => (JSON.parse(cli('world:info', '--json', '--db', p).out[0]!) as { hash: string }).hash;
    expect(hash(other)).not.toBe(hash(db));
  });

  it('--profile prototipo genera la población del prototipo', () => {
    const p = join(dir, 'proto.db');
    expect(cli('world:new', '--seed', '1', '--profile', 'prototipo', '--db', p).code).toBe(0);
    expect(cli('world:new', '--seed', '1', '--profile', 'marte', '--db', join(dir, 'x.db')).code).toBe(1);
    const info = JSON.parse(cli('world:info', '--json', '--db', p).out[0]!) as { profile: string };
    expect(info.profile).toBe('prototipo');
  });
});

describe('world:report', () => {
  it('compara la población con el perfil y lista las cifras por confirmar (029 §9)', () => {
    const r = cli('world:report', '--json', '--db', db);
    expect(r.code).toBe(0);
    const rep = JSON.parse(r.out[0]!) as {
      rows: { indicator: string; world: number; reference: number | null; deviation: number | null }[];
      pending: string[];
    };
    const row = (name: string) => rep.rows.find((x) => x.indicator === name)!;
    expect(Math.abs(row('Tamaño medio del hogar').deviation!)).toBeLessThan(0.3);
    expect(Math.abs(row('Tasa de ocupación (15+)').deviation!)).toBeLessThan(0.1);
    expect(rep.pending).toContain('stratum.share');
  });

  it('--history resume la historia por décadas (030 §9)', () => {
    const out = cli('world:report', '--history', '--db', db).out;
    expect(out.some((l) => /antepasados/.test(l))).toBe(true);
    expect(out.some((l) => /^1950 /.test(l))).toBe(true);
  });
});

describe('world:map', () => {
  it('dibuja el mapa de 64 × 40 con barrios y la leyenda de lugares', () => {
    const out = cli('world:map', '--db', db).out;
    const blank = out.indexOf('');
    expect(blank).toBe(40);
    expect(out.slice(0, 40).every((l) => l.length <= 64)).toBe(true);
    expect(out.some((l) => /Barrios: La Esperanza/.test(l))).toBe(true);
    expect(out.some((l) => /Iglesia/.test(l))).toBe(true);
  });
});

describe('world:history (030 R-008)', () => {
  it('CA-006: de 1948 a 1958 salen los eventos del periodo y cada migración del campo enlaza La Violencia', () => {
    const r = cli('world:history', '--from', '1948', '--to', '1958', '--db', db);
    expect(r.code).toBe(0);
    const lines = r.out.slice(0, -1);
    expect(lines.length).toBeGreaterThan(20);
    for (const l of lines) expect(Number(l.slice(0, 4))).toBeGreaterThanOrEqual(1948);
    for (const l of lines) expect(Number(l.slice(0, 4))).toBeLessThanOrEqual(1958);
    const rural = lines.filter((l) => /llega a .* desde (el campo|un pueblo de Boyacá)/.test(l));
    expect(rural.length).toBeGreaterThan(0);
    for (const l of rural) expect(l).toMatch(/← .*La Violencia/);
  });

  it('filtra por tipo y por persona, y muestra nombres en lugar de ids', () => {
    const r = cli('world:history', '--type', 'TOWN_FOUNDED', '--db', db);
    expect(r.out[0]).toMatch(/^1900-\d\d-\d\d {2}Se funda Data's World/);
    const one = cli('world:history', '--citizen', 'CIT-000001', '--no-causes', '--db', db).out;
    expect(one.some((l) => /Nace /.test(l))).toBe(true);
    expect(one.join('\n')).not.toMatch(/CIT-\d+/);
  });
});

describe('citizen:report (030 CA-003)', () => {
  it('cada persona viva muestra sus padres y sus cuatro abuelos, con nacimiento y muerte o "vive"', () => {
    withWorld((world, h) => {
      const living = [...world.citizens.values()].filter((c) => !c.ancestor);
      for (const c of living) {
        const lines = citizenLines(world, h, c);
        const fam = lines.slice(lines.indexOf('Familia') + 1, lines.indexOf('Línea de vida'));
        expect(fam.filter((l) => /^ {2}(madre|padre): /.test(l))).toHaveLength(2);
        const grand = fam.filter((l) => /^ {4}(abuela|abuelo): /.test(l));
        expect(grand).toHaveLength(4);
        for (const l of grand) expect(l).toMatch(/n\. \d{4}-\d\d-\d\d .*(m\. \d{4}|vive)|desconocido/);
      }
    });
  });

  it('por la CLI: ficha, familia y línea de vida; un id inexistente es un error de uso', () => {
    const r = cli('citizen:report', 'CIT-000001', '--db', db);
    expect(r.code).toBe(0);
    expect(r.out).toContain('Familia');
    expect(r.out).toContain('Línea de vida');
    expect(cli('citizen:report', 'CIT-999999', '--db', db).code).toBe(2);
    expect(cli('citizen:report', '--db', db).code).toBe(2);
  });
});

describe('mundo de ejemplo de M1 (027 R-011)', () => {
  it.skipIf(!existsSync(EXAMPLE))('se carga con el motor actual (hash verificado) y avanza', () => {
    const copy = join(dir, 'ejemplo.db');
    copyFileSync(EXAMPLE, copy);
    expect(cli('world:info', '--db', copy).code).toBe(0);
    expect(cli('world:advance', '--days', '1', '--db', copy).code).toBe(0);
  });
});
