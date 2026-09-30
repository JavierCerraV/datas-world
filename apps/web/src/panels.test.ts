import { describe, expect, it } from 'vitest';
import { fold, moodColor, placeAt, placeHtml, populationHtml, populationRows } from './panels.ts';
import { alongPath, onTheWay, routeCache, streetPath } from './streets.ts';
import type { CitizenPosition } from './types.ts';

const person = (id: string, name: string, over: Partial<CitizenPosition> = {}): CitizenPosition =>
  ({ id, name, x: 1, y: 1, activity: 'work', placeId: null, moving: false, mood: 0.5, age: 30, ...over });

describe('024 R-008: población y lugares', () => {
  it('CA-006: el buscador filtra por nombre sin mayúsculas ni tildes; la lista va en orden y con el color del ánimo', () => {
    const list = [person('CIT-000002', 'José Pérez', { mood: 0.9 }), person('CIT-000001', 'Ana Gómez', { moving: true }), person('CIT-000003', 'María Jose Díaz')];
    expect(fold('JOSÉ')).toBe('jose');
    expect(populationRows(list, 'jose').map((r) => r.name)).toEqual(['José Pérez', 'María Jose Díaz']);
    const all = populationRows(list, '');
    expect(all.map((r) => r.name)).toEqual(['Ana Gómez', 'José Pérez', 'María Jose Díaz']);
    expect(all[0]!.doing).toBe('en camino');
    expect(moodColor(0)).toBe('hsl(0 60% 45%)');
    expect(moodColor(1)).toBe('hsl(120 60% 45%)');
    expect(populationHtml(populationRows(list, 'zzz'), 3)).toContain('Nadie coincide');
  });

  it('CA-006: la ficha de un lugar dice su horario, quién está dentro y quién vive allí', () => {
    const html = placeHtml({
      id: 'PLC-0003', name: 'Casa 3', kind: 'vivienda.casa', district: 'El Centro', open: 'privado',
      inside: [{ id: 'CIT-000001', name: 'Ana Gómez', activity: 'sleep' }], residents: [{ id: 'CIT-000001', name: 'Ana Gómez' }, { id: 'CIT-000002', name: 'Luis Gómez' }],
    });
    expect(html).toContain('Vivienda privada');
    expect(html).toContain('Aquí ahora (1)');
    expect(html).toContain('Viven aquí (2)');
    expect(html).toContain('data-person="CIT-000002"');
    expect(placeHtml({ id: 'PLC-0004', name: 'Tienda', kind: 'comercio.tienda', district: null, open: '08:00-20:00', inside: [], residents: [] })).toContain('Abierto de 08:00 a 20:00');
  });

  it('el lugar bajo el cursor es el más pequeño que lo contiene', () => {
    const places = [
      { id: 'PLC-0001', kind: 'barrio', name: 'Centro', rect: { x: 0, y: 0, w: 10, h: 10 }, open: '' },
      { id: 'PLC-0002', kind: 'tienda', name: 'Tienda', rect: { x: 2, y: 2, w: 2, h: 2 }, open: '' },
    ];
    expect(placeAt(places, 3.5, 3.2)?.id).toBe('PLC-0002');
    expect(placeAt(places, 8, 8)?.id).toBe('PLC-0001');
    expect(placeAt(places, 20, 20)).toBeUndefined();
  });
});

describe('024 R-009: recorridos por las calles', () => {
  // 7×5: calle en la fila 2 y en la columna 5; dos casas (2) con su puerta en la fila 1.
  const W = 7;
  const rows = ['2222222', '2022202', '1111111', '2222212', '2222212'];
  const grid = { width: W, height: 5, tiles: rows.join('').split('').map(Number) };

  it('CA-005: la ruta va solo por calles entre las dos puertas, es la más corta y la mitad del viaje está sobre ella', () => {
    const a = { x: 1.5, y: 1.5 };
    const b = { x: 5.5, y: 4.5 };
    const path = streetPath(grid, a, b);
    expect(path[0]).toEqual(a);
    expect(path.at(-1)).toEqual(b);
    for (const p of path.slice(1, -1)) expect(grid.tiles[Math.floor(p.y) * W + Math.floor(p.x)]).toBe(1);
    expect(path.length).toBe(8); // puerta, 5 pasos por la calle y 2 bajando: la más corta
    const mid = alongPath(path, 0.5);
    expect(path.some((p, i) => i > 0 && Math.min(p.x, path[i - 1]!.x) <= mid.x && mid.x <= Math.max(p.x, path[i - 1]!.x) && Math.min(p.y, path[i - 1]!.y) <= mid.y && mid.y <= Math.max(p.y, path[i - 1]!.y))).toBe(true);
    expect(alongPath(path, 0)).toEqual(a);
    expect(alongPath(path, 1)).toEqual(b);
  });

  it('sin ruta posible va en línea recta; las rutas se guardan; la posición sale del minuto del viaje', () => {
    const blocked = { width: 3, height: 1, tiles: [2, 2, 2] };
    expect(streetPath(blocked, { x: 0.5, y: 0.5 }, { x: 2.5, y: 0.5 })).toEqual([{ x: 0.5, y: 0.5 }, { x: 2.5, y: 0.5 }]);
    const route = routeCache(grid);
    const a = { x: 1.5, y: 1.5 };
    const b = { x: 5.5, y: 4.5 };
    expect(route(a, b)).toBe(route(a, b));
    expect(onTheWay(route, { from: a, to: b, departAt: 100, arriveAt: 200 }, 100)).toEqual(a);
    expect(onTheWay(route, { from: a, to: b, departAt: 100, arriveAt: 200 }, 250)).toEqual(b);
  });
});
