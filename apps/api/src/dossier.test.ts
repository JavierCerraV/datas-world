// Expediente y demografía del Visor A+ (spec 022 v0.5: R-015, R-016; CA-012, CA-013), sobre una copia del mundo de M2.
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MINUTES_PER_DAY, idNumber } from '@datas-world/engine';
import type { EntityId } from '@datas-world/engine';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Demographics } from './demographics.ts';
import { NOW_KINDS, nowKindOf } from './demographics.ts';
import type { Dossier } from './dossier.ts';
import { freeWindow } from './dossier.ts';
import { buildApi } from './server.ts';
import type { Api } from './server.ts';
import { living } from './views.ts';

const M2 = join(import.meta.dirname, '..', '..', '..', 'docs', 'validaciones', 'mundos', 'm2-482917.db');
let dir: string;
let api: Api;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'api-dos-'));
  const db = join(dir, 'w.db');
  copyFileSync(M2, db);
  api = buildApi({ db, clock: () => '2026-09-30T12:00:00Z' });
});
afterAll(async () => {
  await api.close();
  rmSync(dir, { recursive: true, force: true });
});

const get = async <T>(url: string) => (await api.app.inject({ url })).json() as T;

describe('022 R-015: expediente', () => {
  it('CA-012: coincide con el estado guardado y sus eventos, con la historia de origen marcada, y la agenda cubre 24 h', async () => {
    const w = api.reader.world;
    // Una persona adulta con historia de origen y trabajo formal.
    const c = living(w).find((x) => x.occupation?.kind === 'formal' && x.motherId)!;
    const d = await get<Dossier>(`/api/citizens/${c.id}/dossier`);
    expect(d.id).toBe(c.id);
    const birth = w.components.i32['demo.birthMinute']![idNumber(c.id)]!;
    expect(d.identity.birthDate.slice(0, 4)).toBe(String(new Date(Date.UTC(2026, 0, 1) + birth * 60_000).getUTCFullYear()));
    expect(d.identity.education).toBeTruthy();
    expect(d.identity.household?.id).toBe(c.householdId);
    // Eventos: todos en orden, la historia de origen (antes del minuto 0) marcada como tal.
    expect(d.events.length).toBe(d.counts.events);
    expect(d.events.some((e) => e.origin)).toBe(true);
    for (const e of d.events) expect(e.origin).toBe(e.at < 0);
    for (let k = 1; k < d.events.length; k++) expect(d.events[k]!.at).toBeGreaterThanOrEqual(d.events[k - 1]!.at);
    // Agenda: bloques contiguos de 0 a 24 h.
    const b = d.agenda.blocks;
    expect(b[0]!.from).toBe(0);
    expect(b.at(-1)!.to).toBe(MINUTES_PER_DAY);
    for (let k = 1; k < b.length; k++) expect(b[k]!.from).toBe(b[k - 1]!.to);
    expect(b.some((x) => x.kind === 'dormir')).toBe(true);
    expect(b.some((x) => x.kind === 'trabajo')).toBe(true);
    // Familia: la madre aparece con su parentesco; los objetos son suyos o de su hogar.
    expect(d.family.find((f) => f.id === c.motherId)?.relation).toBe('madre');
    for (const o of d.objects) expect(['persona', 'hogar']).toContain(o.owner);
    expect(d.counts.functions).toBe(c.functions?.f.length ?? 0);
    expect((await api.app.inject({ url: '/api/citizens/CIT-999999/dossier' })).statusCode).toBe(404);
  });

  it('freeWindow da el tramo libre siguiente, o nada si no queda', () => {
    const blocks = [
      { from: 0, to: 360, kind: 'dormir' as const, activity: 'sleep' },
      { from: 360, to: 1020, kind: 'trabajo' as const, activity: 'work' },
      { from: 1020, to: 1140, kind: 'libre' as const, activity: 'leisure' },
      { from: 1140, to: 1200, kind: 'cuidado' as const, activity: 'eat' },
      { from: 1200, to: 1440, kind: 'dormir' as const, activity: 'sleep' },
    ];
    expect(freeWindow(blocks, 600)).toEqual({ from: '17:00', to: '19:00' });
    expect(freeWindow(blocks, 1050)).toEqual({ from: '17:30', to: '19:00' });
    expect(freeWindow(blocks, 1300)).toBeNull();
  });
});

describe('022 R-016: demografía', () => {
  it('CA-013: pirámide y ocupación suman la población; el periodo cambia nacidos y fallecidos', async () => {
    const w = api.reader.world;
    const year = await get<Demographics>('/api/demographics?period=year');
    const all = await get<Demographics>('/api/demographics?period=all');
    expect(year.population).toBe(living(w).length);
    expect(year.pyramid.reduce((s, g) => s + g.F + g.M, 0)).toBe(year.population);
    expect(year.women + year.men).toBe(year.population);
    expect(year.occupations.reduce((s, o) => s + o.count, 0)).toBe(year.population);
    expect(year.now.reduce((s, k) => s + k.count, 0)).toBe(year.population);
    expect(all.births.count).toBeGreaterThan(year.births.count);
    expect(all.deaths.count).toBeGreaterThan(year.deaths.count);
    expect(year.households.count).toBeGreaterThan(0);
    expect(year.organizations).toBeGreaterThan(0);
    expect((await api.app.inject({ url: '/api/demographics?period=siglo' })).statusCode).toBe(400);
  });

  it('CA-014 (v0.6): los histogramas suman la población, el Gini está en [0,1] y la red no repite aristas', async () => {
    const w = api.reader.world;
    const g = await get<Demographics & { mood: number[]; stress: number[]; money: { bins: { count: number }[]; gini: number; median: number }; householdSizes: { count: number }[] }>('/api/demographics');
    const n = living(w).length;
    const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);
    expect(sum(g.mood)).toBe(n);
    expect(sum(g.stress)).toBe(n);
    expect(sum(g.money.bins.map((b) => b.count))).toBe(n);
    expect(g.money.gini).toBeGreaterThanOrEqual(0);
    expect(g.money.gini).toBeLessThanOrEqual(1);
    expect(sum(g.householdSizes.map((h) => h.count))).toBe(g.households.count);
    const net = await get<{ nodes: { id: string }[]; edges: { a: string; b: string; kind: string }[] }>('/api/network');
    expect(net.nodes.length).toBe(n);
    const ids = new Set(net.nodes.map((x) => x.id));
    const keys = new Set<string>();
    for (const e of net.edges) {
      expect(ids.has(e.a) && ids.has(e.b)).toBe(true);
      expect(e.a < e.b).toBe(true);
      expect(keys.has(`${e.a}|${e.b}`)).toBe(false);
      keys.add(`${e.a}|${e.b}`);
    }
    expect(net.edges.some((e) => e.kind === 'pareja')).toBe(true);
  });

  it('024 CA-016: cada persona cae en una sola categoría de «Ahora»', () => {
    const w = api.reader.world;
    for (const c of living(w)) expect(NOW_KINDS).toContain(nowKindOf(w, c.id as EntityId));
  });
});
