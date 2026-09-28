// Historia de vida en la API (spec 041 R-009, CA-005, CA-006) sobre un mundo generado con su desarrollo. No se usa un
// mundo de ejemplo guardado: con el registro completo de episodios pesa ≈ 25 MB (docs/validaciones/mundos/README.md).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateWorld } from '@datas-world/generators';
import { WorldRepository, closeDb, openWorldDb } from '@datas-world/persistence';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LifeView } from './life.ts';
import { buildApi } from './server.ts';
import type { Api } from './server.ts';

let dir: string;
let api: Api;
let gen: ReturnType<typeof generateWorld>;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'api-vida-'));
  const db = join(dir, 'w.db');
  gen = generateWorld({ seed: 482917 });
  const h = openWorldDb(db);
  new WorldRepository(h).flush({ world: gen.world, events: gen.events });
  closeDb(h);
  api = buildApi({ db, clock: () => '2026-09-28T12:00:00Z' });
});
afterAll(async () => {
  await api.close();
  rmSync(dir, { recursive: true, force: true });
});

const life = async (id: string) => (await api.app.inject({ url: `/api/citizens/${id}/life` })).json() as LifeView;

describe('041 R-009: historia de vida y familiograma', () => {
  it('CA-005: los episodios por etapa, con fecha, edad, quién intervino, qué pasó y lo aprendido en palabras', async () => {
    const adult = gen.pop.citizenIds.find((id) => gen.world.components.i32['demo.birthMinute']![Number(id.slice(4))]! < -40 * 365 * 1440)!;
    const v = await life(adult);
    expect(v.stages.map((s) => s.stage)).toEqual(['infancia', 'escolar', 'adolescencia', 'adulto']);
    const all = v.stages.flatMap((s) => s.episodes);
    expect(all.length).toBeGreaterThan(400);
    for (const e of all.slice(0, 200)) {
      expect(e.date).toMatch(/^\d{4}-\d\d-\d\d$/);
      expect(e.text.length).toBeGreaterThan(10);
      for (const l of e.learned) expect(l.label, e.kind).not.toMatch(/^(conv|evit|habito|dominio|rol|verbal)\./);
    }
    // Quien le cuidó de pequeño tiene nombre si vivía en el mundo o fuera de él (antepasado).
    expect(all.some((e) => e.speakerName !== null)).toBe(true);
    // Los episodios que produjo un hecho de la 030 lo citan.
    const caused = gen.pop.citizenIds.map((id) => id).slice(0, 40);
    let found = false;
    for (const id of caused) if ((await life(id)).stages.flatMap((s) => s.episodes).some((e) => e.cause !== null)) found = true;
    expect(found).toBe(true);
  });

  it('CA-006: el familiograma tiene a los parientes conocidos con su generación, sus años y la calidad de la relación', async () => {
    const withGrandparents = gen.pop.citizenIds.find((id) => {
      const m = gen.world.citizens.get(id)!.motherId;
      return m && gen.world.citizens.get(m)?.motherId;
    })!;
    const v = await life(withGrandparents);
    const rel = (r: string) => v.genogram.nodes.filter((n) => n.relation === r);
    expect(rel('yo')).toHaveLength(1);
    expect(rel('madre')).toHaveLength(1);
    expect(v.genogram.nodes.some((n) => n.relation === 'abuela' || n.relation === 'abuelo')).toBe(true);
    for (const n of v.genogram.nodes) {
      expect(['cercana', 'conflictiva', 'distante', 'sin_datos']).toContain(n.quality);
      expect(n.generation).toBeGreaterThanOrEqual(-3);
      expect(n.generation).toBeLessThanOrEqual(1);
    }
    // La madre, que intervino en su crianza, tiene una calidad de relación formada por los episodios.
    expect(rel('madre')[0]!.quality).not.toBe('sin_datos');
    // Los padres forman pareja en el familiograma.
    expect(v.genogram.partners.length).toBeGreaterThan(0);
  });

  it('400 con un id inválido y 404 si no existe', async () => {
    expect((await api.app.inject({ url: '/api/citizens/xx/life' })).statusCode).toBe(400);
    expect((await api.app.inject({ url: '/api/citizens/CIT-999999/life' })).statusCode).toBe(404);
  });
});
