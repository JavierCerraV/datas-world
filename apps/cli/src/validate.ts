// `validate:parity` (bloque H de M2): simula en memoria N semillas × N días con la vida diaria y compara con la
// línea base del prototipo (`docs/validaciones/linea-base-prototipo.json`) y con los criterios de M2
// (010 CA-002 y CA-006, 015 CA-006). Desde ADR-007, el ánimo y el estrés son comprobación de cordura frente a
// las tolerancias del prototipo; la referencia de conducta será la batería 042.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { idNumber } from '@datas-world/engine';
import type { World, WorldEvent } from '@datas-world/engine';
import { generateWorld, lifeRunner, loadCatalogs } from '@datas-world/generators';
import { UsageError, toInt } from './common.ts';
import type { Io } from './common.ts';

const YEAR = 365.25 * 1440;
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const sd = (xs: number[]) => {
  const m = mean(xs);
  return xs.length > 1 ? Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)) : 0;
};
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(q * (s.length - 1))]! : 0;
};

export interface RunMetrics {
  seed: number;
  population: number;
  nan: number;
  mood: { mean: number; sd: number };
  stress: { mean: number; sd: number };
  moneyAdults: { p10: number; p50: number; p90: number };
  employedAdultsPct: number;
  acutePerPersonYear: number;
  eventsByType: Record<string, number>;
  seconds: number;
}

/** Simula un mundo y mide lo mismo que la línea base del prototipo, más la incidencia de enfermedad aguda. */
export function simulate(seed: number, profileId: string, days: number, population: number | undefined, now: () => number): RunMetrics {
  const t0 = now();
  const catalogs = loadCatalogs();
  const { world } = generateWorld({ seed, profileId, catalogs, ...(population ? { population } : {}) });
  const runner = lifeRunner(world, catalogs);
  const living = [...world.citizens.values()].filter((c) => !c.ancestor && c.status === 'active').map((c) => idNumber(c.id));
  const moods = new Map<number, number[]>();
  const stresses = new Map<number, number[]>();
  const events: WorldEvent[] = [];
  let nan = 0;
  for (let d = 0; d < days; d++) {
    runner.advanceDays(1);
    events.push(...runner.drainEvents());
    const f = world.components.f32;
    for (const row of living) {
      if (world.components.u8.active![row] !== 1) continue;
      const m = f['state.mood']![row]!;
      const s = f['state.stress']![row]!;
      moods.set(row, [...(moods.get(row) ?? []), m]);
      stresses.set(row, [...(stresses.get(row) ?? []), s]);
      for (const col of ['need.energy', 'need.hunger', 'need.social', 'need.fun', 'state.mood', 'state.stress']) {
        const v = f[col]![row]!;
        if (!Number.isFinite(v) || v < 0 || v > 1) nan++;
      }
    }
  }
  const personMood = [...moods.values()].map(mean);
  const personStress = [...stresses.values()].map(mean);
  const adults = living.filter((r) => (world.now - world.components.i32['demo.birthMinute']![r]!) / YEAR >= 18);
  const worth = adults.map((r) => world.components.i32.money![r]! - (world.components.i32['econ.debt']?.[r] ?? 0));
  const workingAge = adults.filter((r) => (world.now - world.components.i32['demo.birthMinute']![r]!) / YEAR < 65);
  const employed = workingAge.filter((r) => ['formal', 'informal', 'independent'].includes(world.citizens.get(`CIT-${String(r).padStart(6, '0')}` as never)?.occupation?.kind ?? ''));
  const byType: Record<string, number> = {};
  for (const e of events) byType[e.type] = (byType[e.type] ?? 0) + 1;
  return {
    seed,
    population: living.length,
    nan,
    mood: { mean: mean(personMood), sd: sd(personMood) },
    stress: { mean: mean(personStress), sd: sd(personStress) },
    moneyAdults: { p10: quantile(worth, 0.1), p50: quantile(worth, 0.5), p90: quantile(worth, 0.9) },
    employedAdultsPct: workingAge.length ? employed.length / workingAge.length : 0,
    acutePerPersonYear: ((byType.FELL_ILL ?? 0) / Math.max(1, living.length)) * (365 / days),
    eventsByType: byType,
    seconds: Math.round((now() - t0) / 1000),
  };
}

interface Check {
  name: string;
  value: string;
  target: string;
  ok: boolean;
  kind: 'obligatorio' | 'cordura' | 'informativo';
}

/** Comprobaciones de M2: NaN (obligatorio), ánimo y estrés (010 CA-002, cordura desde ADR-007), empleo, enfermedad (010 CA-006). */
export function checks(runs: RunMetrics[], baseline?: { runs: { moneyAdults: { p10: number; p50: number; p90: number } }[] }): Check[] {
  const m = (f: (r: RunMetrics) => number) => mean(runs.map(f));
  const pct = (x: number) => `${(x * 100).toFixed(1)} %`;
  const money = (x: number) => `$${Math.round(x).toLocaleString('es-CO')}`;
  const out: Check[] = [
    { name: 'Valores NaN o fuera de rango', value: String(runs.reduce((s, r) => s + r.nan, 0)), target: '0', ok: runs.every((r) => r.nan === 0), kind: 'obligatorio' },
    { name: 'Ánimo medio (010 CA-002)', value: m((r) => r.mood.mean).toFixed(3), target: '0,46–0,62', ok: m((r) => r.mood.mean) >= 0.46 && m((r) => r.mood.mean) <= 0.62, kind: 'cordura' },
    { name: 'Desviación del ánimo entre personas', value: m((r) => r.mood.sd).toFixed(3), target: '> 0,05', ok: m((r) => r.mood.sd) > 0.05, kind: 'cordura' },
    { name: 'Estrés medio (010 CA-002)', value: m((r) => r.stress.mean).toFixed(3), target: '0,25–0,41', ok: m((r) => r.stress.mean) >= 0.25 && m((r) => r.stress.mean) <= 0.41, kind: 'cordura' },
    { name: 'Adultos de 18 a 64 con empleo', value: pct(m((r) => r.employedAdultsPct)), target: '55–90 %', ok: m((r) => r.employedAdultsPct) >= 0.55 && m((r) => r.employedAdultsPct) <= 0.9, kind: 'cordura' },
    { name: 'Enfermedad aguda por persona y año (010 CA-006)', value: m((r) => r.acutePerPersonYear).toFixed(2), target: '2–4', ok: m((r) => r.acutePerPersonYear) >= 2 && m((r) => r.acutePerPersonYear) <= 4, kind: 'cordura' },
  ];
  for (const q of ['p10', 'p50', 'p90'] as const) {
    const base = baseline ? mean(baseline.runs.map((r) => r.moneyAdults[q])) : undefined;
    out.push({ name: `Patrimonio de los adultos ${q} (015 CA-006)`, value: money(m((r) => r.moneyAdults[q])), target: base === undefined ? '—' : `prototipo ${money(base)}`, ok: true, kind: 'informativo' });
  }
  return out;
}

export function validateParity(args: string[], io: Io): void {
  const { values: v } = parseArgs({
    args,
    options: {
      profile: { type: 'string', default: 'prototipo' },
      seeds: { type: 'string', default: '100-109' },
      days: { type: 'string', default: '365' },
      population: { type: 'string' },
      out: { type: 'string' },
      baseline: { type: 'string', default: 'docs/validaciones/linea-base-prototipo.json' },
    },
  });
  const m = /^(\d+)(?:-(\d+))?$/.exec(v.seeds!);
  if (!m) throw new UsageError('--seeds debe ser N o N-M');
  const from = Number(m[1]);
  const to = m[2] ? Number(m[2]) : from;
  const days = toInt('days', v.days, 1);
  const population = v.population ? toInt('population', v.population, 10) : undefined;
  const clock = () => performance.now();
  const runs: RunMetrics[] = [];
  for (let seed = from; seed <= to; seed++) {
    const r = simulate(seed, v.profile!, days, population, clock);
    io.err(`semilla ${seed}: ${r.population} personas, ${days} días en ${r.seconds} s`);
    runs.push(r);
  }
  let baseline: Parameters<typeof checks>[1];
  try {
    baseline = JSON.parse(readFileSync(v.baseline!, 'utf8'));
  } catch {
    baseline = undefined;
  }
  const result = checks(runs, baseline);
  const lines = [
    `# Validación de M2: perfil ${v.profile}, semillas ${v.seeds}, ${days} días`,
    '',
    `Generado con \`pnpm cli validate:parity --profile ${v.profile} --seeds ${v.seeds} --days ${days}${population ? ` --population ${population}` : ''}\`.`,
    '',
    '| Métrica | Valor | Objetivo | Tipo | Resultado |',
    '|---|---|---|---|---|',
    ...result.map((c) => `| ${c.name} | ${c.value} | ${c.target} | ${c.kind} | ${c.kind === 'informativo' ? '—' : c.ok ? '✔' : '✘'} |`),
    '',
    '| Semilla | Personas | Ánimo | Estrés | Empleo | Enfermedad/año | p50 patrimonio | s |',
    '|---|---|---|---|---|---|---|---|',
    ...runs.map((r) => `| ${r.seed} | ${r.population} | ${r.mood.mean.toFixed(3)} | ${r.stress.mean.toFixed(3)} | ${(r.employedAdultsPct * 100).toFixed(1)} % | ${r.acutePerPersonYear.toFixed(2)} | ${r.moneyAdults.p50} | ${r.seconds} |`),
  ];
  if (v.out) writeFileSync(v.out, lines.join('\n') + '\n');
  for (const l of lines) io.out(l);
  if (result.some((c) => c.kind === 'obligatorio' && !c.ok)) process.exitCode = 1;
}

export type { World };
