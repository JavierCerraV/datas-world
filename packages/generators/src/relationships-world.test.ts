// Relaciones en un mundo que vive (spec 012, bloque R de M3): 100 personas × 1 año con la semilla del proyecto.
import { affectionFor } from '@datas-world/engine';
import type { WorldEvent } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { KIN_FAMILIARITY } from './development/bonds.ts';
import { generateWorld } from './generate.ts';
import { lifeRunner } from './life.ts';

const count = (events: readonly WorldEvent[], type: string) => events.filter((e) => e.type === type).length;

describe('012 R-007: punto de partida desde el desarrollo', () => {
  it('cada pariente vivo es un vínculo de familia con su afecto aprendido y la familiaridad de la convivencia', () => {
    const { world } = generateWorld({ seed: 482917, population: 100 });
    const people = [...world.citizens.values()].filter((c) => c.status === 'active' && !c.ancestor);
    const kin = people.flatMap((c) => (c.bonds ?? []).map((b) => ({ c, b })));
    expect(kin.length).toBeGreaterThan(50);
    for (const { c, b } of kin) {
      expect(b.labels).toContain('familia');
      const home = c.householdId !== undefined && world.citizens.get(b.with)?.householdId === c.householdId;
      expect(b.familiarity).toBe(home ? KIN_FAMILIARITY.household : KIN_FAMILIARITY.other);
    }
    // Lo vivido con cada progenitor en el desarrollo forma la función de esa persona (`cit.<id>`).
    const withParent = people.filter((c) => c.motherId && world.citizens.get(c.motherId)?.status === 'active');
    expect(withParent.length).toBeGreaterThan(0);
    expect(withParent.filter((c) => affectionFor(c.functions, c.motherId!) !== 0).length / withParent.length).toBeGreaterThan(0.8);
  });
});

describe('M3 (012 y 013): 100 personas × 1 año', { timeout: 900_000 }, () => {
  it('012 CA-001 asimetría, CA-002 vínculos por persona, sin degeneración; 013 memoria acotada y viva', () => {
    const { world } = generateWorld({ seed: 482917, population: 100 });
    const r = lifeRunner(world);
    r.resume('prueba');
    const events: WorldEvent[] = [];
    for (let m = 0; m < 12; m++) {
      r.advanceDays(m === 11 ? 365 - 11 * 30 : 30);
      events.push(...r.drainEvents());
    }
    const people = [...world.citizens.values()].filter((c) => c.status === 'active' && !c.ancestor);
    // CA-002: entre 3 y 15 vínculos con familiaridad > 0,3 de media.
    const known = people.reduce((s, c) => s + (c.bonds ?? []).filter((b) => (b.familiarity ?? 0) > 0.3).length, 0) / people.length;
    expect(known).toBeGreaterThanOrEqual(3);
    expect(known).toBeLessThanOrEqual(15);
    // CA-001 (en la escala medida, PA-144): entre los pares con afecto alto de A por B, es frecuente que B no le
    // corresponda (afecto por debajo de la mediana).
    const pairs = people.flatMap((c) => (c.bonds ?? []).filter((b) => !(b.labels ?? []).includes('familia'))
      .map((b) => [affectionFor(c.functions, b.with), affectionFor(world.citizens.get(b.with)?.functions, c.id)] as const));
    const sorted = pairs.map(([ab]) => ab).sort((x, y) => x - y);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const high = pairs.filter(([ab]) => ab >= 0.2);
    expect(high.length).toBeGreaterThan(5);
    expect(high.filter(([, ba]) => ba < median).length / high.length).toBeGreaterThanOrEqual(0.1);
    // §9: cada tipo presente y alertas de degeneración (todos amigos de todos, ninguna discusión, funciones saturadas).
    for (const t of ['MET', 'ENCOUNTER', 'ARGUMENT', 'FRIENDSHIP_FORMED', 'BOND_FORGOTTEN']) expect(count(events, t), t).toBeGreaterThan(0);
    const friends = people.reduce((s, c) => s + (c.bonds ?? []).filter((b) => (b.labels ?? []).includes('amigo')).length, 0) / people.length;
    expect(friends).toBeLessThan(15);
    expect(count(events, 'ARGUMENT') / people.length).toBeLessThan(5);
    const fns = people.flatMap((c) => (c.functions?.f ?? []).filter((f) => f.s.startsWith('cit.')).map((f) => Math.abs(f.v)));
    expect(fns.filter((v) => v > 0.95).length / fns.length).toBeLessThan(0.05);
    // INV-001: familiaridad, tensión y confianza en [0,1], sin NaN; tope de vínculos (P2).
    for (const c of people) {
      expect((c.bonds ?? []).length).toBeLessThanOrEqual(40);
      for (const b of c.bonds ?? []) for (const x of [b.familiarity ?? 0, b.tension, b.trust]) expect(x >= 0 && x <= 1).toBe(true);
    }
    // 013 CA-007 y §9 con el mismo año: memoria acotada, lo vivido se recuerda, se generaliza y se reconstruye.
    const kb = people.reduce((s, c) => s + JSON.stringify(c.memory ?? {}).length, 0) / people.length / 1024;
    expect(kb).toBeLessThan(8);
    for (const c of people) {
      expect(c.memory!.episodes.length).toBeLessThanOrEqual(60);
      expect(c.memory!.chapters.filter((x) => x.to === undefined).length).toBe(1);
    }
    const lived = people.flatMap((c) => c.memory!.episodes.filter((m) => m.at >= 0));
    expect(lived.length / people.length).toBeGreaterThan(2);
    expect(count(events, 'SCHEMA_FORMED')).toBeGreaterThan(0);
    expect(lived.some((m) => Math.abs(m.valence - m.valence0) > 0.01)).toBe(true);
  });
});
