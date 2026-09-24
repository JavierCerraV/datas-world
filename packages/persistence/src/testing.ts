// Utilidades para las pruebas de persistencia. No se exportan desde index.ts.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WorldConfig } from '@datas-world/engine';

export const testConfig = (over: Partial<WorldConfig> = {}): WorldConfig => ({
  name: "Data's World",
  seed: 482917,
  epoch: '2027-01-04T00:00',
  tickMinutes: 5,
  currency: { code: 'COP', minorUnit: 1 },
  population: { target: 200 },
  engineVersion: '0.1.0',
  params: {},
  initialCapabilities: ['clock'],
  holidays: ['2027-01-06'],
  ...over,
});

/** Carpeta temporal para una prueba; `cleanup` la borra con todo lo que contenga. */
export function tempDir(): { dir: string; file: (name: string) => string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'mundo-persist-'));
  return { dir, file: (name) => join(dir, name), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
