// Relaciones en un mundo que vive (spec 012, bloque R de M3): 100 personas × 1 año con la semilla del proyecto.
import { affectionFor, beliefTruth, lifeReport, turningCandidates, walk, why } from '@datas-world/engine';
import type { DayPoint, ProfileKey, WorldEvent } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { loadCatalogs } from './catalogs/load.ts';
import { KIN_FAMILIARITY } from './development/bonds.ts';
import { generateWorld } from './generate.ts';
import { knowledgeCatalog, lifeRunner } from './life.ts';

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

describe('M3 (012, 013, 019 y 020): 100 personas × 1 año', { timeout: 900_000 }, () => {
  it('012 CA-001 asimetría, CA-002 vínculos por persona, sin degeneración; 013 memoria acotada y viva; 019 registro causal; 020 informe', () => {
    const { world, events: born } = generateWorld({ seed: 482917, population: 100 });
    const r = lifeRunner(world);
    r.resume('prueba');
    const events: WorldEvent[] = [];
    // 020 R-001: la trayectoria diaria, como la guarda la persistencia con la instantánea de cada día.
    const trajectory = new Map<string, DayPoint[]>();
    const sample = () => {
      for (const c of world.citizens.values()) {
        if (c.status !== 'active' || c.ancestor) continue;
        const row = Number(c.id.slice(4));
        const p = { day: Math.floor(world.now / 1440), mood: world.components.f32['state.mood']![row]!, stress: world.components.f32['state.stress']![row]!, money: world.components.i32.money![row]!, sleepDebt: world.components.i32['state.sleepDebt']![row]! };
        trajectory.set(c.id, [...(trajectory.get(c.id) ?? []), p]);
      }
    };
    sample();
    for (let d = 0; d < 365; d++) {
      r.advanceDays(1);
      events.push(...r.drainEvents());
      sample();
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
    // 019 CA-002 y CA-003: toda causa de evento existe y es anterior (por id y por minuto de la vida diaria).
    const all = [...born, ...events];
    const byId = new Map(all.map((e) => [e.id as string, e]));
    const valid = (e: WorldEvent) => e.causes.length > 0 && e.causes.every((c) => !('event' in c) || (byId.has(c.event) && c.event < e.id && byId.get(c.event)!.at <= Math.max(e.at, 0)));
    expect(events.filter(valid).length / events.length).toBeGreaterThanOrEqual(0.95);
    // 019 CA-004: los eventos que citan un estado llegan a algún hecho del registro en profundidad 3.
    const citing = events.filter((e) => e.causes.some((c) => 'state' in c));
    const reached = citing.filter((e) => [...walk(why((x) => byId.get(x), e.id, { depth: 3, minWeight: 0, view: world })!)].some(({ n, d }) => d > 0 && n.kind === 'event'));
    expect(reached.length / citing.length).toBeGreaterThanOrEqual(0.6);
    // 020: el informe de cada persona.
    const resilience: number[] = [];
    let divs = 0;
    let withThree = 0;
    for (const c of people) {
      const mine = all.filter((e) => e.participants.some((p) => p.id === c.id) || e.type === 'CITIZEN_DIED');
      const input = { view: world, id: c.id, events: mine, get: (x: string) => byId.get(x), trajectory: trajectory.get(c.id)!, now: world.now };
      const rep = lifeReport(input);
      // CA-001: ≥ 3 puntos de inflexión, o todos los hechos de su vida que pueden serlo si tiene menos.
      expect(rep.turningPoints.length).toBeGreaterThanOrEqual(Math.min(3, turningCandidates(input).length));
      if (rep.turningPoints.length >= 3) withThree++;
      for (const t of rep.turningPoints) expect(byId.has(t.event) && t.why.ref === t.event).toBe(true);
      // CA-002: cada etapa cita un hecho real (el que la abrió o los de su tramo).
      for (const ch of rep.chapters) expect([ch.openedBy, ...ch.events].filter(Boolean).every((x) => byId.has(x!)) && (ch.openedBy !== undefined || ch.events.length > 0), `${c.id} ${ch.theme}`).toBe(true);
      // CA-005: todo valor definido del perfil tiene sus hechos de base.
      for (const [k, v] of Object.entries(rep.profile.values)) if (v !== null) expect(rep.profile.basis[k as ProfileKey].every((x) => byId.has(x)) && rep.profile.basis[k as ProfileKey].length > 0, k).toBe(true);
      if (rep.profile.values.resilience !== null) resilience.push(rep.profile.values.resilience);
      divs += rep.divergences.length;
    }
    // CA-006: la resiliencia varía entre personas; la trayectoria de 100 personas × 1 año ocupa < 10 MB (≈ 20 B por fila).
    const mean = resilience.reduce((a, b) => a + b, 0) / resilience.length;
    expect(Math.sqrt(resilience.reduce((a, b) => a + (b - mean) ** 2, 0) / resilience.length)).toBeGreaterThan(0.05);
    expect([...trajectory.values()].reduce((s, t) => s + t.length, 0) * 20).toBeLessThan(10 * 1024 * 1024);
    expect(divs / people.length).toBeLessThan(3);
    // Y la mayoría llega a tres en un año (los niños pequeños tienen pocos hechos propios).
    expect(withThree / people.length).toBeGreaterThanOrEqual(0.7);
    // 025 CA-002: una creencia falsa compartida por ≥ 3 personas y al menos una corrección.
    const topics = knowledgeCatalog(loadCatalogs());
    const eventsAbout = new Map<string, WorldEvent[]>();
    for (const e of all) for (const k of ['citizenId', 'a', 'b']) {
      const v = (e.payload as Record<string, unknown>)[k];
      if (typeof v === 'string') eventsAbout.set(v, [...(eventsAbout.get(v) ?? []), e]);
    }
    const shared = new Map<string, number>();
    for (const c of people) for (const b of c.beliefs ?? []) {
      if (b.about.startsWith('CIT-') && !beliefTruth(b, eventsAbout.get(b.about) ?? [], topics)) shared.set(`${b.about}|${b.predicate}`, (shared.get(`${b.about}|${b.predicate}`) ?? 0) + 1);
    }
    expect(Math.max(0, ...shared.values())).toBeGreaterThanOrEqual(3);
    expect(count(events, 'BELIEF_CORRECTED')).toBeGreaterThan(0);
    // 025 CA-005: la credibilidad no sube al pasar de boca en boca, y la cadena de un rumor llega a su origen.
    const byHops = new Map<number, number[]>();
    for (const c of people) for (const b of c.beliefs ?? []) byHops.set(b.hops ?? 0, [...(byHops.get(b.hops ?? 0) ?? []), b.credibility]);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const levels = [...byHops].filter(([, xs]) => xs.length >= 5).sort((a, b) => a[0] - b[0]).map(([, xs]) => avg(xs));
    for (let i = 1; i < levels.length; i++) expect(levels[i]!).toBeLessThanOrEqual(levels[i - 1]! + 1e-9);
    const far = events.find((e) => e.type === 'RUMOR_TOLD' && (e.payload as { hops: number }).hops >= 2)!;
    const origin = [...walk(why((x) => byId.get(x), far.id, { depth: 10, minWeight: 0, maxNodes: 200 })!)].some(({ n, d }) => d > 0 && n.kind === 'event' && !['RUMOR_TOLD', 'BELIEF_CORRECTED'].includes(byId.get(n.ref)!.type));
    expect(origin).toBe(true);
  });
});
