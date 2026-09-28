// ESLint (flat config). Las reglas de determinismo del motor implementan la spec 023 R-001;
// scripts/guardrails/check.mjs hace la misma comprobación de forma independiente.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

const nonDeterministicImports = ['fs', 'net', 'http', 'https', 'child_process', 'dgram', 'worker_threads'].flatMap(
  (m) => [m, `node:${m}`, `${m}/promises`, `node:${m}/promises`],
);

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'prototipo/**', 'scripts/**', '.githooks/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Visor (spec 024): corre en el navegador.
    files: ['apps/web/src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Motor determinista: el tiempo es WorldMinute (spec 002, 023 R-001).' },
        { name: 'performance', message: 'Motor determinista: sin reloj real (spec 023 R-001).' },
        { name: 'crypto', message: 'Motor determinista: usa Rng con flujos nombrados (spec 023).' },
        { name: 'setTimeout', message: 'Motor sin temporizadores: el ritmo lo marca el worker.' },
        { name: 'setInterval', message: 'Motor sin temporizadores: el ritmo lo marca el worker.' },
        { name: 'fetch', message: 'Motor sin E/S de red (CLAUDE.md regla 2).' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Usa Rng (spec 023). Math.random está prohibido en el motor.' },
      ],
      'no-restricted-imports': [
        'error',
        { paths: nonDeterministicImports.map((name) => ({ name, message: 'Motor sin E/S (CLAUDE.md regla 2).' })) },
      ],
    },
  },
  {
    // 009 R-006 (anticircularidad): la selección de conducta no importa el temperamento. Mientras dure la
    // migración (035 §9) puede usar el adaptador `temperament/legacy.ts`; la prueba de arquitectura lo caduca.
    files: ['packages/engine/src/decision/**/*.ts', 'packages/engine/src/selection/**/*.ts', 'packages/engine/src/conversation/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: nonDeterministicImports.map((name) => ({ name, message: 'Motor sin E/S (CLAUDE.md regla 2).' })),
          patterns: [
            {
              group: ['**/temperament/*', '!**/temperament/legacy.ts'],
              message: 'La selección de conducta no lee el temperamento (spec 009 R-006, ADR-007).',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
