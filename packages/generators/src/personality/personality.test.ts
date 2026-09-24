import { addCitizen, createRng, createWorld, idNumber, stateHash } from '@datas-world/engine';
import type { EntityId, World, WorldConfig } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { loadCatalog } from '../catalogs/load.ts';
import {
  COPING,
  COPING_COLUMN,
  copingFor,
  definePersonalityColumns,
  generatePersonality,
  topValues,
} from './generate.ts';

const traits = loadCatalog('personality_traits');
const values = loadCatalog('personal_values');
const params = { traitSd: 0.17, extremeP: 0.22 };
const config: WorldConfig = {
  name: "Data's World",
  seed: 482917,
  epoch: '2026-01-01T00:00',
  tickMinutes: 5,
  currency: { code: 'COP', minorUnit: 1 },
  population: { target: 500 },
  engineVersion: '0.2.0',
  params: {},
  initialCapabilities: ['clock'],
  holidays: [],
};

function population(n: number, seed = 482917) {
  const { world } = createWorld({ ...config, seed });
  definePersonalityColumns(world, traits, values);
  const rng = createRng(seed).fork('gen:personality');
  const ids: EntityId[] = [];
  let extremes = 0;
  for (let i = 0; i < n; i++) {
    const id = addCitizen(world);
    ids.push(id);
    if (generatePersonality(world, id, traits, values, params, rng).extremeTrait) extremes++;
  }
  return { world, ids, extremes };
}

const column = (world: World, ids: EntityId[], col: string) =>
  ids.map((id) => world.components.f32[col]![idNumber(id)]!);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const corr = (a: number[], b: number[]) => {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  a.forEach((x, i) => {
    num += (x - ma) * (b[i]! - mb);
    da += (x - ma) ** 2;
    db += (b[i]! - mb) ** 2;
  });
  return num / Math.sqrt(da * db);
};
const traitCols = traits.entries.map((e) => (e.attrs as { column: string }).column);

describe('spec 009: personalidad', () => {
  const { world, ids, extremes } = population(500);

  it('CA-001: cada rasgo tiene media 0,5 ± 0,05 y desviación 0,17 ± 0,03; entre el 15 % y el 30 % con un rasgo extremo', () => {
    for (const col of traitCols) {
      const xs = column(world, ids, col);
      expect(Math.abs(mean(xs) - 0.5), col).toBeLessThanOrEqual(0.05);
      expect(Math.abs(sd(xs) - 0.17), col).toBeLessThanOrEqual(0.03);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(0.03 - 1e-6);
      expect(Math.max(...xs)).toBeLessThanOrEqual(0.97 + 1e-6);
    }
    expect(extremes / ids.length).toBeGreaterThanOrEqual(0.15);
    expect(extremes / ids.length).toBeLessThanOrEqual(0.3);
  });

  it('CA-002: resiliencia ↔ neuroticismo en [−0,5, −0,3]; las demás parejas en [−0,15, 0,15]', () => {
    const cols = Object.fromEntries(traitCols.map((c) => [c, column(world, ids, c)]));
    expect(corr(cols['pers.resilience']!, cols['pers.neuroticism']!)).toBeGreaterThanOrEqual(-0.5);
    expect(corr(cols['pers.resilience']!, cols['pers.neuroticism']!)).toBeLessThanOrEqual(-0.3);
    for (let i = 0; i < traitCols.length; i++) {
      for (let j = i + 1; j < traitCols.length; j++) {
        const pair = [traitCols[i]!, traitCols[j]!].sort().join('~');
        if (pair === 'pers.neuroticism~pers.resilience') continue;
        const r = corr(cols[traitCols[i]!]!, cols[traitCols[j]!]!);
        expect(Math.abs(r), pair).toBeLessThanOrEqual(0.15);
      }
    }
  });

  it('CA-003: la personalidad de una persona no cambia si se generan más personas', () => {
    const small = population(10);
    const all = [...traitCols, ...values.entries.map((e) => (e.attrs as { column: string }).column)];
    for (const col of all) {
      expect(column(small.world, small.ids, col)).toEqual(column(world, ids.slice(0, 10), col));
    }
  });

  it('R-002: los valores están en [0,1]; los tres principales se ordenan con desempate por catálogo', () => {
    for (const e of values.entries) {
      const xs = column(world, ids, (e.attrs as { column: string }).column);
      expect(Math.min(...xs) >= 0 && Math.max(...xs) <= 1).toBe(true);
      expect(Math.abs(mean(xs) - 0.5)).toBeLessThanOrEqual(0.06);
    }
    const top = topValues(world, ids[0]!, values);
    expect(top).toHaveLength(3);
    const v = (k: string) =>
      world.components.f32[(values.entries.find((e) => e.key === k)!.attrs as { column: string }).column]![
        idNumber(ids[0]!)
      ]!;
    expect(v(top[0]!)).toBeGreaterThanOrEqual(v(top[1]!));
    expect(v(top[1]!)).toBeGreaterThanOrEqual(v(top[2]!));
  });

  it('R-003: el afrontamiento se deriva de los rasgos por prioridad', () => {
    expect(copingFor(0.7, 0.2, 0.9)).toBe(COPING.rumination);
    expect(copingFor(0.5, 0.3, 0.9)).toBe(COPING.avoidant);
    expect(copingFor(0.5, 0.5, 0.7)).toBe(COPING.social_support);
    expect(copingFor(0.5, 0.5, 0.5)).toBe(COPING.problem_focused);
    const f32 = world.components.f32;
    for (const id of ids) {
      const i = idNumber(id);
      const expected = copingFor(
        f32['pers.neuroticism']![i]!,
        f32['pers.conscientiousness']![i]!,
        f32['pers.extraversion']![i]!,
      );
      expect(world.components.u8[COPING_COLUMN]![i]).toBe(expected);
    }
  });

  it('determinismo: misma semilla, mismo hash; otra semilla, otra personalidad', () => {
    expect(stateHash(population(50).world)).toBe(stateHash(population(50).world));
    const other = population(50, 7);
    expect(column(other.world, other.ids, 'pers.openness')).not.toEqual(
      column(world, ids.slice(0, 50), 'pers.openness'),
    );
  });

  it('las columnas se definen una vez; un ciudadano inexistente falla', () => {
    definePersonalityColumns(world, traits, values); // idempotente
    expect(() => generatePersonality(world, 'CIT-009999', traits, values, params, createRng(1))).toThrow(/No existe/);
  });
});
