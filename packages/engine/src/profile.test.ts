import { describe, expect, it } from 'vitest';
import { checkProfile, profileEntry, profileNumber, profileValue } from './profile.ts';
import type { CountryProfile } from './profile.ts';
import { deserializeWorld, serializeWorld, stateHash } from './serialize.ts';
import { testConfig } from './testing.ts';
import { createWorld } from './world.ts';

const profile: CountryProfile = {
  id: 'TEST',
  country: 'CO',
  currency: { code: 'COP', minorUnit: 1 },
  entries: [
    { key: 'labor.maxWeeklyHours', value: 46, validFrom: '2024-07-15', source: 'Ley 2101 de 2021', status: 'oficial' },
    { key: 'labor.maxWeeklyHours', value: 44, validFrom: '2025-07-15', source: 'Ley 2101 de 2021', status: 'oficial' },
    { key: 'labor.maxWeeklyHours', value: 42, validFrom: '2026-07-15', source: 'Ley 2101 de 2021', status: 'oficial' },
    { key: 'labor.informality', value: 0.545, validFrom: '2026-07-01', source: 'GEIH', status: 'oficial' },
    {
      key: 'labor.informality',
      value: 0.825,
      validFrom: '2026-07-01',
      source: 'GEIH',
      status: 'oficial',
      scope: 'rural_disperso',
    },
    { key: 'household.weights', value: { single: 0.2 }, validFrom: '2025-01-01', source: 'ECV', status: 'estimado' },
  ],
};

describe('perfil de país (spec 029)', () => {
  it('rige la entrada con la vigencia más reciente que no supera la fecha', () => {
    expect(profileNumber(profile, 'labor.maxWeeklyHours', '2026-07-14')).toBe(44);
    expect(profileNumber(profile, 'labor.maxWeeklyHours', '2026-07-15')).toBe(42);
    expect(profileNumber(profile, 'labor.maxWeeklyHours', '2030-01-01')).toBe(42);
    expect(profileEntry(profile, 'labor.maxWeeklyHours', '2024-01-01')).toBeUndefined();
  });

  it('busca primero el alcance pedido y, si no hay, el nacional', () => {
    expect(profileValue(profile, 'labor.informality', '2026-08-01', 'rural_disperso')).toBe(0.825);
    expect(profileValue(profile, 'labor.informality', '2026-08-01', 'cabecera')).toBe(0.545);
    expect(profileValue(profile, 'labor.informality', '2026-08-01')).toBe(0.545);
  });

  it('lanza si falta una cifra o si no es del tipo pedido', () => {
    expect(() => profileValue(profile, 'no.existe', '2026-01-01')).toThrow(/no tiene «no.existe»/);
    expect(() => profileNumber(profile, 'household.weights', '2026-01-01')).toThrow(/no es un número/);
    expect(() => profileValue(profile, 'labor.informality', '2026-13-01')).toThrow(/inexistente/);
  });

  it('INV-001 e INV-002: fuente, vigencia válida y sin duplicados por clave, alcance y fecha', () => {
    expect(checkProfile(profile)).toBeNull();
    const e0 = profile.entries[0]!;
    expect(checkProfile({ ...profile, entries: [...profile.entries, { ...e0 }] })).toMatch(/misma vigencia/);
    expect(checkProfile({ ...profile, entries: [{ ...e0, source: ' ' }] })).toMatch(/sin fuente/);
    expect(checkProfile({ ...profile, entries: [{ ...e0, validFrom: '2026-7-1' }] })).toMatch(/validFrom/);
  });
});

describe('WorldConfig con perfil y catálogos (029, ADR-006 §4)', () => {
  const catalogs = { place_kinds: { version: '2026.09.1', hash: '0123456789abcdef' } };

  it('se valida al crear el mundo y entra en el hash; sobrevive a serializar y cargar', () => {
    const a = createWorld(testConfig({ profile, catalogs })).world;
    const b = createWorld(testConfig()).world;
    expect(stateHash(a)).not.toBe(stateHash(b));
    expect(stateHash(deserializeWorld(serializeWorld(a)))).toBe(stateHash(a));
    expect(Object.isFrozen(a.config.profile!.entries[0])).toBe(true);
  });

  it('rechaza un perfil inválido, otra moneda o una referencia de catálogo mal formada', () => {
    const e0 = profile.entries[0]!;
    expect(() => createWorld(testConfig({ profile: { ...profile, entries: [{ ...e0, source: '' }] } }))).toThrow(
      /sin fuente/,
    );
    expect(() => createWorld(testConfig({ profile: { ...profile, currency: { code: 'USD', minorUnit: 1 } } }))).toThrow(
      /moneda/,
    );
    expect(() => createWorld(testConfig({ catalogs: { x: { version: '1', hash: 'nope' } } }))).toThrow(/catalogs.x/);
  });
});
