import { FORBIDDEN_TERMS, addCitizen, createRng, createWorld, idNumber, isMechanism, stateHash } from '@datas-world/engine';
import type { EntityId, World, WorldConfig } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { loadCatalog } from '../catalogs/load.ts';
import type { Catalog } from '../catalogs/schema.ts';
import { checkTemperamentCatalog, definePersonalityColumns, generatePersonality, generateTemperament } from './generate.ts';
import type { TemperamentAttrs } from './generate.ts';

const traits = loadCatalog('personality_traits');
const temperament = loadCatalog('temperament_params');
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

function population(n: number, seed = 482917, traitCat: Catalog = traits, tempCat: Catalog = temperament) {
  const { world } = createWorld({ ...config, seed });
  definePersonalityColumns(world, traitCat, tempCat);
  const rng = createRng(seed);
  const ids: EntityId[] = [];
  let extremes = 0;
  for (let i = 0; i < n; i++) {
    const id = addCitizen(world);
    ids.push(id);
    if (generatePersonality(world, id, traitCat, params, rng.fork('gen:personality')).extremeTrait) extremes++;
    generateTemperament(world, id, tempCat, rng.fork('gen:temperament'));
  }
  return { world, ids, extremes };
}

const column = (world: World, ids: EntityId[], col: string) => ids.map((id) => world.components.f32[col]![idNumber(id)]!);
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
const temps = temperament.entries.map((e) => ({ key: e.key, name: e.name, a: e.attrs as unknown as TemperamentAttrs }));
const clone = (c: Catalog): Catalog => JSON.parse(JSON.stringify(c)) as Catalog;

describe('spec 009 v1.0: temperamento y predisposiciones', () => {
  const { world, ids, extremes } = population(500);

  it('CA-A: ningún parámetro nombra una conducta ni un patrón clínico; todos declaran mecanismos registrados', () => {
    for (const { key, name, a } of temps) {
      const text = `${key} ${name} ${a.column}`.toLowerCase();
      for (const t of FORBIDDEN_TERMS) expect(text.includes(t), `${key}: ${t}`).toBe(false);
      expect(a.modula.length, key).toBeGreaterThan(0);
      for (const m of a.modula) expect(isMechanism(m), `${key}: ${m}`).toBe(true);
    }
    // La comprobación rechaza un catálogo que nombra una conducta, que no declara mecanismo o que cita uno desconocido.
    const bad = clone(temperament);
    bad.entries[0]!.name = 'Tendencia a la evitación';
    expect(() => checkTemperamentCatalog(bad, traits)).toThrow(/evitac/);
    const noMech = clone(temperament);
    (noMech.entries[0]!.attrs as unknown as TemperamentAttrs).modula = [];
    expect(() => checkTemperamentCatalog(noMech, traits)).toThrow(/sin mecanismo/);
    const unknown = clone(temperament);
    (unknown.entries[0]!.attrs as unknown as TemperamentAttrs).modula = ['conducta.elegir_lo_inmediato'];
    expect(() => checkTemperamentCatalog(unknown, traits)).toThrow(/no registrado/);
  });

  it('CA-C: descriptores con media 0,5 ± 0,05 y desviación 0,17 ± 0,03; entre el 15 % y el 30 % con alguno extremo; sin correlaciones espurias', () => {
    expect(traitCols).toEqual(['pers.agreeableness', 'pers.conscientiousness', 'pers.extraversion', 'pers.neuroticism', 'pers.openness']);
    for (const col of traitCols) {
      const xs = column(world, ids, col);
      expect(Math.abs(mean(xs) - 0.5), col).toBeLessThanOrEqual(0.05);
      expect(Math.abs(sd(xs) - 0.17), col).toBeLessThanOrEqual(0.03);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(0.03 - 1e-6);
      expect(Math.max(...xs)).toBeLessThanOrEqual(0.97 + 1e-6);
    }
    expect(extremes / ids.length).toBeGreaterThanOrEqual(0.15);
    expect(extremes / ids.length).toBeLessThanOrEqual(0.3);
    for (let i = 0; i < traitCols.length; i++)
      for (let j = i + 1; j < traitCols.length; j++)
        expect(Math.abs(corr(column(world, ids, traitCols[i]!), column(world, ids, traitCols[j]!))), `${traitCols[i]}~${traitCols[j]}`).toBeLessThanOrEqual(0.15);
  });

  it('CA-C: una correlación configurada de −0,4 se mide en [−0,5, −0,3] (sin el paso de extremos, que la atenúa)', () => {
    const t = clone(traits);
    (t.entries.find((e) => e.key === 'big5.openness')!.attrs as { correlations?: Record<string, number> }).correlations = { 'big5.neuroticism': -0.4 };
    const r = (extremeP: number) => {
      const { world: w } = createWorld({ ...config });
      definePersonalityColumns(w, t, temperament);
      const rng = createRng(482917).fork('gen:personality');
      const xs: EntityId[] = [];
      for (let i = 0; i < 500; i++) {
        const id = addCitizen(w);
        xs.push(id);
        generatePersonality(w, id, t, { traitSd: 0.17, extremeP }, rng);
      }
      return corr(column(w, xs, 'pers.openness'), column(w, xs, 'pers.neuroticism'));
    };
    expect(r(0)).toBeGreaterThanOrEqual(-0.5);
    expect(r(0)).toBeLessThanOrEqual(-0.3);
    // Con 5 descriptores y EXTREME_P = 0,22, los extremos (atípicos sin correlación) la atenúan ≈ 30 %.
    expect(r(0.22)).toBeLessThan(-0.15);
    expect(r(0.22)).toBeGreaterThan(r(0));
  });

  it('CA-C: cada parámetro está en [0,02, 0,98], varía entre personas y se correlaciona con sus descriptores en el signo del mapeo', () => {
    for (const { key, a } of temps) {
      const xs = column(world, ids, a.column);
      expect(Math.min(...xs), key).toBeGreaterThanOrEqual(0.02 - 1e-6);
      expect(Math.max(...xs), key).toBeLessThanOrEqual(0.98 + 1e-6);
      expect(sd(xs), key).toBeGreaterThan(0.05);
      for (const [col, w] of Object.entries(a.mapping))
        if (Math.abs(w) >= 0.3) expect(Math.sign(corr(xs, column(world, ids, col))), `${key}~${col}`).toBe(Math.sign(w));
    }
  });

  it('CA-D: el temperamento de una persona no cambia si se generan más personas ni si se añade un parámetro al final del catálogo', () => {
    const small = population(10);
    for (const col of [...traitCols, ...temps.map((t) => t.a.column)])
      expect(column(small.world, small.ids, col)).toEqual(column(world, ids.slice(0, 10), col));
    const extended = clone(temperament);
    extended.entries.push({ key: 'tmp.zz_prueba', name: 'Parámetro de prueba', since: 'M1', attrs: { ...temps[0]!.a, column: 'tmp.zzPrueba' } as unknown as Record<string, unknown> });
    const p = population(10, 482917, traits, extended);
    for (const { a } of temps) expect(column(p.world, p.ids, a.column)).toEqual(column(world, ids.slice(0, 10), a.column));
  });

  it('CA-G: cambiar un peso del mapeo cambia ese parámetro y el hash, no los descriptores', () => {
    const changed = clone(temperament);
    const entry = changed.entries.find((e) => e.key === 'tmp.aversive_sensitivity')!;
    (entry.attrs as unknown as TemperamentAttrs).mapping = { 'pers.neuroticism': 0.2 };
    const base = population(50);
    const p = population(50, 482917, traits, changed);
    for (const col of traitCols) expect(column(p.world, p.ids, col)).toEqual(column(base.world, base.ids, col));
    expect(column(p.world, p.ids, 'tmp.aversiveSensitivity')).not.toEqual(column(base.world, base.ids, 'tmp.aversiveSensitivity'));
    expect(column(p.world, p.ids, 'tmp.discount0')).toEqual(column(base.world, base.ids, 'tmp.discount0'));
    expect(stateHash(p.world)).not.toBe(stateHash(base.world));
  });

  it('determinismo: misma semilla, mismo hash; otra semilla, otro temperamento', () => {
    expect(stateHash(population(50).world)).toBe(stateHash(population(50).world));
    const other = population(50, 7);
    expect(column(other.world, other.ids, 'tmp.aversiveSensitivity')).not.toEqual(column(world, ids.slice(0, 50), 'tmp.aversiveSensitivity'));
  });

  it('sin columnas eliminadas (afrontamiento, extras, valores); definir es idempotente; un ciudadano inexistente falla', () => {
    for (const gone of ['pers.coping', 'pers.impulsivity', 'pers.resilience', 'pers.approvalNeed', 'pers.honesty', 'pers.socialSensitivity', 'val.health'])
      expect(gone in world.components.f32 || gone in world.components.u8, gone).toBe(false);
    definePersonalityColumns(world, traits, temperament);
    expect(() => generatePersonality(world, 'CIT-009999', traits, params, createRng(1))).toThrow(/No existe/);
  });
});
