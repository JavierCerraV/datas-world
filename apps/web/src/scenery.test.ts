import { describe, expect, it } from 'vitest';
import { T, TREE_DENSITY, decorOf, parkTrees, treeSpots } from './scenery.ts';

// Detalle del prototipo (024 R-012).
describe('024 R-012: árboles y adornos', () => {
  const W = 40;
  const H = 30;
  const tiles = Array.from({ length: W * H }, (_, i) => (i % W === 10 ? T.road : T.grass));

  it('los árboles caen en hierba sin calle al lado ni lugar encima, con la densidad del prototipo y siempre en el mismo sitio', () => {
    const rect = { x: 20, y: 5, w: 6, h: 6 };
    const spots = treeSpots({ width: W, height: H, tiles }, [rect]);
    expect(spots).toEqual(treeSpots({ width: W, height: H, tiles }, [rect]));
    for (const s of spots) {
      expect(Math.abs(s.x - 10)).toBeGreaterThan(1);
      expect(s.x >= rect.x && s.x < rect.x + rect.w && s.y >= rect.y && s.y < rect.y + rect.h).toBe(false);
      expect(s.dx).toBeLessThanOrEqual(2);
    }
    const free = tiles.filter((_, i) => Math.abs((i % W) - 10) > 1).length - rect.w * rect.h;
    expect(spots.length / free).toBeGreaterThan(TREE_DENSITY - 0.08);
    expect(spots.length / free).toBeLessThan(TREE_DENSITY + 0.08);
  });

  it('los árboles del parque evitan los senderos centrales y el estanque', () => {
    const [x, y, w, h] = [0, 0, 80, 56];
    const trees = parkTrees('PLC-0007', x, y, w, h);
    expect(trees.length).toBeGreaterThan(0);
    for (const t of trees) {
      expect(Math.abs(t.y + 3 - h / 2)).toBeGreaterThanOrEqual(5);
      expect(Math.abs(t.x + 2 - w / 2)).toBeGreaterThanOrEqual(5);
      expect(t.x < 22 && t.y < 16).toBe(false);
    }
  });

  it('cada tipo lleva el adorno del prototipo', () => {
    expect(decorOf('salud.hospital').mark).toBe('cruz');
    expect(decorOf('industria.fabrica').mark).toBe('chimenea');
    expect(decorOf('educacion.colegio').mark).toBe('bandera');
    expect(decorOf('deporte.gimnasio').mark).toBe('pesas');
    expect(decorOf('ocio.cafe').awning).toBeDefined();
    expect(decorOf('comercio.tienda_barrio').awning).toBeDefined();
    expect(decorOf('vivienda.casa')).toEqual({});
  });
});
