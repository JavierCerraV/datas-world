// Memoria de partida (spec 013 R-002, R-010, CA-007): con qué recuerdos y capítulos llega cada persona al día 0.
import { describe, expect, it } from 'vitest';
import { generateWorld } from './generate.ts';
import { FIRST_MEMORY_AGE } from './memories/generate.ts';

const YEAR = 365.25 * 1440;

describe('013: memoria de partida', () => {
  it('CA-007: los adultos llegan con capítulos del pasado y recuerdos de su infancia, dentro de los topes', () => {
    const g = generateWorld({ seed: 482917, population: 100 });
    const people = [...g.world.citizens.values()].filter((c) => c.status === 'active' && !c.ancestor);
    const birth = (id: string) => g.world.components.i32['demo.birthMinute']![Number(id.slice(4))]!;
    const adults = people.filter((c) => g.world.now - birth(c.id) >= 25 * YEAR);
    expect(adults.length).toBeGreaterThan(20);
    for (const c of adults) {
      const m = c.memory!;
      expect(m.chapters.length, c.id).toBeGreaterThanOrEqual(2);
      expect(m.chapters.filter((x) => x.to === undefined).length, c.id).toBe(1); // INV-003
    }
    const withChildhood = adults.filter((c) => c.memory!.episodes.some((m) => m.at - birth(c.id) < 12 * YEAR));
    expect(withChildhood.length / adults.length).toBeGreaterThan(0.7);
    for (const c of people) {
      const m = c.memory!;
      expect(m.episodes.length).toBeLessThanOrEqual(60); // INV-002
      expect(m.chapters.length).toBeLessThanOrEqual(12);
      // Amnesia infantil: nada antes de los 4 años.
      expect(m.episodes.every((e) => e.at - birth(c.id) >= FIRST_MEMORY_AGE * YEAR - 1440), c.id).toBe(true);
      // INV-005: toda ancla existe; INV-001: rangos.
      const ids = new Set(m.episodes.map((e) => e.id));
      for (const ch of m.chapters) expect(ch.anchors.every((a) => ids.has(a))).toBe(true);
      for (const e of m.episodes) expect(Math.abs(e.valence) <= 1 && e.intensity >= 0 && e.intensity <= 1).toBe(true);
    }
    // Los capítulos quedan en el registro, y la memoria no es toda positiva ni toda negativa.
    expect(g.events.filter((e) => e.type === 'CHAPTER_OPENED').length).toBeGreaterThanOrEqual(people.reduce((s, c) => s + c.memory!.chapters.length, 0));
    const all = people.flatMap((c) => c.memory!.episodes);
    const negative = all.filter((m) => m.valence < 0).length / all.length;
    expect(negative).toBeGreaterThan(0.1);
    expect(negative).toBeLessThan(0.6);
    const kb = people.reduce((s, c) => s + JSON.stringify(c.memory).length, 0) / people.length / 1024;
    expect(kb).toBeLessThan(8);
  });
});
