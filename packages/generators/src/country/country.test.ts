import { profileNumber, profileValue } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { colombianHolidays, easterSunday, holidayDates } from './holidays.ts';
import { DEFAULT_PROFILE, PROTOTYPE_PROFILE, loadProfile, parseProfile, pendingEntries } from './profile.ts';
import { civilFromDays, formatDate } from '@datas-world/engine';

const dates = (y: number) => colombianHolidays(y).map((h) => h.date);

describe('029 CA-001: festivos de Colombia', () => {
  it('2026 coincide con el calendario oficial (19 festivos, con la Virgen de Chiquinquirá el lunes 13 de julio)', () => {
    // Fuentes: calendarios publicados (Computrabajo, El Colombiano) y Ley 2578 de 2026 (traslado al 13 de julio).
    expect(dates(2026)).toEqual([
      '2026-01-01',
      '2026-01-12',
      '2026-03-23',
      '2026-04-02',
      '2026-04-03',
      '2026-05-01',
      '2026-05-18',
      '2026-06-08',
      '2026-06-15',
      '2026-06-29',
      '2026-07-13',
      '2026-07-20',
      '2026-08-07',
      '2026-08-17',
      '2026-10-12',
      '2026-11-02',
      '2026-11-16',
      '2026-12-08',
      '2026-12-25',
    ]);
  });

  it('2027 tiene 19 festivos; coinciden los contrastados con fuentes publicadas', () => {
    const d = dates(2027);
    expect(d).toHaveLength(19);
    // Contrastados: Semana Santa 25–26 de marzo, Ascensión 10 de mayo, Corpus 31 de mayo,
    // Chiquinquirá 12 de julio, Asunción 16 de agosto, Todos los Santos 1 de noviembre, Cartagena 15 de noviembre.
    for (const x of [
      '2027-03-25',
      '2027-03-26',
      '2027-05-10',
      '2027-05-31',
      '2027-07-12',
      '2027-08-16',
      '2027-11-01',
      '2027-11-15',
    ]) {
      expect(d).toContain(x);
    }
    expect(d).toEqual([
      '2027-01-01',
      '2027-01-11',
      '2027-03-22',
      '2027-03-25',
      '2027-03-26',
      '2027-05-01',
      '2027-05-10',
      '2027-05-31',
      '2027-06-07',
      '2027-07-05',
      '2027-07-12',
      '2027-07-20',
      '2027-08-07',
      '2027-08-16',
      '2027-10-18',
      '2027-11-01',
      '2027-11-15',
      '2027-12-08',
      '2027-12-25',
    ]);
  });

  it('la Pascua cae en las fechas conocidas, incluidas la más temprana y la más tardía posibles', () => {
    const easter = (y: number) => formatDate(civilFromDays(easterSunday(y)));
    expect(easter(1900)).toBe('1900-04-15');
    expect(easter(2000)).toBe('2000-04-23');
    expect(easter(2024)).toBe('2024-03-31');
    expect(easter(2025)).toBe('2025-04-20');
    expect(easter(2026)).toBe('2026-04-05');
    expect(easter(2038)).toBe('2038-04-25');
    expect(easter(2285)).toBe('2285-03-22');
  });

  it('antes de 2026 no existe el festivo de Chiquinquirá; antes de 1984 no se calculan festivos', () => {
    expect(colombianHolidays(2025).some((h) => h.key === 'chiquinquira')).toBe(false);
    expect(colombianHolidays(2025)).toHaveLength(18);
    expect(() => colombianHolidays(1983)).toThrow(/1984/);
  });

  it('holidayDates junta varios años sin repetir y en orden', () => {
    const d = holidayDates(2026, 2027);
    expect(d).toHaveLength(38);
    expect([...d].sort()).toEqual(d);
  });
});

describe('perfil colombiano (spec 029)', () => {
  const co = loadProfile(DEFAULT_PROFILE);

  it('CA-002: la jornada máxima es de 44 h el 14-jul-2026 y de 42 h desde el 15-jul-2026', () => {
    expect(profileNumber(co, 'labor.maxWeeklyHours', '2026-07-14')).toBe(44);
    expect(profileNumber(co, 'labor.maxWeeklyHours', '2026-07-15')).toBe(42);
    expect(profileNumber(co, 'labor.maxWeeklyHours', '1990-01-01')).toBe(48);
  });

  it('CA-003: todas las entradas tienen fuente y vigencia válidas; las pendientes se pueden listar', () => {
    expect(co.entries.length).toBeGreaterThan(30);
    expect(pendingEntries(co).map((e) => e.key)).toEqual([
      'demo.lifeTable.byDecade',
      'demo.parentAgeAtBirth.byDecade',
      'demo.urbanization.byDecade',
      'stratum.share',
    ]);
  });

  it('las variaciones territoriales y las leyes escalonadas se resuelven por fecha y alcance', () => {
    expect(profileNumber(co, 'labor.informality', '2026-09-01', 'rural_disperso')).toBe(0.825);
    expect(profileNumber(co, 'labor.informality', '2026-09-01', 'cabecera')).toBe(0.545);
    expect(profileNumber(co, 'labor.minimumWageMonthly', '2026-03-01')).toBe(1_750_905);
    expect(profileNumber(co, 'labor.sundaySurcharge', '2026-06-30')).toBe(0.8);
    expect(profileNumber(co, 'labor.sundaySurcharge', '2026-07-01')).toBe(0.9);
    expect(profileValue(co, 'pension.age', '2010-01-01')).toEqual({ F: 55, M: 60 });
    expect(profileValue(co, 'pension.age', '2026-01-01')).toEqual({ F: 57, M: 62 });
  });

  it('las entradas quedan en orden canónico (clave, alcance, vigencia)', () => {
    const keys = co.entries.map((e) => `${e.key}|${e.scope ?? ''}|${e.validFrom}`);
    expect([...keys].sort()).toEqual(keys);
  });

  it('rechaza un perfil con forma inválida o sin fuente', () => {
    expect(() =>
      parseProfile({ id: 'X', country: 'CO', currency: { code: 'COP', minorUnit: 1 }, entries: [] }),
    ).toThrow(/inválido/);
    const e = { key: 'a.b', value: 1, validFrom: '2026-01-01', source: ' ', status: 'oficial' };
    expect(() =>
      parseProfile({ id: 'X', country: 'CO', currency: { code: 'COP', minorUnit: 1 }, entries: [e] }),
    ).toThrow(/sin fuente/);
    expect(() => loadProfile('../secreto')).toThrow(/inválido/);
  });
});

describe('029 CA-004: el perfil prototipo reproduce los parámetros de paridad', () => {
  it('coincide exactamente con las constantes del prototipo', () => {
    const p = loadProfile(PROTOTYPE_PROFILE);
    const at = '2026-01-01';
    expect(profileValue(p, 'gen.household.templateWeights', at)).toEqual({
      single: 0.18,
      couple: 0.2,
      couple_kids: 0.4,
      extended: 0.1,
      single_parent: 0.12,
      roommates: 0,
    });
    expect(profileNumber(p, 'gen.labor.employmentRate18to64', at)).toBe(0.86);
    expect(profileNumber(p, 'gen.labor.informalShare', at)).toBe(0);
    expect(profileNumber(p, 'gen.jobs.bossWageFactor', at)).toBe(1.6);
    expect(profileNumber(p, 'gen.personality.traitSd', at)).toBe(0.17);
    expect(profileNumber(p, 'gen.personality.extremeP', at)).toBe(0.22);
    expect(profileNumber(p, 'gen.population.target', at)).toBe(60);
    expect(profileValue(p, 'gen.objects.carP', at)).toEqual({ 2: 0, 3: 0, 4: 0 });
  });

  it('los pesos de plantilla de ambos perfiles suman 1', () => {
    for (const id of [DEFAULT_PROFILE, PROTOTYPE_PROFILE]) {
      const w = profileValue(loadProfile(id), 'gen.household.templateWeights', '2026-01-01') as Record<string, number>;
      expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    }
  });
});
