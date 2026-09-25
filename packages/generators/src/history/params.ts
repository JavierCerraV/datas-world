// Parámetros de la historia generada (spec 030 §8), leídos del perfil de país (spec 029).
import { MINUTES_PER_DAY, daysFromCivil, parseEpoch, profileNumber, profileValue } from '@datas-world/engine';
import type { CountryProfile, Rng, WorldMinute } from '@datas-world/engine';
import type { Catalog } from '../catalogs/schema.ts';
import { seriesAt } from '../country/series.ts';

export type Range = [number, number];

export interface HistoryParams {
  foundingYear: number;
  motherAgeAtBirth: Range;
  fatherAgeGap: Range;
  adultDeathBonusFactor: number;
  deathAgeSd: number;
  /** Proporción base de muertes violentas, sobre la que actúan los efectos de violencia del catálogo. */
  violentDeathShare: number;
  greatGrandparentP: number;
  lifeExpectancy: Record<string, number>;
  urbanization: Record<string, number>;
}

export function historyParams(p: CountryProfile, date: string): HistoryParams {
  const range = (k: string): Range => {
    const v = profileValue(p, k, date) as number[];
    return [v[0]!, v[1]!];
  };
  return {
    foundingYear: profileNumber(p, 'gen.history.foundingYear', date),
    motherAgeAtBirth: range('gen.history.motherAgeAtBirth'),
    fatherAgeGap: range('gen.history.fatherAgeGap'),
    adultDeathBonusFactor: profileNumber(p, 'gen.history.adultDeathBonusFactor', date),
    deathAgeSd: profileNumber(p, 'gen.history.deathAgeSd', date),
    violentDeathShare: profileNumber(p, 'gen.history.violentDeathShare', date),
    greatGrandparentP: profileNumber(p, 'gen.history.greatGrandparentP', date),
    lifeExpectancy: profileValue(p, 'demo.lifeExpectancy.byYear', date) as Record<string, number>,
    urbanization: profileValue(p, 'demo.urbanization.byYear', date) as Record<string, number>,
  };
}

/** Utilidades de fechas relativas al epoch del mundo. */
export class Clock {
  readonly epochYear: number;
  readonly #epochDays: number;
  constructor(epoch: string) {
    const e = parseEpoch(epoch);
    this.epochYear = e.year;
    this.#epochDays = daysFromCivil(e.year, e.month, e.day);
  }
  /** Minuto del día (y, m, d). */
  at(y: number, m = 1, d = 1): WorldMinute {
    return (daysFromCivil(y, m, d) - this.#epochDays) * MINUTES_PER_DAY;
  }
  /** Un día al azar del año `y`. */
  randomDay(r: Rng, y: number): WorldMinute {
    return this.at(y, 1, 1) + r.int(0, 364) * MINUTES_PER_DAY;
  }
  /** Año civil de un minuto (aproximado por días de 365,2425). */
  yearOf(minute: WorldMinute): number {
    return Math.floor((this.#epochDays + minute / MINUTES_PER_DAY) / 365.2425 + 1970);
  }
}

/** Edad media de muerte de quien llega a adulto: e0 + factor·(80 − e0) (030 R-004; estimado). */
export function meanDeathAge(P: HistoryParams, birthYear: number): number {
  const e0 = seriesAt(P.lifeExpectancy, birthYear);
  return e0 + P.adultDeathBonusFactor * Math.max(0, 80 - e0);
}

/** Hechos históricos del catálogo con sus fechas y efectos. */
export interface HistoricalEvent {
  key: string;
  name: string;
  start: string;
  end: string;
  startYear: number;
  endYear: number;
  effects: Record<string, number>;
}

export function historicalEvents(catalog: Catalog): HistoricalEvent[] {
  return catalog.entries.map((e) => {
    const a = e.attrs as { start: string; end: string; effects: Record<string, number> };
    return { key: e.key, name: e.name, start: a.start, end: a.end, startYear: Number(a.start.slice(0, 4)), endYear: Number(a.end.slice(0, 4)), effects: a.effects };
  });
}

/** Hechos vigentes en un año con un efecto dado (> 1). */
export const activeWith = (events: readonly HistoricalEvent[], year: number, effects: readonly string[]) =>
  events.filter((h) => year >= h.startYear && year <= h.endYear && effects.some((k) => (h.effects[k] ?? 1) > 1));
