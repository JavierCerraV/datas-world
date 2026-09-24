// Utilidades para las pruebas del motor. No se exportan desde index.ts.
import type { WorldConfig } from './world.ts';

/** Configuración mínima válida (peldaño 0: solo el reloj). */
export const testConfig = (over: Partial<WorldConfig> = {}): WorldConfig => ({
  name: 'Villa Cordillera',
  seed: 482917,
  epoch: '2027-01-04T00:00',
  tickMinutes: 5,
  currency: { code: 'COP', minorUnit: 1 },
  population: { target: 200 },
  engineVersion: '0.1.0',
  params: {},
  initialCapabilities: ['clock'],
  holidays: [],
  ...over,
});
