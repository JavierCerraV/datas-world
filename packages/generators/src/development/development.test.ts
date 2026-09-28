import { createRng, idNumber } from '@datas-world/engine';
import type { DevelopmentEpisode, EntityId, FunctionStore, World, WorldEvent } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { buildOntology } from '../stimuli/ontology.ts';
import { buildWorld, catalogs } from '../testing.ts';
import { generateDevelopment } from './generate.ts';

// Spec 041: historia de aprendizaje sintética. Mundo de la semilla 482917 (perfil colombiano).
const t0 = performance.now();
const g = buildWorld('CO-2026.09', 482917);
const seconds = (performance.now() - t0) / 1000;
const years = g.events.filter((e) => e.type === 'DEVELOPMENT_YEAR') as WorldEvent<{ citizenId: string; age: number; episodes: DevelopmentEpisode[] }>[];
const byId = new Map(years.map((e) => [e.id, e]));
const living = g.pop.citizenIds;
const store = (id: EntityId) => g.world.citizens.get(id)!.functions!;
const sd = (xs: number[]) => {
  const m = xs.reduce((a, x) => a + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
};
const w = (s: FunctionStore, r: string, w0 = 0) => s.r.find((x) => x.r === r && x.c === '')?.w ?? w0;

describe('041: desarrollo en la generación del mundo', () => {
  it('CA-001: el mundo con su desarrollo se genera en menos de 60 s; unos 50 episodios por año de niñez y 12 de adulto', () => {
    expect(seconds).toBeLessThan(60);
    const episodes = years.reduce((a, e) => a + e.payload.episodes.length, 0);
    expect(episodes / living.length).toBeGreaterThan(400);
    const child = years.filter((e) => e.payload.age === 8);
    const adult = years.filter((e) => e.payload.age === 30);
    expect(child.reduce((a, e) => a + e.payload.episodes.length, 0) / child.length).toBeGreaterThan(35);
    expect(adult.reduce((a, e) => a + e.payload.episodes.length, 0) / adult.length).toBeLessThan(20);
  });

  it('R-007 y 030 INV-002: un evento por año de vida, en el pasado, con quien intervino vivo en esa fecha y causas', () => {
    for (const e of years) {
      expect(e.at).toBeLessThan(0);
      expect(e.causes.length).toBeGreaterThan(0);
      for (const ep of e.payload.episodes) expect(ep[6].every(([k, d]) => typeof k === 'string' && Number.isFinite(d))).toBe(true);
    }
    // Los hechos de la 030 que producen episodios son su causa (duelos, separación, estudios, migración).
    expect(years.some((e) => e.causes.some((c) => 'event' in c))).toBe(true);
  });

  it('CA-002 e INV-001: las 5 funciones más fuertes de 10 personas llevan a los episodios concretos que las formaron', () => {
    const rng = createRng(7);
    for (let k = 0; k < 10; k++) {
      const id = living[rng.int(0, living.length - 1)]!;
      const strongest = [...store(id).f].sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 5);
      for (const f of strongest) {
        expect(f.src.length, `${id} ${f.s}`).toBeGreaterThan(0);
        const origin = f.src.map((s) => byId.get(s as EntityId)).find((e) => e && e.payload.citizenId === id);
        expect(origin, `${id} ${f.s}`).toBeDefined();
        expect(origin!.payload.episodes.some((ep) => ep[6].some(([key]) => key === f.s)), `${id} ${f.s}`).toBe(true);
      }
    }
  });

  it('CA-003: repertorios diversos, y más castigo físico en los estratos bajos (en el sentido del catálogo)', () => {
    const adults = living.filter((id) => g.world.components.i32['demo.birthMinute']![idNumber(id)]! < -18 * 365 * 1440);
    expect(sd(adults.map((id) => w(store(id), 'conv.abrirse')))).toBeGreaterThan(0.05);
    expect(sd(adults.map((id) => w(store(id), 'evit.distraccion', 0.2)))).toBeGreaterThan(0.03);
    expect(sd(adults.map((id) => w(store(id), 'yo.enmarque', 0.1)))).toBeGreaterThan(0.1);
    const values = (id: EntityId) => store(id).f.filter((f) => f.s.startsWith('dominio.') && f.v > 0.3).length;
    expect(sd(adults.map(values))).toBeGreaterThan(0.3);
    // Castigos por persona en la infancia según el estrato de su hogar.
    const low = new Set(adults.filter((id) => {
      const h = g.world.households.get(g.world.citizens.get(id)!.householdId!)!;
      return g.world.places.get(g.world.places.get(h.dwellingId)!.districtId!)!.stratum! <= 2;
    }));
    const punish = (id: EntityId) => years.filter((e) => e.payload.citizenId === id).reduce((a, e) => a + e.payload.episodes.filter((ep) => ep[1] === 'crianza.castigo_fisico').length, 0);
    const mean = (ids: EntityId[]) => ids.reduce((a, id) => a + punish(id), 0) / Math.max(1, ids.length);
    expect(mean([...low])).toBeGreaterThan(mean(adults.filter((id) => !low.has(id))));
  });
});

describe('041 CA-004 y 042 V-12: divergencia y convergencia', () => {
  const onto = buildOntology(catalogs);
  const id = living.find((x) => g.world.components.i32['demo.birthMinute']![idNumber(x)]! < -30 * 365 * 1440)!;
  const RESPONSES = ['conv.abrirse', 'conv.aplacar', 'conv.callar', 'conv.contraatacar', 'conv.poner_limite', 'evit.distraccion', 'evit.consumir', 'yo.enmarque', 'habito.ejercicio'];
  /** La historia de esa persona con la semilla `seed` y la sensibilidad aversiva `tmp` (su temperamento). */
  const profile = (world: World, seed: number, tmp: number): number[] => {
    const c = world.citizens.get(id)!;
    const saved = { functions: c.functions, network: c.network };
    delete c.functions;
    delete c.network;
    const col = world.components.f32['tmp.aversiveSensitivity']!;
    const before = col[idNumber(id)]!;
    col[idNumber(id)] = tmp;
    const counters = { ...world.counters };
    generateDevelopment(world, [id], g.events, catalogs, onto, createRng(seed));
    const s = c.functions!;
    const out = [...RESPONSES.map((r) => w(s, r, 0.2)), ...['dominio.familia', 'dominio.conocimiento', 'verbal.critica'].map((k) => s.f.find((f) => f.s === k)?.v ?? 0)];
    Object.assign(c, saved);
    col[idNumber(id)] = before;
    Object.assign(world.counters, counters);
    return out;
  };
  const dist = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]!) ** 2, 0));

  it('(a) mismo temperamento, historias distintas: repertorios distintos; (b) temperamentos opuestos, misma historia: más parecidos', () => {
    const a: number[] = [];
    for (let s = 1; s <= 20; s++) a.push(dist(profile(g.world, s, 0.5), profile(g.world, s + 100, 0.5)));
    const b: number[] = [];
    for (let s = 1; s <= 20; s++) b.push(dist(profile(g.world, s, 0.1), profile(g.world, s, 0.9)));
    const mean = (xs: number[]) => xs.reduce((x, y) => x + y, 0) / xs.length;
    expect(mean(a)).toBeGreaterThan(0.1);
    expect(mean(b)).toBeLessThan(mean(a));
  });
});
