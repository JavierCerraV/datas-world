import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// Spec 023 CA-005: el linter falla si aparece Math.random en packages/engine.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const eslint = new ESLint({ cwd: root });
const lint = async (code: string, filePath: string) => {
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages.map((m) => m.ruleId) ?? [];
};

describe('ESLint — reglas de determinismo del motor (spec 023)', () => {
  const forbidden = 'export const x = Math.random();\n'; // determinismo-permitido: fixture de la prueba CA-005 (spec 023), aprobado por el usuario

  it('CA-005: Math.random en packages/engine es un error', { timeout: 30_000 }, async () => {
    expect(await lint(forbidden, 'packages/engine/src/fixture.ts')).toContain('no-restricted-properties');
  });

  it('la misma línea fuera del motor no se marca', { timeout: 30_000 }, async () => {
    expect(await lint(forbidden, 'apps/cli/src/fixture.ts')).not.toContain('no-restricted-properties');
  });
});
