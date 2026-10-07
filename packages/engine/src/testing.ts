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

/** Perfil mínimo con los parámetros de la vida diaria (010, 011, 016): los mismos valores que el perfil colombiano. */
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
      hungry: 0.1, exhausted: 0.08, sick: 0.08, debt: 0.12, peak: 0.8,
    }),
    entry('needs.mood', { energy: 0.2, stress: 0.4, stressRef: 0.3, loneliness: 0.25, hunger: 0.2, valence: 0.15, fun: 0.1 }),
    entry('health.acute.dailyP', 0.0095),
    entry('health.acute.weights', { gripa: 0.7, gastroenteritis: 0.3 }),
    entry('health.acute.days', { gripa: 5, gastroenteritis: 3 }),
    entry('routine.school', { start: 390, end: 750, decFrom: 1201, janTo: 125, midFrom: 616, midTo: 706 }),
    entry('routine.meals', { washLen: 15, breakfastLen: 30, lunchStart: 720, lunchLen: 45, dinnerStart: 1140, dinnerLen: 30 }),
    entry('mobility.speeds', { walk: 4.5, bike: 12, moto: 25, car: 25, noise: 0.1 }),
    entry('mobility.fuelPerKm', { moto: 170, car: 420 }),
    entry('mobility.bus', { headway: 60, first: 300, last: 1200 }),
    entry('mobility.intercity', { km: 45, privateFactor: 0.8 }),
    entry('mobility.habits', { margin: 5, bikeMinMeters: 400, lookahead: 60 }),
    entry('labor.minimumWageMonthly', 1_750_905),
    entry('labor.transportAllowance', 249_095),
    entry('stratum.utilitySubsidy', { '1': 0.6, '2': 0.5, '3': 0.15 }),
    entry('economy.deductions', { health: 0.04, pension: 0.04 }),
    entry('economy.informal', { meanSmmlv: 0.8, independentFactor: 1.25, sd: 0.3, badDayP: 0.2, badDayFactor: 0.3, workDays: 26 }),
    entry('economy.pension', { smmlv: 1 }),
    entry('economy.food', { perPersonMonthly: 250_000, childWeight: 0.6, '1': 0.9, '2': 1, '3': 1.2, '4': 1.5, '5': 2, '6': 2.5 }),
    entry('economy.other', { share: 0.25 }),
    entry('economy.utilities', { baseMonthly: 220_000, sizeExp: 0.6, contribution5: 0.2, contribution6: 0.2 }),
    entry('economy.health', { copayLow: 5_000, copayMid: 20_100, copayHigh: 52_800, uninsured: 60_000, medsMonthly: 15_000 }),
    entry('economy.credit', {
      bankRate: 0.019, bankMonths: 12, bankMin: 500_000, bankMaxWages: 3, gotaRate: 0.2, gotaDays: 30, gotaMin: 50_000,
      gotaMax: 1_000_000, pressureEnter: 200_000, pressureExit: 100_000,
    }),
    entry('economy.orgs', { externalLo: 0.8, externalHi: 1.3, initialPayrollMonths: 2, maxCashMonths: 3 }),
    entry('economy.days', { rent: 5, utilities: 15, meds: 1, bankDue: 10 }),
  ],
};
