// Observación como el prototipo (spec 022 v0.4: R-012 a R-014; CA-009 a CA-011), sobre una copia del mundo de M2.
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { EntityId } from '@datas-world/engine';
import { knowledgeCatalog, loadCatalogs } from '@datas-world/generators';
import { closeDb, openWorldDb, saveMoves } from '@datas-world/persistence';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aboutMe, statsOf } from './observe.ts';
import { placeDetail } from './places.ts';
import { buildApi } from './server.ts';
import type { Api } from './server.ts';
import { living } from './views.ts';

const M2 = join(import.meta.dirname, '..', '..', '..', 'docs', 'validaciones', 'mundos', 'm2-482917.db');
let dir: string;
let db: string;
let api: Api;
const auth = { user: 'ana', password: 'secreta' };
const basic = `Basic ${Buffer.from('ana:secreta').toString('base64')}`;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'api-obs-'));
  db = join(dir, 'w.db');
  copyFileSync(M2, db);
  api = buildApi({ db, auth, clock: () => '2026-09-29T12:00:00Z' });
});
afterAll(async () => {
  await api.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('022 R-012: movimientos', () => {
  it('CA-009: /api/moves da los que salen después de `since` y los que siguen en curso, como la base', async () => {
    const now = api.reader.world.now;
    const rw = openWorldDb(db);
    const w = api.reader.world;
    saveMoves(rw, [
      { citizenId: 'CIT-000001', departAt: now - 100, arriveAt: now - 90, from: 'PLC-0001', to: 'PLC-0002', mode: 'walk' }, // ya llegó
      { citizenId: 'CIT-000002', departAt: now - 20, arriveAt: now + 5, from: 'PLC-0003', to: 'PLC-0004', mode: 'bus' }, // en curso
      { citizenId: 'CIT-000003', departAt: now - 5, arriveAt: now, from: 'PLC-0004', to: 'PLC-0003', mode: 'walk' },
    ], w.now);
    closeDb(rw);
    const r = (await api.app.inject({ url: `/api/moves?since=${now - 30}` })).json() as { citizenId: string; departAt: number; mode: string }[];
    expect(r.map((m) => m.citizenId)).toEqual(['CIT-000002', 'CIT-000003']);
    expect(r[0]).toEqual({ citizenId: 'CIT-000002', departAt: now - 20, arriveAt: now + 5, from: 'PLC-0003', to: 'PLC-0004', mode: 'bus' });
    expect((await api.app.inject({ url: '/api/moves?since=abc' })).statusCode).toBe(400);
  });
});

describe('022 R-013: indicadores y avance', () => {
  it('CA-010: /api/stats coincide con el cálculo sobre el estado; un avance no admitido responde 400', async () => {
    const w = api.reader.world;
    const s = (await api.app.inject({ url: '/api/stats' })).json() as ReturnType<typeof statsOf>;
    expect(s.population).toBe(living(w).length);
    expect(s.households).toBeGreaterThan(0);
    expect(s.employedPct).toBeGreaterThan(0.5);
    expect(s.employedPct).toBeLessThanOrEqual(1);
    const moods = living(w).map((c) => w.components.f32['state.mood']![Number(c.id.slice(4))]!);
    expect(s.moodMean).toBeCloseTo(moods.reduce((a, b) => a + b, 0) / moods.length, 2);
    expect(s.advance).toBeNull();
    const post = (body: Record<string, unknown>) => api.app.inject({ method: 'POST', url: '/api/control', headers: { authorization: basic }, payload: body });
    expect((await post({ cmd: 'advance', arg: 777 })).statusCode).toBe(400);
    expect((await post({ cmd: 'advance', arg: 1440 })).statusCode).toBe(200);
  });
});

describe('022 R-014: ficha completa', () => {
  it('CA-011: lo que otros creen de una persona, por versión y con su verdad; el personal de un lugar de trabajo', () => {
    const w = structuredClone(api.reader.world);
    const [a, b, c] = living(w);
    // Dos personas creen algo de `a` (un mundo de M2 no tiene creencias: se añaden a mano sobre una copia).
    b!.beliefs = [{ about: a!.id, predicate: 'perdio_el_empleo', source: c!.id, credibility: 0.7, hops: 1, at: w.now } as never];
    c!.beliefs = [{ about: a!.id, predicate: 'perdio_el_empleo', source: a!.id, credibility: 0.9, hops: 0, at: w.now } as never];
    const cat = knowledgeCatalog(loadCatalogs());
    const about = aboutMe(w, a!.id as EntityId, [], cat);
    expect(about).toHaveLength(1);
    expect(about[0]!.holders.map((h) => h.id).sort()).toEqual([b!.id, c!.id].sort());
    expect(about[0]!.true).toBe(false); // no hay ningún despido suyo en el registro
    expect(about[0]!.topic).not.toContain('_');

    const org = [...w.organizations.values()].find((o) => o.positions.some((q) => q.holderId) && o.placeIds.length)!;
    const p = placeDetail(w, org.placeIds[0]!)!;
    const holders = org.positions.filter((q) => q.holderId && w.citizens.get(q.holderId)?.status === 'active').map((q) => q.holderId);
    expect(p.staff.map((s) => s.id).sort()).toEqual(expect.arrayContaining(holders.sort() as string[]));
    if (p.staff.some((s) => s.boss)) expect(p.staff[0]!.boss).toBe(true); // el jefe, primero
  });
});
