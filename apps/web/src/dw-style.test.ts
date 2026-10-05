// Estilo del visor (spec 024 v0.6, R-025): los colores, las fuentes, el radio y el borde salen de un solo archivo de
// tokens (CA-018), y las pestañas Expediente y Charla solo tienen dirección si hay una persona elegida.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tabHref } from './router.ts';

const dir = import.meta.dirname;
const sinComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const hojas = readdirSync(dir).filter((f) => f.endsWith('.css'));

describe('024 CA-018: tokens en un único archivo', () => {
  const tokens = sinComentarios(readFileSync(join(dir, 'dw-tokens.css'), 'utf8'));

  it('define la paleta, la forma y las fuentes', () => {
    for (const v of ['--dw-blue', '--dw-red', '--dw-gold', '--dw-green', '--dw-edge', '--dw-track', '--dw-elixir', '--dw-radius', '--dw-border', '--dw-lift', '--font-display', '--font-ui']) {
      expect(tokens, v).toContain(`${v}:`);
    }
    expect(tokens).toContain('--dw-radius: 12px');
    expect(tokens).toContain('--dw-border: 3px');
    expect(tokens).toContain('Lilita One');
    expect(tokens).toContain('Nunito');
  });

  it.each(hojas.filter((f) => f !== 'dw-tokens.css'))('%s no usa colores ni fuentes propias', (f) => {
    const css = sinComentarios(readFileSync(join(dir, f), 'utf8'));
    expect(css.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\bhwb\(|\blab\(|\boklch\(/g) ?? [], 'colores literales').toEqual([]);
    expect(css).not.toMatch(/@import url\(/);
    expect(css).not.toMatch(/font(-family)?:[^;]*['"][A-Z][A-Za-z ]+['"]/);
  });
});

describe('024 R-025: pestañas', () => {
  it('Mundo y Dashboard siempre tienen dirección; Expediente y Charla, solo con una persona', () => {
    expect(tabHref('mundo', null)).toBe('#/mundo');
    expect(tabHref('datos', null)).toBe('#/datos');
    expect(tabHref('expediente', null)).toBeNull();
    expect(tabHref('charla', null)).toBeNull();
    expect(tabHref('expediente', 'CIT-000019')).toBe('#/expediente/CIT-000019');
    expect(tabHref('charla', 'CIT-000019')).toBe('#/charla/CIT-000019');
  });
});
