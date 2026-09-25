// world:report — la población del mundo frente al perfil de país (spec 029 §9, 007, 008, 006) y, con
// --history, el resumen de la historia generada (030 §9). Solo lee el estado persistido y los eventos.
import { parseArgs } from 'node:util';
import { ageInYears, idNumber, profileEntry, profileNumber } from '@datas-world/engine';
import type { CountryProfile, World } from '@datas-world/engine';
import { pendingEntries } from '@datas-world/generators';
import { WorldRepository, openReadonly, queryEvents } from '@datas-world/persistence';
import { DEFAULT_DB, UsageError, dayOf, withDb } from './common.ts';
import type { Io } from './common.ts';
import { healthSummary, leisureSummary, placesSummary } from './ficha.ts';

export interface ReportRow {
  indicator: string;
  world: number;
  reference: number | null;
  /** world − reference. */
  deviation: number | null;
  status: string;
}

/** Indicadores de población, hogares y empleo del mundo frente al perfil (en su fecha de presente). */
export function populationReport(world: World, profile: CountryProfile): ReportRow[] {
  const date = world.config.epoch.slice(0, 10);
  const birth = world.components.i32['demo.birthMinute']!;
  const living = [...world.citizens.values()].filter((c) => !c.ancestor && c.status === 'active');
  const ages = living.map((c) => ageInYears(birth[idNumber(c.id)]!, world.now, world.config.epoch));
  const share = (f: (a: number) => boolean) => ages.filter(f).length / Math.max(1, ages.length);
  const hh = [...world.households.values()];
  const tpl = (f: (t: string) => boolean) => hh.filter((h) => f(h.template)).length / Math.max(1, hh.length);
  const ext = tpl((t) => t === 'extended');
  let pet = 0,
    emp = 0,
    informal = 0,
    unemp = 0;
  living.forEach((c, i) => {
    if (ages[i]! < 15) return;
    pet++;
    const occ = c.occupation;
    if (occ && occ.kind !== 'none') {
      emp++;
      if (occ.kind !== 'formal') informal++;
    } else if (occ?.reason === 'unemployed') unemp++;
  });
  const ref = (key: string): [number | null, string] => {
    try {
      return [profileNumber(profile, key, date), profileEntry(profile, key, date)?.status ?? '—'];
    } catch {
      return [null, 'sin dato'];
    }
  };
  const row = (indicator: string, value: number, key: string | null): ReportRow => {
    const [reference, status] = key ? ref(key) : [null, '—'];
    return { indicator, world: value, reference, deviation: reference === null ? null : value - reference, status };
  };
  return [
    row('Personas vivas', living.length, 'gen.population.target'),
    row('Menores de 12 años', share((a) => a < 12), 'demo.share.age0to11'),
    row('De 12 a 17 años', share((a) => a >= 12 && a < 18), 'demo.share.age12to17'),
    row('60 años o más', share((a) => a >= 60), 'demo.share.age60plus'),
    row('Tamaño medio del hogar', living.length / Math.max(1, hh.length), 'household.meanSize'),
    row('Hogares unipersonales', tpl((t) => t === 'single'), 'household.share.unipersonal'),
    row('Hogares biparentales', tpl((t) => t === 'couple' || t === 'couple_kids') + (2 / 3) * ext, 'household.share.biparental'),
    row('Hogares monoparentales', tpl((t) => t === 'single_parent') + ext / 3, 'household.share.monoparental'),
    row('Otros hogares', tpl((t) => t === 'roommates'), 'household.share.otros'),
    row('Tasa de ocupación (15+)', emp / Math.max(1, pet), 'labor.employmentRate'),
    row('Tasa global de participación', (emp + unemp) / Math.max(1, pet), 'labor.participationRate'),
    row('Tasa de desempleo', unemp / Math.max(1, emp + unemp), 'labor.unemploymentRate'),
    row('Informalidad', informal / Math.max(1, emp), 'labor.informality'),
  ];
}

const fmt = (x: number | null, indicator: string) =>
  x === null ? '—' : /^Personas/.test(indicator) ? String(Math.round(x)) : /medio/.test(indicator) ? x.toFixed(2) : x.toFixed(3);

export function worldReport(args: string[], io: Io): void {
  const { values: v } = parseArgs({
    args,
    options: {
      json: { type: 'boolean', default: false },
      history: { type: 'boolean', default: false },
      health: { type: 'boolean', default: false },
      leisure: { type: 'boolean', default: false },
      places: { type: 'boolean', default: false },
      db: { type: 'string', default: DEFAULT_DB },
    },
  });
  withDb(openReadonly(v.db), (db) => {
    const world = new WorldRepository(db).loadWorld();
    const profile = world.config.profile;
    if (!profile) throw new UsageError('El mundo no tiene perfil de país: es un mundo vacío de M0');
    const rows = populationReport(world, profile);
    const pending = pendingEntries(profile).map((e) => e.key);
    const history = v.history ? historySummary(world, db) : undefined;
    if (v.json) return io.out(JSON.stringify({ profile: profile.id, rows, pending, history }));
    io.out(`Informe de ${world.config.name} frente al perfil ${profile.id} (${dayOf(world.now, world.config.epoch)})`);
    io.out(`${'Indicador'.padEnd(30)} ${'Mundo'.padStart(8)} ${'Perfil'.padStart(8)} ${'Desv.'.padStart(8)}  Estado`);
    for (const r of rows) {
      const dev = r.deviation === null ? '—' : (r.deviation >= 0 ? '+' : '') + fmt(r.deviation, r.indicator);
      io.out(
        `${r.indicator.padEnd(30)} ${fmt(r.world, r.indicator).padStart(8)} ${fmt(r.reference, r.indicator).padStart(8)} ${dev.padStart(8)}  ${r.status}`,
      );
    }
    io.out(`Cifras por confirmar en el perfil (${pending.length}): ${pending.join(', ') || 'ninguna'}`);
    if (history) for (const line of history) io.out(line);
    if (v.health) for (const line of healthSummary(world)) io.out(line);
    if (v.leisure) for (const line of leisureSummary(world, profile)) io.out(line);
    if (v.places) for (const line of placesSummary(world)) io.out(line);
  });
}

/** 030 §9: vivos y fallecidos, migraciones, edad media al morir y fundaciones, por década. */
function historySummary(world: World, db: Parameters<typeof queryEvents>[0]): string[] {
  const past = queryEvents(db, { to: 0, limit: 1_000_000 });
  const decade = (at: number) => Number(dayOf(at, world.config.epoch).slice(0, 3)) * 10;
  const t = new Map<number, { born: number; died: number; ageSum: number; migr: number; founded: number }>();
  const get = (d: number) => {
    if (!t.has(d)) t.set(d, { born: 0, died: 0, ageSum: 0, migr: 0, founded: 0 });
    return t.get(d)!;
  };
  for (const e of past) {
    const r = get(decade(e.at));
    if (e.type === 'CITIZEN_BORN') r.born++;
    else if (e.type === 'CITIZEN_DIED') {
      r.died++;
      r.ageSum += (e.payload as { age: number }).age;
    } else if (e.type === 'MIGRATED') r.migr++;
    else if (e.type === 'DISTRICT_FOUNDED' || e.type === 'ORG_FOUNDED' || e.type === 'TOWN_FOUNDED') r.founded++;
  }
  const ancestors = [...world.citizens.values()].filter((c) => c.ancestor);
  const death = world.components.i32['demo.deathMinute'];
  const aliveOutside = ancestors.filter((c) => death && death[idNumber(c.id)] === 0).length;
  const lines = [
    '',
    `Historia: ${past.length} eventos del pasado; ${ancestors.length} antepasados (${aliveOutside} vivos fuera del mundo)`,
    `${'Década'.padEnd(8)} ${'Nac.'.padStart(6)} ${'Muertes'.padStart(8)} ${'Edad media'.padStart(11)} ${'Migr.'.padStart(6)} ${'Fundac.'.padStart(8)}`,
  ];
  for (const [d, r] of [...t].sort((a, b) => a[0] - b[0])) {
    const mean = r.died > 0 ? (r.ageSum / r.died).toFixed(1) : '—';
    lines.push(
      `${String(d).padEnd(8)} ${String(r.born).padStart(6)} ${String(r.died).padStart(8)} ${mean.padStart(11)} ${String(r.migr).padStart(6)} ${String(r.founded).padStart(8)}`,
    );
  }
  return lines;
}
