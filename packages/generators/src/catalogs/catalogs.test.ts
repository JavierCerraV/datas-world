import { describe, expect, it } from 'vitest';
import {
  CATALOG_NAMES,
  catalogEntry,
  catalogRef,
  catalogRefs,
  entriesSince,
  loadCatalogs,
  parseCatalog,
} from './load.ts';

const catalogs = loadCatalogs();

describe('catálogos (ADR-006)', () => {
  it('todos cargan, validan y declaran su nombre', () => {
    for (const n of CATALOG_NAMES) {
      expect(catalogs[n].name).toBe(n);
      expect(catalogs[n].entries.length).toBeGreaterThan(0);
    }
  });

  it('la referencia (versión + hash) es estable y cambia si cambia el contenido', () => {
    const a = catalogRefs(catalogs);
    expect(catalogRefs(loadCatalogs())).toEqual(a);
    const c = catalogs.object_kinds;
    const changed = { ...c, entries: c.entries.map((e, i) => (i === 0 ? { ...e, name: e.name + ' ' } : e)) };
    expect(catalogRef(changed).hash).not.toBe(a.object_kinds!.hash);
    expect(a.place_kinds!.hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('place_kinds tiene todo lo esencial de M1 (004 CA-001) y las entradas futuras previstas', () => {
    const m1 = entriesSince(catalogs.place_kinds, 'M1').map((e) => e.key);
    for (const k of [
      'vivienda.edificio',
      'vivienda.unidad',
      'servicios.oficina',
      'industria.fabrica',
      'educacion.colegio',
      'salud.hospital',
      'comercio.tienda_barrio',
      'espacio_publico.parque',
      'religioso.iglesia',
      'territorio.barrio',
    ]) {
      expect(m1).toContain(k);
    }
    expect(m1).not.toContain('finanzas.cajero_automatico');
    expect(catalogEntry(catalogs.place_kinds, 'finanzas.cajero_automatico').since).toBe('M2');
    expect(catalogEntry(catalogs.place_kinds, 'transporte.aeropuerto').since).toBe('P4');
  });

  it('los turnos colombianos de M1 no superan 42 horas semanales sin contar el almuerzo (004 R-007)', () => {
    const daysPerWeek = { 'mon-fri': 5, 'mon-sat': 6 } as const;
    for (const e of entriesSince(catalogs.place_kinds, 'M1')) {
      const s = e.attrs?.shiftCO as
        { days: keyof typeof daysPerWeek; start: number; end: number; lunch: number } | undefined;
      if (!s) continue;
      const weekly = ((s.end - s.start - s.lunch) * daysPerWeek[s.days]) / 60;
      expect(weekly, e.key).toBeLessThanOrEqual(42);
    }
  });

  it('los códigos oficiales tienen el formato de su clasificación', () => {
    for (const e of catalogs.org_sectors.entries) expect(e.code, e.key).toMatch(/^\d{4}$/);
    for (const e of catalogs.occupations.entries) expect(e.code, e.key).toMatch(/^\d{4}$/);
    for (const e of catalogs.trades_informal.entries) catalogEntry(catalogs.occupations, e.attrs!.occupation as string);
    const cols = catalogs.education_levels.entries.map((e) => e.attrs!.column);
    expect(cols).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('cada lugar de M1 con sector apunta a un código CIIU del catálogo de sectores', () => {
    const codes = new Set(catalogs.org_sectors.entries.map((e) => e.code));
    for (const e of entriesSince(catalogs.place_kinds, 'M1')) if (e.code) expect(codes.has(e.code), e.key).toBe(true);
  });

  it('los hechos históricos tienen fechas válidas y ordenadas (inicio ≤ fin)', () => {
    for (const e of catalogs.historical_events.entries) {
      const { start, end } = e.attrs as { start: string; end: string };
      expect(start, e.key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(start <= end, e.key).toBe(true);
    }
  });

  it('rechaza claves duplicadas, fuera de orden o mal formadas, y campos desconocidos', () => {
    const base = { name: 'x', version: '2026.09.1', source: 's' };
    const e = (key: string) => ({ key, name: 'n', since: 'M1' });
    expect(() => parseCatalog({ ...base, entries: [e('b.a'), e('a.b')] })).toThrow(/fuera de orden/);
    expect(() => parseCatalog({ ...base, entries: [e('a.b'), e('a.b')] })).toThrow(/duplicadas/);
    expect(() => parseCatalog({ ...base, entries: [e('A.b')] })).toThrow(/inválido/);
    expect(() => parseCatalog({ ...base, entries: [{ ...e('a.b'), extra: 1 }] })).toThrow(/inválido/);
    expect(() => parseCatalog({ ...base, entries: [{ ...e('a.b'), since: 'M10' }] })).toThrow(/inválido/);
  });
});
