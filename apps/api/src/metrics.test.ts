// Métricas del mundo y exportación (spec 022 R-010, R-011; CA-007, CA-008).
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDb, openReadonly } from '@datas-world/persistence';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { metricsFrom } from './metrics.ts';
import { buildApi } from './server.ts';
import type { Api } from './server.ts';

const row = (day: number, mood: number, stress = 0.3, money = 100) => ({ day, mood, stress, money });

describe('022 R-010: métricas por día y alertas', () => {
  it('CA-007: una fila por día con sus medias y su desviación; un ánimo igual en todos levanta la alerta', () => {
    const m = metricsFrom([row(0, 0.4), row(0, 0.6), row(1, 0.5, 0.2), row(1, 0.5, 0.4)], [{ day: 0, type: 'ARGUMENT', n: 2 }, { day: 1, type: 'ARGUMENT', n: 1 }], (d) => `2027-01-0${d + 1}`);
    expect(m.days.map((d) => [d.day, d.mood, d.moodSd])).toEqual([[0, 0.5, 0.1], [1, 0.5, 0]]);
    expect(m.events.ARGUMENT).toEqual([2, 1]);
    expect(m.alerts.map((a) => a.kind)).toEqual(['sin_variacion']);
    expect(m.alerts[0]!.metric).toBe('animo');
  });

  it('una serie que sube 30 días seguidos y la saturación en 0 o 1 también avisan', () => {
    const rows = Array.from({ length: 32 }, (_, d) => [row(d, 0.99, 0.5, 100 + d), row(d, 1, 0.6, 100 + d)]).flat();
    const kinds = metricsFrom(rows, [], String).alerts.map((a) => `${a.metric}:${a.kind}`);
    expect(kinds).toContain('dinero:crecimiento');
    expect(kinds).toContain('animo_estres:saturacion');
  });
});

describe('022 R-011: exportación CSV', () => {
  const M2 = join(import.meta.dirname, '..', '..', '..', 'docs', 'validaciones', 'mundos', 'm2-482917.db');
  let dir: string;
  let api: Api;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'api-csv-'));
    copyFileSync(M2, join(dir, 'w.db'));
    api = buildApi({ db: join(dir, 'w.db'), clock: () => '2026-09-29T12:00:00Z' });
  });
  afterAll(async () => {
    await api.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('CA-008: el CSV de eventos tiene una fila por evento de la base; el de la trayectoria, su cabecera', async () => {
    const h = openReadonly(join(dir, 'w.db'));
    const n = (h.prepare('SELECT COUNT(*) AS n FROM events').get() as { n: number }).n;
    closeDb(h);
    const ev = await api.app.inject({ url: '/api/export/events.csv' });
    expect(ev.headers['content-type']).toContain('text/csv');
    const lines = ev.body.trimEnd().split('\n');
    expect(lines[0]).toBe('id,type,at,participants,payload,causes');
    // Una fila por evento: cada línea de datos empieza por un id (el JSON no tiene saltos de línea).
    expect(lines.slice(1).filter((l) => /^EVT-\d+,/.test(l)).length).toBe(n);
    const tr = await api.app.inject({ url: '/api/export/trajectory.csv' });
    expect(tr.body.split('\n')[0]).toBe('citizen_id,day,mood,stress,money,sleep_debt');
    const m = (await api.app.inject({ url: '/api/metrics' })).json() as { days: unknown[]; events: Record<string, number[]> };
    expect(Array.isArray(m.days)).toBe(true);
  });
});
