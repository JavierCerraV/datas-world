import { defineConfig } from 'vitest/config';

// Las pruebas viven junto al código (CLAUDE.md §4): src/<sistema>/<archivo>.test.ts
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
    // Generar un mundo incluye su historia de desarrollo (041): con la suite en paralelo, 5 s no alcanzan.
    testTimeout: 180_000,
    hookTimeout: 120_000,
  },
});
