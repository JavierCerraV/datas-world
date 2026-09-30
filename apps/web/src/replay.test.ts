import { describe, expect, it } from 'vitest';
import { MoveBook, VIEW_LAG_MAX, stepView } from './replay.ts';
import type { Move } from './replay.ts';
import { occupancy, outdoorRects, scene, spotIn } from './scene.ts';
import { routeCache } from './streets.ts';
import type { CitizenPosition } from './types.ts';

// Reproducción del movimiento (024 R-013).
const move = (citizenId: string, departAt: number, arriveAt: number, from: string, to: string): Move => ({ citizenId, departAt, arriveAt, from, to, mode: 'walk' });
const person = (id: string, placeId: string | null, activity = 'idle'): CitizenPosition => ({ id, name: id, x: 0, y: 0, activity, placeId, moving: false, mood: 0.5, age: 30 });

// Un mapa de 12 × 5: una calle en la fila 2, una casa con puerta en (1,1) y un parque con puerta en (10,1).
const W = 12;
const tiles = Array.from({ length: W * 5 }, (_, i) => (Math.floor(i / W) === 2 ? 1 : 0));
const grid = { width: W, height: 5, tiles };
const points: Record<string, [number, number]> = { 'PLC-0001': [1.5, 1.5], 'PLC-0002': [10.5, 1.5] };
const places = [
  { id: 'PLC-0001', kind: 'vivienda.casa', name: 'Casa', rect: { x: 0, y: 0, w: 3, h: 2 }, open: 'privado' },
  { id: 'PLC-0002', kind: 'espacio_publico.parque', name: 'Parque', rect: { x: 8, y: 3, w: 4, h: 2 }, open: '24h' },
];

describe('024 R-013: dónde está cada persona', () => {
  it('CA-009: antes de salir en su origen, durante el viaje sobre la calle, después en el destino', () => {
    const book = new MoveBook();
    book.add([move('CIT-000001', 100, 120, 'PLC-0001', 'PLC-0002')]);
    book.add([move('CIT-000001', 100, 120, 'PLC-0001', 'PLC-0002')]); // repetido: se descarta
    expect(book.size).toBe(1);
    expect(book.where('CIT-000001', 90, 'PLC-0002')).toEqual({ kind: 'at', place: 'PLC-0001' });
    const mid = book.where('CIT-000001', 110, 'PLC-0002');
    expect(mid.kind).toBe('walk');
    expect(mid.kind === 'walk' && mid.f).toBe(0.5);
    expect(book.where('CIT-000001', 125, 'PLC-0002')).toEqual({ kind: 'at', place: 'PLC-0002' });
    expect(book.where('CIT-000009', 125, 'PLC-0001')).toEqual({ kind: 'at', place: 'PLC-0001' }); // sin viajes: su lugar

    const route = routeCache(grid);
    const people = [person('CIT-000001', 'PLC-0002'), person('CIT-000002', 'PLC-0001'), person('CIT-000003', 'PLC-0002')];
    const input = { people, book, points, outdoor: outdoorRects(places), route };
    const during = scene({ ...input, t: 110 });
    // Quien camina se ve, sobre la calle (fila 2 = y entre 16 y 24 px); quien está en casa no; quien está en el parque sí.
    const walker = during.figures.find((f) => f.id === 'CIT-000001')!;
    expect(walker.walk).toBe(true);
    expect(walker.y).toBeGreaterThanOrEqual(14);
    expect(walker.y).toBeLessThanOrEqual(26);
    expect(during.figures.find((f) => f.id === 'CIT-000002')).toBeUndefined();
    const inPark = during.figures.find((f) => f.id === 'CIT-000003')!;
    expect(inPark.walk).toBe(false);
    expect(inPark).toMatchObject(spotIn(places[1]!.rect, 'CIT-000003'));
    // De noche, las ventanas de la casa se encienden si hay alguien despierto dentro.
    expect(occupancy(during.where, people, points).get('1.5,1.5')).toBe(1);
    expect(occupancy(during.where, [person('CIT-000002', 'PLC-0001', 'sleep')], points).size).toBe(0);
  });

  it('olvidar viajes viejos conserva el último de cada persona', () => {
    const book = new MoveBook();
    book.add([move('CIT-000001', 10, 20, 'PLC-0001', 'PLC-0002'), move('CIT-000001', 30, 40, 'PLC-0002', 'PLC-0001')]);
    book.prune(1000);
    expect(book.size).toBe(1);
    expect(book.where('CIT-000001', 1000, null)).toEqual({ kind: 'at', place: 'PLC-0001' });
  });
});

describe('024 R-013: reloj de vista', () => {
  it('CA-010: avanza a la velocidad del mundo, no pasa del último minuto guardado y salta si se queda atrás', () => {
    // Empieza detrás del último minuto guardado.
    const first = stepView(null, 1000, 1, 16, false);
    expect(first).toBeLessThan(1000);
    // A 1 min/s, en 1 s reales avanza alrededor de 1 minuto.
    const next = stepView(first, 1000, 1, 1000, false);
    expect(next - first).toBeGreaterThan(0.2);
    expect(next - first).toBeLessThan(3.1);
    // Nunca pasa del último minuto guardado.
    expect(stepView(999.9, 1000, 10, 5000, false)).toBe(1000);
    // Muy atrás: salta cerca del presente.
    expect(stepView(1000 - VIEW_LAG_MAX - 10, 1000, 1, 16, false)).toBeGreaterThan(990);
    // En pausa alcanza el último minuto.
    expect(stepView(990, 1000, 0, 2000, true)).toBe(1000);
  });
});
