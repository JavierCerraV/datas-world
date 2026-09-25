// Utilidades para las pruebas del motor. No se exportan desde index.ts.
import type { CountryProfile } from './profile.ts';
import type { WorldConfig } from './world.ts';

/** Configuración mínima válida (peldaño 0: solo el reloj). */
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
  holidays: [],
  ...over,
});

const entry = (key: string, value: CountryProfile['entries'][number]['value']) =>
  ({ key, value, validFrom: '1900-01-01', source: 'prueba', status: 'estimado' }) as const;

/** Perfil mínimo con los parámetros de la vida diaria (010, 011): los mismos valores que el perfil colombiano. */
export const TEST_PROFILE: CountryProfile = {
  id: 'TEST',
  country: 'CO',
  currency: { code: 'COP', minorUnit: 1 },
  entries: [
    entry('needs.rates', {
      energyRest: 0.125, energyAwake: 0.045, energyWork: 0.058, energyStress: 0.4, restStress: 0.45, sickRest: 0.6,
      hungerRest: 0.035, hungerAwake: 0.16, hungerWork: 0.09, socialCompany: 0.012, socialRest: 0.004, socialAlone: 0.045,
      hygieneAwake: 0.02, funAwake: 0.03, funLeisure: 0.15, eatRate: 1.3, stressRate: 0.05, moodRate: 0.08, emotionHalfLife: 12,
    }),
    entry('needs.stress', {
      base: 0.12, instability: 0.25, negativeMoney: 0.25, lowMoney: 0.1, lowMoneyThreshold: 150000, unemployed: 0.15,
      hungry: 0.1, exhausted: 0.08, sick: 0.08, peak: 0.8,
    }),
    entry('needs.mood', { energy: 0.2, stress: 0.4, stressRef: 0.3, loneliness: 0.25, hunger: 0.2, valence: 0.15, fun: 0.1 }),
    entry('health.acute.dailyP', 0.0095),
    entry('health.acute.weights', { gripa: 0.7, gastroenteritis: 0.3 }),
    entry('health.acute.days', { gripa: 5, gastroenteritis: 3 }),
    entry('routine.school', { start: 390, end: 750, decFrom: 1201, janTo: 125, midFrom: 616, midTo: 706 }),
    entry('routine.meals', { washLen: 15, breakfastLen: 30, lunchStart: 720, lunchLen: 45, dinnerStart: 1140, dinnerLen: 30 }),
  ],
};
