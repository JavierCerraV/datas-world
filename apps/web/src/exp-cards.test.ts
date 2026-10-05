// Resumen del expediente (spec 024 R-027, CA-020): el mazo de conducta, las fuentes de control de la última decisión
// y el camino de vida.
import { describe, expect, it } from 'vitest';
import { chainOf, deckOf, lastDecision, lifeRoad, percentages, roadHtml, sourceShares } from './exp-cards.ts';
import { deckHtml } from './exp-cards.ts';
import type { Dossier } from './dossier-types.ts';
import type { Cause, EventView } from './types.ts';

const ev = (id: string, type: string, at: number, causes: Cause[], date = '2026-01-07 10:00'): EventView => ({ id, type, at, date, participants: [], payload: {}, causes });
const src = (s: string, weight: number): Cause => ({ state: `fuente.${s}`, value: 1, weight });

describe('024 CA-020: mazo de conducta', () => {
  const responses = [
    { response: 'ocio.futbol', strength: 0.62 },
    { response: 'actividad.work', strength: 0.9 },
    { response: 'actividad.sleep', strength: 0.9 },
    { response: 'ocio.lectura', strength: 0.2 },
    ...Array.from({ length: 8 }, (_, i) => ({ response: `ocio.otra_${i}`, strength: 0.3 })),
  ];

  it('toma las ocho conductas más fuertes, en orden estable (fuerza y, si empatan, nombre)', () => {
    const deck = deckOf(responses);
    expect(deck).toHaveLength(8);
    expect(deck.slice(0, 3).map((c) => c.response)).toEqual(['actividad.sleep', 'actividad.work', 'ocio.futbol']);
    expect(deck.map((c) => c.response)).toEqual(deckOf([...responses].reverse()).map((c) => c.response));
  });

  it('la fuerza va de 0 a 9 y marca la rareza de la carta', () => {
    const deck = deckOf([{ response: 'a', strength: 1.4 }, { response: 'b', strength: 0.45 }, { response: 'c', strength: -1 }, { response: 'd', strength: 0.65 }]);
    // Salen de la más fuerte a la más débil.
    expect(deck.map((c) => c.cost)).toEqual([9, 6, 4, 0]);
    expect(deck.map((c) => c.rarity)).toEqual(['l', 'e', 'r', 'c']);
  });

  it('sin conductas dice que aún no hay', () => {
    expect(deckHtml([])).toContain('Sin conductas aprendidas');
    expect(deckHtml(responses)).toContain('class="dcard r-l"');
  });
});

describe('024 CA-020: fuentes de control de la última decisión', () => {
  it('reparte 100 % exacto entre las fuentes (mayor resto)', () => {
    for (const w of [[1, 1, 1], [0.5, 0.3, 0.2], [0.333, 0.333, 0.334], [7, 1], [1]]) expect(percentages(w).reduce((a, b) => a + b, 0)).toBe(100);
    expect(percentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(percentages([0, 0])).toEqual([0, 0]);
  });

  it('agrupa las causas fuente.* por fuente y la barra suma 100', () => {
    const shares = sourceShares([src('reforzador:need.fun', 0.5), src('reforzador:need.social', 0.2), src('fuerza:ocio.futbol', 0.3), { event: 'EVT-1', weight: 0.1 }, { state: 'animo', value: 0.5, weight: 0.4 }]);
    expect(shares.map((s) => [s.source, s.pct])).toEqual([['reforzador', 70], ['fuerza', 30]]);
    expect(shares.reduce((s, x) => s + x.pct, 0)).toBe(100);
    expect(shares[0]!.label).toBe('le gusta');
  });

  it('la última decisión es el evento más reciente con fuentes; sin fuentes no hay', () => {
    const a = ev('EVT-1', 'LEISURE_DONE', 100, [src('fuerza:x', 1)]);
    const b = ev('EVT-2', 'ARRIVED_LATE', 300, [src('demorado:hist.discountK', 0.6), src('regla:rutina.work', 0.4), { event: 'EVT-3', weight: 0.1 }]);
    const c = ev('EVT-3', 'OVERSLEPT', 500, [{ state: 'cansancio', value: 0.9, weight: 1 }]);
    const last = lastDecision([a, b, c])!;
    expect(last.event.id).toBe('EVT-2');
    expect(last.shares.reduce((s, x) => s + x.pct, 0)).toBe(100);
    expect(lastDecision([c])).toBeNull();
    expect(chainOf(b, [a, b, c])).toEqual(['ARRIVED_LATE', 'OVERSLEPT']);
  });
});

describe('024 R-027: camino de vida', () => {
  const dos = {
    id: 'CIT-000019',
    identity: { birthDate: '1985-10-20', birthplace: 'el campo', education: null, arrived: { date: '2010-08-22', from: 'el campo', reason: null }, household: null },
    why: [], until: null, agenda: { blocks: [], now: 0, free: null }, family: [{ id: 'CIT-000022', name: 'Ana', relation: 'hija', situation: '' }],
    health: { insurance: null, conditions: [], illnesses: [], overslept: { count: 0, last: null } }, objects: [], debts: [],
    events: [
      { ...ev('EVT-1', 'CITIZEN_BORN', -100, [], '1985-10-20 00:00'), payload: { citizenId: 'CIT-000019' }, origin: true },
      { ...ev('EVT-5', 'MIGRATED', -50, [], '2010-08-22 00:00'), payload: { citizenId: 'CIT-000019' }, origin: true },
    ],
    counts: { events: 2, functions: 0, rules: 0, chats: 0 },
  } as unknown as Dossier;

  it('cinco etapas: las vividas con sus hitos, la actual marcada y las futuras bloqueadas', () => {
    const road = lifeRoad(dos, 41);
    expect(road.map((s) => [s.id, s.state])).toEqual([['I', 'past'], ['II', 'past'], ['III', 'past'], ['IV', 'now'], ['V', 'locked']]);
    expect(road[0]!.items.map((m) => m.label)).toEqual(['Nace']);
    expect(road[2]!.items.map((m) => m.label)).toEqual([expect.stringContaining('Llega a Data')]);
    expect(road[4]!.range).toBe('60+');
  });

  it('la etapa futura se muestra bloqueada y la actual dice «Hoy»', () => {
    const html = roadHtml(dos, 41);
    expect(html).toContain('Aún sin vivir');
    expect(html).toContain('<span class="tag gold">Hoy</span>');
  });
});
