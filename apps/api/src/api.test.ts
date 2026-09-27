// API de solo lectura (spec 022) sobre una copia del mundo de ejemplo de M2.
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { idNumber } from '@datas-world/engine';
import type { EntityId } from '@datas-world/engine';
import { WorldRepository, closeDb, openReadonly, pendingCommands } from '@datas-world/persistence';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApi } from './server.ts';
import type { Api } from './server.ts';
import { placePoint, positions } from './views.ts';

const M2 = join(import.meta.dirname, '..', '..', '..', 'docs', 'validaciones', 'mundos', 'm2-482917.db');
let dir: string;
let db: string;
let api: Api;
const auth = { user: 'ana', password: 'secreta' };
const basic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'api-'));
  db = join(dir, 'w.db');
  copyFileSync(M2, db);
  api = buildApi({ db, auth, clock: () => '2026-09-26T12:00:00Z' });
});
afterAll(async () => {
  await api.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('022: API de solo lectura', () => {
  it('CA-001: /api/health responde en menos de 50 ms', async () => {
    await api.app.inject({ url: '/api/health' }); // carga el mundo
    const t0 = performance.now();
    const r = await api.app.inject({ url: '/api/health' });
    const ms = performance.now() - t0;
    expect(r.statusCode).toBe(200);
    expect(ms).toBeLessThan(50);
    const h = r.json();
    expect(h.citizens).toBeGreaterThan(0);
    expect(h.date).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d$/);
  });

  it('/api/world: mapa y lugares con puerta o área', async () => {
    const w = (await api.app.inject({ url: '/api/world' })).json();
    expect(w.geo.tiles.length).toBe(w.geo.width * w.geo.height);
    expect(w.places.length).toBeGreaterThan(10);
    for (const p of w.places) expect(p.door ?? p.rect).toBeDefined();
  });

  it('CA-004: la ficha coincide con el estado guardado y la posición sigue la R-005', async () => {
    const list = (await api.app.inject({ url: '/api/citizens' })).json() as { id: string; x: number | null; y: number | null; moving: boolean; placeId: string | null }[];
    expect(list.length).toBeGreaterThan(50);
    const h = openReadonly(db);
    const world = new WorldRepository(h).loadWorld();
    closeDb(h);
    // Posición: la puerta de su lugar (o el punto del edificio) si no viaja.
    for (const c of list.filter((x) => !x.moving).slice(0, 20)) {
      const pt = placePoint(world, idNumber(c.placeId as EntityId));
      if (pt) expect([c.x, c.y]).toEqual([Math.round(pt.x * 1000) / 1000, Math.round(pt.y * 1000) / 1000]);
    }
    expect(positions(world)).toEqual(list);
    const id = list[0]!.id;
    const d = (await api.app.inject({ url: `/api/citizens/${id}` })).json();
    const row = idNumber(id as EntityId);
    expect(d.money).toBe(world.components.i32.money![row]);
    expect(d.needs.hunger).toBe(Math.round(world.components.f32['need.hunger']![row]! * 100) / 100);
    expect(d.state.mood).toBe(Math.round(world.components.f32['state.mood']![row]! * 100) / 100);
    expect(Array.isArray(d.events)).toBe(true);
    expect((await api.app.inject({ url: '/api/citizens/CIT-999999' })).statusCode).toBe(404);
    expect((await api.app.inject({ url: '/api/citizens/nada' })).statusCode).toBe(400);
  });

  it('/api/events: los últimos y los posteriores a un id', async () => {
    const last = (await api.app.inject({ url: '/api/events?limit=5' })).json() as { id: string }[];
    expect(last.length).toBe(5);
    const after = (await api.app.inject({ url: `/api/events?since=${last[1]!.id}&limit=10` })).json() as { id: string }[];
    expect(after.map((e) => e.id)).toEqual(last.slice(2).map((e) => e.id));
    expect((await api.app.inject({ url: '/api/events?limit=5000' })).statusCode).toBe(400);
  });

  it('CA-003: /api/control sin credenciales da 401; con ellas, la orden queda en control_commands', async () => {
    expect((await api.app.inject({ method: 'POST', url: '/api/control', payload: { cmd: 'pause' } })).statusCode).toBe(401);
    expect((await api.app.inject({ method: 'POST', url: '/api/control', headers: { authorization: basic('ana', 'otra') }, payload: { cmd: 'pause' } })).statusCode).toBe(401);
    const ok = await api.app.inject({ method: 'POST', url: '/api/control', headers: { authorization: basic('ana', 'secreta') }, payload: { cmd: 'speed', arg: 10 } });
    expect(ok.statusCode).toBe(200);
    const h = openReadonly(db);
    expect(pendingCommands(h).map((c) => [c.cmd, c.arg])).toEqual([['speed', '10']]);
    closeDb(h);
    const off = buildApi({ db });
    expect((await off.app.inject({ method: 'POST', url: '/api/control', payload: { cmd: 'pause' } })).statusCode).toBe(503);
    await off.close();
  });

  it('CA-002: al reconectar con Last-Event-ID, el SSE envía los eventos perdidos', async () => {
    const last = (await api.app.inject({ url: '/api/events?limit=4' })).json() as { id: string }[];
    await api.app.listen({ port: 0, host: '127.0.0.1' });
    const port = (api.app.server.address() as { port: number }).port;
    const ctrl = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/api/stream`, { headers: { 'last-event-id': last[0]!.id }, signal: ctrl.signal });
    const reader = res.body!.getReader();
    let text = '';
    while ((text.match(/^id: /gm) ?? []).length < 3) text += new TextDecoder().decode((await reader.read()).value);
    ctrl.abort();
    expect(text).toContain('event: tick');
    expect([...text.matchAll(/^id: (EVT-\d+)$/gm)].map((m) => m[1])).toEqual(last.slice(1).map((e) => e.id));
  });
});
