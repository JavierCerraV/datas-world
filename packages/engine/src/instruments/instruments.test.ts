import { describe as suite, expect, it } from 'vitest';
// Spec 045: indicadores (R-004), respuesta (R-005), selección (R-007) y estadística (R-009).
import { defineColumn } from '../components.ts';
import type { WorldEvent } from '../events.ts';
import type { EntityId } from '../ids.ts';
import { idNumber } from '../ids.ts';
import { defineNeedsColumns } from '../needs/columns.ts';
import { createRng } from '../rng.ts';
import { stateHash } from '../serialize.ts';
import { testConfig } from '../testing.ts';
import { addCitizen, createWorld } from '../world.ts';
import type { World } from '../world.ts';
import { INDICATORS, indicatorValues } from './indicators.ts';
import { answerInstrument, responseRng, samplingRng } from './respond.ts';
import { ageGroup, candidatesOf, resolveSelection } from './select.ts';
import { cohenD, cronbachAlpha, describeScores, groupStats, pearson } from './stats.ts';
import type { Instrument } from './types.ts';

const DAY = 1440;
const YEAR = 365.25 * DAY;

/** Un mundo con `n` personas: edades 10, 14, …, sexo alterno, ánimo repartido entre 0,15 y 0,75. */
function town(n = 40): World {
  const { world } = createWorld(testConfig());
  defineNeedsColumns(world);
  defineColumn(world.components, 'i32', 'demo.birthMinute', 0);
  world.now = 300 * DAY;
  for (let k = 0; k < n; k++) {
    const id = addCitizen(world);
    const row = idNumber(id);
    const c = world.citizens.get(id)!;
    c.sex = k % 2 ? 'M' : 'F';
    world.components.i32['demo.birthMinute']![row] = Math.round(world.now - (10 + 4 * (k % 20)) * YEAR - DAY);
    world.components.f32['state.mood']![row] = 0.15 + (0.6 * k) / (n - 1);
    world.components.f32['need.energy']![row] = 0.2 + (0.7 * k) / (n - 1);
  }
  return world;
}

/** Un cribado de 3 ítems (0–3) revisado, con puntos de corte. */
const SCREEN: Instrument = {
  id: 'INS-0001', name: 'Cribado de prueba', acronym: 'CP-3', construct: 'síntomas depresivos', instructions: '', recallDays: 14,
  items: [
    { n: 1, text: 'Poco interés', options: [0, 1, 2, 3].map((v) => ({ label: String(v), value: v })), reversed: false, mapping: [{ indicator: 'animo_bajo', weight: 1 }], page: 1 },
    { n: 2, text: 'Cansancio', options: [0, 1, 2, 3].map((v) => ({ label: String(v), value: v })), reversed: false, mapping: [{ indicator: 'energia_baja', weight: 1 }], page: 1 },
    { n: 3, text: 'Apetito', options: [0, 1, 2, 3].map((v) => ({ label: String(v), value: v })), reversed: false, mapping: [], page: 1 },
  ],
  scoring: { method: 'sum' },
  cutoffs: [
    { min: 0, max: 1, label: 'mínima', severity: 0 },
    { min: 2, max: 3, label: 'leve', severity: 1 },
    { min: 4, max: 6, label: 'moderada', severity: 2 },
  ],
  minAge: 18, status: 'revisado', version: 1,
};

const valuesOf = (w: World, id: EntityId, events: WorldEvent[] = []) =>
  indicatorValues({ view: w, id, events, trajectory: [], now: w.now, recallDays: 14 });

suite('045 R-004: indicadores', () => {
  it('todos los indicadores del catálogo están en [0,1], y el ánimo bajo y la energía baja crecen al empeorar el estado', () => {
    const w = town();
    const low = valuesOf(w, 'CIT-000001' as EntityId);
    const high = valuesOf(w, 'CIT-000040' as EntityId);
    for (const k of INDICATORS) {
      expect(low[k]).toBeGreaterThanOrEqual(0);
      expect(low[k]).toBeLessThanOrEqual(1);
    }
    expect(low.animo_bajo).toBeGreaterThan(0.8);
    expect(high.animo_bajo).toBe(0);
    expect(low.energia_baja).toBeGreaterThan(high.energia_baja);
  });

  it('la trayectoria de la ventana manda sobre el estado actual, y los hechos cuentan solo dentro de la ventana', () => {
    const w = town();
    const id = 'CIT-000040' as EntityId;
    const today = Math.floor(w.now / DAY);
    const sad = Array.from({ length: 14 }, (_, k) => ({ day: today - k, mood: 0.2, stress: 0.5, money: 0, sleepDebt: 0 }));
    expect(indicatorValues({ view: w, id, events: [], trajectory: sad, now: w.now, recallDays: 14 }).animo_bajo).toBe(1);
    const pnr = (d: number): WorldEvent => ({
      id: `EVT-${String(d).padStart(11, '0')}` as EntityId, type: 'PNR_EPISODE', at: w.now - d * DAY,
      participants: [{ id, role: 'persona' }], importance: 0.3, payload: {}, causes: [], origin: 'engine',
    }) as WorldEvent;
    const inside = [1, 2, 3, 4, 5, 6, 7].map(pnr);
    const outside = [20, 21, 22].map(pnr);
    expect(valuesOf(w, id, inside).rumiacion).toBe(1);
    expect(valuesOf(w, id, outside).rumiacion).toBe(0);
  });
});

suite('045 R-005: respuesta', () => {
  it('CA-003: misma semilla, mismo minuto → respuestas idénticas; aplicar no cambia el stateHash', () => {
    const w = town();
    const before = stateHash(w);
    const run = () => candidatesOf(w).filter((c) => c.age >= 18).map((c) => answerInstrument(SCREEN, valuesOf(w, c.id), responseRng(createRng(7), 'ADM-0001', c.id)));
    const a = run();
    expect(run()).toEqual(a);
    expect(stateHash(w)).toBe(before);
    // Otra aplicación, otro ruido (pero la misma persona responde parecido).
    const other = candidatesOf(w).filter((c) => c.age >= 18).map((c) => answerInstrument(SCREEN, valuesOf(w, c.id), responseRng(createRng(7), 'ADM-0002', c.id)));
    expect(other.map((r) => r.score)).not.toEqual([]);
  });

  it('cada respuesta guarda su base; el ítem sin correspondencia no puntúa; hay variabilidad y categorías', () => {
    const w = town();
    const rs = candidatesOf(w).filter((c) => c.age >= 18).map((c) => answerInstrument(SCREEN, valuesOf(w, c.id), responseRng(createRng(1), 'ADM-0001', c.id)));
    expect(rs[0]!.answers[2]).toMatchObject({ n: 3, value: null });
    expect(rs[0]!.answers[0]!.basis[0]!.indicator).toBe('animo_bajo');
    expect(new Set(rs.map((r) => r.category)).size).toBeGreaterThan(1);
    expect(rs.some((r) => r.category === 'moderada')).toBe(true);
  });

  it('INV-003: un instrumento sin revisar o con un indicador fuera del catálogo no se aplica', () => {
    const w = town();
    const v = valuesOf(w, 'CIT-000020' as EntityId);
    expect(() => answerInstrument({ ...SCREEN, status: 'extraido' }, v, createRng(1))).toThrow(/no está revisado/);
    const bad = { ...SCREEN, items: [{ ...SCREEN.items[0]!, mapping: [{ indicator: 'apetito', weight: 1 }] }] };
    expect(() => answerInstrument(bad, v, createRng(1))).toThrow(/fuera del catálogo/);
  });

  it('un ítem invertido responde al revés, y la media puntúa como media', () => {
    const w = town();
    const v = valuesOf(w, 'CIT-000001' as EntityId);
    const inv = { ...SCREEN, items: [{ ...SCREEN.items[0]!, reversed: true }], scoring: { method: 'mean' as const } };
    expect(answerInstrument(SCREEN, v, createRng(3)).answers[0]!.value).toBe(3);
    expect(answerInstrument(inv, v, createRng(3)).answers[0]!.value).toBe(0);
  });
});

suite('045 R-007: selección', () => {
  const w = town();
  const people = candidatesOf(w);
  const adults = people.filter((c) => c.age >= 18);

  it('CA-008: «todos» son los vivos con edad ≥ minAge; «individual» excluye al menor con su motivo', () => {
    expect(resolveSelection({ kind: 'todos' }, people, 18, createRng(1)).resolved).toEqual(adults.map((c) => c.id));
    const kid = people.find((c) => c.age < 18)!;
    expect(resolveSelection({ kind: 'individual', citizen: kid.id }, people, 18, createRng(1))).toEqual({ resolved: [], excluded: [{ citizen: kid.id, reason: 'menor' }] });
    expect(resolveSelection({ kind: 'individual', citizen: 'CIT-009999' as EntityId }, people, 18, createRng(1)).excluded[0]!.reason).toBe('no_existe');
  });

  it('CA-008: «al azar» con la misma semilla da la misma lista de n personas; con estratos respeta las proporciones', () => {
    const rng = () => samplingRng(createRng(5), 'ADM-0001');
    const a = resolveSelection({ kind: 'azar', n: 10 }, people, 18, rng());
    expect(a.resolved).toHaveLength(10);
    expect(resolveSelection({ kind: 'azar', n: 10 }, people, 18, rng())).toEqual(a);
    expect(resolveSelection({ kind: 'azar', n: 10 }, people, 18, samplingRng(createRng(6), 'ADM-0001')).resolved).not.toEqual(a.resolved);
    const s = resolveSelection({ kind: 'azar', n: 12, strata: ['sexo'] }, people, 18, rng());
    expect(s.resolved).toHaveLength(12);
    const f = s.resolved.filter((id) => people.find((c) => c.id === id)!.vars.sexo === 'F').length;
    const share = adults.filter((c) => c.vars.sexo === 'F').length / adults.length;
    expect(Math.abs(f - 12 * share)).toBeLessThanOrEqual(1);
  });

  it('CA-008: «seleccionados» desde una muestra resuelve a sus miembros vigentes y excluye al fallecido', () => {
    const dead = adults[0]!.id;
    const list = [adults[2]!.id, adults[1]!.id, dead];
    const withDead = people.map((c) => (c.id === dead ? { ...c, alive: false } : c));
    const r = resolveSelection({ kind: 'seleccionados', citizens: [], from: 'SMP-0001' }, withDead, 18, createRng(1), (id) => (id === 'SMP-0001' ? list : undefined));
    expect(r.resolved).toEqual([adults[1]!.id, adults[2]!.id]);
    expect(r.excluded).toEqual([{ citizen: dead, reason: 'fallecido' }]);
    expect(() => resolveSelection({ kind: 'seleccionados', citizens: [], from: 'SMP-0404' }, people, 18, createRng(1), () => undefined)).toThrow(/No existe/);
  });

  it('grupos de edad de 10 años', () => {
    expect([ageGroup(18), ageGroup(39), ageGroup(85)]).toEqual(['10-19', '30-39', '80+']);
  });
});

suite('045 R-009: estadística', () => {
  it('CA-009: descriptiva igual a un cálculo de referencia', () => {
    expect(describeScores([2, 4, 4, 4, 5, 5, 7, 9])).toEqual({ n: 8, mean: 5, sd: 2.138, min: 2, q1: 4, median: 4.5, q3: 5.5, max: 9 });
    expect(describeScores([]).n).toBe(0);
  });

  it('CA-009: grupos con n, medias, criterio y d; los grupos suman el total', () => {
    const rows = [
      ...[10, 12, 14, 12].map((score) => ({ score, group: 'evento:JOB_LOST' })),
      ...[4, 6, 5, 5, 6, 4].map((score) => ({ score, group: 'sin JOB_LOST' })),
    ];
    const g = groupStats(rows, (s) => s >= 10);
    expect(g.map((x) => x.group)).toEqual(['evento:JOB_LOST', 'sin JOB_LOST']);
    expect(g[0]).toMatchObject({ n: 4, mean: 12, meeting: 4, pct: 100 });
    expect(g[1]).toMatchObject({ n: 6, mean: 5, meeting: 0, pct: 0 });
    expect(g.reduce((s, x) => s + x.n, 0)).toBe(rows.length);
    expect(g[0]!.d).toBe(cohenD([10, 12, 14, 12], [4, 6, 5, 5, 6, 4]));
    expect(g[0]!.d!).toBeGreaterThan(3);
    expect(g[1]!.d).toBe(-g[0]!.d!);
  });

  it('alfa de Cronbach y Pearson', () => {
    // Ítems perfectamente paralelos → alfa 1; ítems independientes → alfa baja.
    expect(cronbachAlpha([[1, 1], [2, 2], [3, 3], [0, 0]])).toBe(1);
    expect(cronbachAlpha([[0, 3], [3, 0], [1, 1], [2, 2]])).toBeLessThan(0.1);
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBe(1);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBe(-1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});
