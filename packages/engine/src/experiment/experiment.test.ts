// Spec 028: validación de la definición, comparación pareada (R-008) y desactivar capacidades (R-004).
import { describe, expect, it } from 'vitest';
import { canDisable, withoutCapability } from '../capabilities.ts';
import type { Capability } from '../capabilities.ts';
import { createRng } from '../rng.ts';
import { pairedContrast } from './compare.ts';
import { EventCounter, Rolling, eventTypesOf } from './metrics.ts';
import { parseExperiment } from './types.ts';

const ok = { id: 'e1', base: { db: 'data/world.db' }, arms: [{ name: 'control' }, { name: 'b', interventions: [{ afterDays: 1, kind: 'force_job_loss', target: 'CIT-000019' }] }] };

describe('028: definición del experimento', () => {
  it('completa los valores por defecto (§8) y el primer brazo es el control', () => {
    const e = parseExperiment(ok);
    expect(e.durationDays).toBe(90);
    expect(e.seeds).toEqual([1, 2, 3, 4, 5]);
    expect(e.sampleEveryDays).toBe(7);
    expect(e.subjects).toEqual({ sample: 50 });
    expect(e.metrics).toEqual(['mood', 'stress', 'money', 'employed']);
    expect(e.arms[0]!.name).toBe('control');
  });

  it('rechaza lo inválido con el motivo', () => {
    const bad = (patch: Record<string, unknown>) => () => parseExperiment({ ...ok, ...patch });
    expect(bad({ arms: [{ name: 'solo' }] })).toThrow(/entre 2 y 10/);
    expect(bad({ arms: [{ name: 'a' }, { name: 'a' }] })).toThrow(/distinto/);
    expect(bad({ seeds: [1, 1] })).toThrow(/sin repetir/);
    expect(bad({ durationDays: 9999 })).toThrow(/durationDays/);
    expect(bad({ metrics: ['felicidad'] })).toThrow(/métrica desconocida/);
    expect(bad({ arms: [{ name: 'a' }, { name: 'b', interventions: [{ kind: 'grant_money', target: 'CIT-000001', params: { amount: 0 } }] }] })).toThrow(/amount/);
    expect(bad({ arms: [{ name: 'a' }, { name: 'b', interventions: [{ kind: 'explotar', target: 'CIT-000001' }] }] })).toThrow(/desconocida/);
    expect(bad({ arms: [{ name: 'a' }, { name: 'b', capabilities: { disable: ['magia'] } }] })).toThrow(/capacidad desconocida/);
    expect(bad({ arms: [{ name: 'a' }, { name: 'b', interventions: [{ kind: 'force_job_loss' }] }] })).toThrow(/target/);
  });
});

describe('028 R-008: comparación pareada', () => {
  const pairs = Array.from({ length: 40 }, (_, i) => ({ control: 0.5 + (i % 5) * 0.02, arm: 0.4 + (i % 5) * 0.02 + (i % 3) * 0.01 }));

  it('media, desviación, tamaño del efecto e intervalo; la media cae dentro del intervalo', () => {
    const c = pairedContrast(pairs, createRng(7).fork('experiment:bootstrap'))!;
    expect(c.n).toBe(40);
    expect(c.meanDiff).toBeLessThan(-0.05);
    expect(c.meanDiff).toBeGreaterThan(c.ci95[0]);
    expect(c.meanDiff).toBeLessThan(c.ci95[1]);
    expect(c.ci95[1]).toBeLessThan(0);
    expect(c.dz).toBeLessThan(-1);
  });

  it('es determinista con el mismo flujo y cambia con otro; sin pares no hay contraste; con diferencias iguales no hay dz', () => {
    const a = pairedContrast(pairs, createRng(7).fork('experiment:bootstrap'));
    expect(pairedContrast(pairs, createRng(7).fork('experiment:bootstrap'))).toEqual(a);
    expect(pairedContrast(pairs, createRng(8).fork('experiment:bootstrap'))).not.toEqual(a);
    expect(pairedContrast([], createRng(1))).toBeNull();
    expect(pairedContrast([{ control: 1, arm: 2 }, { control: 3, arm: 4 }], createRng(1))!.dz).toBeNull();
  });
});

describe('028 R-004: desactivar capacidades', () => {
  const all: Capability[] = ['clock', 'needs', 'routines', 'relationships', 'memory', 'consolidation'];
  it('se puede quitar una hoja; no una de la que otra depende ni una inactiva', () => {
    expect(canDisable(all, 'consolidation')).toBeNull();
    expect(canDisable(all, 'memory')).toMatch(/consolidation depende/);
    expect(canDisable(all, 'llm')).toMatch(/no está activa/);
    expect(withoutCapability(all, 'consolidation')).toEqual(['clock', 'needs', 'routines', 'relationships', 'memory']);
  });
});

describe('028 R-006, R-007: métricas y colector', () => {
  it('el colector cuenta solo los tipos pedidos y los eventos se descartan; la media móvil usa 7 días', () => {
    expect(eventTypesOf(['mood', 'events:JOB_LOST', 'pnr_episodes'])).toEqual(['JOB_LOST', 'PNR_EPISODE']);
    const c = new EventCounter(['JOB_LOST']);
    const ev = (type: string, id: string) => ({ type, payload: { citizenId: id }, participants: [] }) as never;
    c.add([ev('JOB_LOST', 'CIT-000001'), ev('JOB_LOST', 'CIT-000001'), ev('FELL_ILL', 'CIT-000001')]);
    expect(c.count('CIT-000001' as never, 'JOB_LOST')).toBe(2);
    expect(c.count('CIT-000001' as never, 'FELL_ILL')).toBe(0);
    const r = new Rolling();
    for (let i = 1; i <= 10; i++) r.push('CIT-000001' as never, i);
    expect(r.mean('CIT-000001' as never, 0)).toBe((4 + 5 + 6 + 7 + 8 + 9 + 10) / 7);
  });
});
