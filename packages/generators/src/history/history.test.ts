import { idNumber, stateHash } from '@datas-world/engine';
import type { EntityId, World, WorldEvent } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, loadProfile } from '../country/profile.ts';
import { seriesAt } from '../country/series.ts';
import { buildWorld, catalogs } from '../testing.ts';
import { lineageOf } from './genealogy.ts';
import { Clock, historyParams } from './params.ts';

const YEAR = 365 * 1440;
const seeds = (from: number, n = 20) => Array.from({ length: n }, (_, i) => from + i);
const clock = new Clock('2026-01-01T00:00');
const P = historyParams(loadProfile(DEFAULT_PROFILE), '2026-01-01');
const floor = clock.at(P.foundingYear);
const col = (w: World, name: string, id: EntityId) =>
  (w.components.i32[name] ?? w.components.u8[name])![idNumber(id)]!;
const isRural = (bp: string) =>
  Boolean((catalogs.birthplaces.entries.find((e) => e.key === bp)?.attrs as { rural?: boolean } | undefined)?.rural);

describe('spec 030: historia generada (perfil colombiano)', () => {
  const built = buildWorld(DEFAULT_PROFILE, 482917);
  const { world, pop, hist, events } = built;

  it('CA-001: misma semilla → misma historia, mismos antepasados y mismo stateHash', () => {
    const again = buildWorld(DEFAULT_PROFILE, 482917);
    expect(again.hist.ancestorIds).toEqual(hist.ancestorIds);
    expect(JSON.stringify(again.hist.events)).toBe(JSON.stringify(hist.events));
    expect(stateHash(again.world)).toBe(stateHash(world));
    expect(stateHash(buildWorld(DEFAULT_PROFILE, 482918).world)).not.toBe(stateHash(world));
  });

  it('CA-002 INV-001: todo evento del pasado tiene 1900 ≤ at < 0', () => {
    for (const e of events) {
      expect(e.at).toBeLessThan(0);
      expect(e.at).toBeGreaterThanOrEqual(floor);
    }
  });

  it('CA-002 INV-002: nadie tiene eventos antes de nacer ni después de morir; edades de los padres; vivos sin muerte', () => {
    for (const e of events) {
      for (const { id } of e.participants) {
        if (!id.startsWith('CIT')) continue;
        expect(e.at).toBeGreaterThanOrEqual(col(world, 'demo.birthMinute', id));
        const d = col(world, 'demo.deathMinute', id);
        if (d !== 0) expect(e.at).toBeLessThanOrEqual(d);
      }
    }
    for (const id of pop.citizenIds) expect(col(world, 'demo.deathMinute', id)).toBe(0);
    for (const { childId, motherId, fatherId } of lineageOf(world)) {
      const born = col(world, 'demo.birthMinute', childId);
      const ageAt = (p: EntityId) => (born - col(world, 'demo.birthMinute', p)) / YEAR;
      if (motherId) expect(ageAt(motherId)).toBeGreaterThanOrEqual(14);
      if (motherId) expect(ageAt(motherId)).toBeLessThanOrEqual(50);
      if (fatherId) expect(ageAt(fatherId)).toBeGreaterThanOrEqual(15);
      if (fatherId) expect(ageAt(fatherId)).toBeLessThanOrEqual(70);
      for (const p of [motherId, fatherId]) {
        const d = p ? col(world, 'demo.deathMinute', p) : 0;
        if (d !== 0) expect(d).toBeGreaterThan(born); // los padres viven al nacer el hijo
      }
    }
  });

  it('CA-002 INV-003: ningún lugar u organización aparece antes de su fundación', () => {
    for (const o of world.organizations.values()) expect(o.foundedAt).toBeDefined();
    for (const e of events) {
      const p = e.payload as { orgId?: EntityId; placeId?: EntityId };
      for (const id of [p.orgId, p.placeId, e.placeId]) {
        if (!id) continue;
        const f = (id.startsWith('ORG') ? world.organizations.get(id) : world.places.get(id))?.foundedAt;
        if (f !== undefined) expect(e.at).toBeGreaterThanOrEqual(f);
      }
    }
    // Cada lugar se construye después de fundado su barrio.
    for (const pl of world.places.values()) {
      if (pl.foundedAt === undefined || !pl.districtId || pl.districtId === pl.id) continue;
      expect(pl.foundedAt).toBeGreaterThanOrEqual(world.places.get(pl.districtId)!.foundedAt!);
    }
  });

  it('CA-003: cada persona viva tiene padres y abuelos, con nacimiento (y muerte si murieron)', () => {
    for (const id of pop.citizenIds) {
      const c = world.citizens.get(id)!;
      for (const p of [c.motherId, c.fatherId]) {
        expect(p).toBeDefined();
        const parent = world.citizens.get(p!)!;
        expect(parent.motherId).toBeDefined();
        expect(parent.fatherId).toBeDefined();
        for (const g of [parent.motherId!, parent.fatherId!]) expect(col(world, 'demo.birthMinute', g)).toBeLessThan(0);
      }
    }
    // Hay antepasados muertos y también alguno vivo fuera del mundo (precisión aprobada de 030).
    const deaths = hist.ancestorIds.filter((a) => col(world, 'demo.deathMinute', a) !== 0).length;
    expect(deaths).toBeGreaterThan(hist.ancestorIds.length / 2);
    expect(deaths).toBeLessThan(hist.ancestorIds.length);
  });

  it('CA-004: el presente sigue anclado: los antepasados no se simulan y no ocupan hogares', () => {
    const active = [...world.citizens.values()].filter((c) => world.components.u8.active![idNumber(c.id)] === 1);
    expect(active.map((c) => c.id)).toEqual(pop.citizenIds);
    for (const a of hist.ancestorIds) {
      const c = world.citizens.get(a)!;
      expect(c.ancestor).toBe(true);
      expect(c.householdId).toBeUndefined();
      expect(col(world, 'demo.generation', a)).toBeGreaterThanOrEqual(1);
    }
    // Coste (§3, v0.2): unos 5,5 antepasados por vivo (2 + 4 + 8·0,35, menos las ramas de hermanos compartidas).
    expect(hist.ancestorIds.length / pop.citizenIds.length).toBeLessThan(7);
  });

  it('CA-006 (datos): toda migración del campo durante La Violencia enlaza su HISTORICAL_CONTEXT', () => {
    const violencia = hist.events.find((e) => e.type === 'HISTORICAL_CONTEXT' && (e.payload as { key: string }).key === 'co.la_violencia')!;
    const byName = new Map(catalogs.birthplaces.entries.map((e) => [e.name, e.key]));
    for (const e of hist.events) {
      if (e.type !== 'MIGRATED' || e.at < clock.at(1946) || e.at >= clock.at(1959)) continue;
      if (!isRural(byName.get((e.payload as { from: string }).from) ?? '')) continue;
      expect(e.causes.some((c) => 'event' in c && c.event === violencia.id)).toBe(true);
    }
  });
});

describe('spec 030 CA-005: origen rural y migraciones (agregado de 20 mundos)', () => {
  const rural = new Map<number, [number, number]>();
  const migrations = new Map<number, number>();
  for (const seed of seeds(7000)) {
    const { world, pop, hist } = buildWorld(DEFAULT_PROFILE, seed);
    for (const id of [...pop.citizenIds, ...hist.ancestorIds]) {
      const c = world.citizens.get(id)!;
      const y = clock.yearOf(col(world, 'demo.birthMinute', id));
      // Desde 2000 hay menores, que nacen siempre en el municipio (007): no cuentan como muestra de origen.
      if (y < 1900 || y >= 2000) continue;
      const d = Math.floor(y / 10) * 10;
      const [r, n] = rural.get(d) ?? [0, 0];
      rural.set(d, [r + (isRural(c.birthplace ?? '') ? 1 : 0), n + 1]);
    }
    for (const e of hist.events as WorldEvent[]) if (e.type === 'MIGRATED') {
      const y = clock.yearOf(e.at);
      migrations.set(y, (migrations.get(y) ?? 0) + 1);
    }
  }

  it('la proporción de nacidos en el campo por década está a ±0,1 de 1 − urbanización', () => {
    for (const [d, [r, n]] of [...rural].sort((a, b) => a[0] - b[0])) {
      if (n < 40) continue;
      expect(Math.abs(r / n - (1 - seriesAt(P.urbanization, d + 5))), `década ${d}: ${r}/${n}`).toBeLessThanOrEqual(0.1);
    }
  });

  it('las migraciones tienen picos en La Violencia y en el desplazamiento de 1998–2004', () => {
    const rate = (a: number, b: number) => {
      let s = 0;
      for (let y = a; y <= b; y++) s += migrations.get(y) ?? 0;
      return s / (b - a + 1);
    };
    expect(rate(1946, 1958)).toBeGreaterThan(rate(1934, 1945));
    expect(rate(1998, 2004)).toBeGreaterThan(rate(1990, 1997));
    expect(rate(1998, 2004)).toBeGreaterThan(rate(2005, 2012));
  });
});
