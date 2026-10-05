// Cohorte de la pantalla Mundo (spec 024 CA-019, R-026): tamaño, quién está dentro, histograma y resumen.
import { describe, expect, it } from 'vitest';
import { AGE_BINS, ALL_COHORT, ageHistogram, binInRange, binOf, cohortOf, describe as describeCohort, facets, inCohort, isActive, toggled } from './cohort.ts';
import type { CohortFilter, CohortPerson } from './cohort.ts';

const p = (id: string, age: number, mood: number, occupation: string, stratum: number | null): CohortPerson => ({ id, age, mood, occupation, stratum });
const people: CohortPerson[] = [
  p('CIT-000001', 8, 0.7, 'Menor de edad', 2),
  p('CIT-000002', 34, 0.5, 'Empleo formal', 3),
  p('CIT-000003', 41, 0.4, 'Empleo formal', 4),
  p('CIT-000004', 52, 0.6, 'Independiente', 3),
  p('CIT-000005', 67, 0.3, 'Pensionado', 2),
  p('CIT-000006', 85, 0.8, 'Pensionado', null),
];

describe('024 CA-019: cohorte', () => {
  it('sin criterios no hay cohorte: todos cuentan y nada se atenúa', () => {
    const r = cohortOf(people, ALL_COHORT);
    expect(isActive(ALL_COHORT)).toBe(false);
    expect(r.ids).toBeNull();
    expect([r.count, r.total, r.pct]).toEqual([6, 6, 100]);
  });

  it('filtra por edad, ocupación, estrato y ánimo, y todos los criterios activos deben cumplirse', () => {
    const f: CohortFilter = { ...ALL_COHORT, ageMin: 30, ageMax: 59, occupations: ['Empleo formal'], strata: [3, 4] };
    const r = cohortOf(people, f);
    expect([...r.ids!].sort()).toEqual(['CIT-000002', 'CIT-000003']);
    expect([r.count, r.pct]).toEqual([2, 33]);
    expect([...cohortOf(people, { ...ALL_COHORT, moodMin: 0.6 }).ids!].sort()).toEqual(['CIT-000001', 'CIT-000004', 'CIT-000006']);
  });

  it('lo que se desconoce no cumple un criterio activo, pero no estorba si el criterio no está activo', () => {
    const sinEstrato = p('CIT-000009', 30, 0.5, 'Empleo formal', null);
    expect(inCohort(sinEstrato, { ...ALL_COHORT, strata: [3] })).toBe(false);
    expect(inCohort(sinEstrato, ALL_COHORT)).toBe(true);
    const sinEdad = { id: 'CIT-000010', mood: 0.5 } as CohortPerson;
    expect(inCohort(sinEdad, { ...ALL_COHORT, ageMin: 18 })).toBe(false);
  });

  it('el histograma cuenta por grupos de 10 años, con «70+» al final, y marca los grupos dentro del rango', () => {
    expect(AGE_BINS).toHaveLength(8);
    expect(binOf(0)).toBe(0);
    expect(binOf(69)).toBe(6);
    expect(binOf(85)).toBe(7);
    expect(ageHistogram(people)).toEqual([1, 0, 0, 1, 1, 1, 1, 1]);
    const f = { ...ALL_COHORT, ageMin: 30, ageMax: 59 };
    expect(AGE_BINS.map((_, i) => binInRange(i, f))).toEqual([false, false, false, true, true, true, false, false]);
  });

  it('las facetas cuentan por ocupación (en el orden de la API) y por estrato (en orden)', () => {
    const fx = facets(people);
    expect(fx.occupations[0]).toEqual(['Empleo formal', 2]);
    expect(fx.occupations.map((o) => o[0])).toEqual(['Empleo formal', 'Independiente', 'Menor de edad', 'Pensionado']);
    expect(fx.strata).toEqual([[2, 2], [3, 2], [4, 1]]);
  });

  it('toggled añade y quita sin repetir y en orden', () => {
    expect(toggled([3], 2)).toEqual([2, 3]);
    expect(toggled([2, 3], 3)).toEqual([2]);
    expect(toggled(['b'], 'a')).toEqual(['a', 'b']);
  });

  it('el resumen dice la cohorte en palabras', () => {
    const f: CohortFilter = { ...ALL_COHORT, ageMin: 30, ageMax: 59, occupations: ['Empleo formal'] };
    expect(describeCohort(f, cohortOf(people, f))).toBe('30–59 años · Empleo formal · 2 personas');
    expect(describeCohort(ALL_COHORT, cohortOf(people, ALL_COHORT))).toBe('Toda la población · 6');
  });
});
