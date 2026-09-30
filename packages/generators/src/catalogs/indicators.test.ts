import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INDICATORS } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { CATALOGS_DIR, parseCatalog } from './load.ts';

// Catálogo de indicadores de la capa de investigación (spec 045 R-004). No forma parte de la generación del mundo.
describe('catálogo de indicadores (045)', () => {
  it('valida el esquema y describe exactamente los indicadores que calcula el motor', () => {
    const cat = parseCatalog(JSON.parse(readFileSync(join(CATALOGS_DIR, 'indicators.json'), 'utf8')), 'indicators');
    expect(cat.entries.map((e) => e.key.replace(/^indicador\./, ''))).toEqual([...INDICATORS].sort());
    for (const e of cat.entries) {
      expect(String(e.attrs?.description).length, e.key).toBeGreaterThan(10);
      expect(String(e.attrs?.source).length, e.key).toBeGreaterThan(3);
    }
  });
});
