// Spec 024 v0.8, R-030, CA-023: resolución del lienzo del mapa y colores de personas y edificios que no cambian.
import { describe, expect, it } from 'vitest';
import { lookOf, styleOf } from './logic.ts';
import { layerScale } from './render.ts';

describe('024 CA-023: el mapa en el estilo del lienzo', () => {
  it('el lienzo se pinta entre 1× y 3×, y baja para mapas muy grandes', () => {
    expect(layerScale(1000, 800)).toBe(3);
    expect(layerScale(2800, 1900)).toBe(1); // 5,3 M px a 3× pasaría de 16 M
    for (const [w, h] of [[400, 300], [1600, 1200], [3000, 2000], [8000, 6000]] as const) {
      const s = layerScale(w, h);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(3);
      if (s > 1) expect(w * s * h * s).toBeLessThanOrEqual(16_000_000);
    }
  });

  it('el aspecto de edificios y personas sigue saliendo de styleOf y lookOf (no del dibujo)', () => {
    expect(styleOf('ocio.cafe', 'PLC-1').roof).toBe('#6E4630');
    expect(lookOf('CIT-000042')).toEqual(lookOf('CIT-000042'));
  });
});
