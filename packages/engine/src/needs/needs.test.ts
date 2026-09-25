import { describe, expect, it } from 'vitest';
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import { MINUTES_PER_DAY } from '../calendar.ts';
import { defineColumn } from '../components.ts';
import { setOccupation } from '../employment.ts';
import type { WorldEvent } from '../events.ts';
import { formatId } from '../ids.ts';
import { createRng } from '../rng.ts';
import { Runner } from '../runner.ts';
import { applyPatches } from '../simulation/patches.ts';
import { createRegistry } from '../simulation/registry.ts';
import type { System } from '../simulation/system.ts';
import { stateHash } from '../serialize.ts';
import { TEST_PROFILE, testConfig } from '../testing.ts';
import { addCitizen, createWorld } from '../world.ts';
import type { World } from '../world.ts';
import { EMOTIONS, NEEDS, initNeeds } from './columns.ts';
import { emotionPatches } from './emotions.ts';
import { NEEDS_SYSTEMS } from './index.ts';

const PROFILE = TEST_PROFILE;

/** Rutina mínima de prueba: duerme de 22 a 6, trabaja de 8 a 17, come y se lava en sus horas; el resto, libre. */
const testRoutine: System = {
  id: 'prueba.rutina',
  phase: 'needs',
  order: -1,
  capability: 'needs',
  cadence: 'tick',
  minLevel: 0,
  run: (view, ctx) => {
    const h = Math.floor((ctx.now % MINUTES_PER_DAY) / 60);
    const sick = (row: number) => view.components.u8['health.acute']![row]! > 0;
    return {
      patches: ctx.citizens.flatMap((row) => {
        const kind = sick(row) ? 'sick' : h >= 22 || h < 6 ? 'sleep' : h >= 8 && h < 17 ? 'work' : h === 7 || h === 12 || h === 19 ? 'eat' : h === 6 ? 'wash' : 'leisure';
        const out = [{ op: 'set', type: 'u8', column: ACTIVITY_COLUMN, row, value: ACTIVITY[kind] } as const];
        // Comer repone el hambre (lo hará la acción `eat` de la 017).
        return kind === 'eat' ? [...out, { op: 'set', type: 'f32', column: 'need.hunger', row, value: 0.95 } as const] : out;
      }),
    };
  },
};

function worldWith(people: { neuroticism?: number; energyFactor?: number }[], seed = 1): World {
  const { world } = createWorld(testConfig({ initialCapabilities: ['clock', 'needs'], profile: PROFILE, seed }));
  const c = world.components;
  defineColumn(c, 'i32', 'demo.birthMinute', 0);
  defineColumn(c, 'i32', 'money', 500000);
  for (const col of ['pers.neuroticism', 'pers.extraversion', 'pers.resilience']) defineColumn(c, 'f32', col, 0.5);
  for (const p of people) {
    const id = addCitizen(world);
    const row = Number(id.slice(4));
    c.i32['demo.birthMinute']![row] = -35 * 365 * MINUTES_PER_DAY;
    if (p.neuroticism !== undefined) c.f32['pers.neuroticism']![row] = p.neuroticism;
  }
  initNeeds(world, createRng(seed));
  people.forEach((p, k) => {
    if (p.energyFactor !== undefined) c.f32['health.energyFactor']![k + 1] = p.energyFactor;
  });
  return world;
}

/** Sonda: guarda cada hora los valores de cada persona. */
function probe(log: Map<number, Record<string, number>[]>): System {
  return {
    id: 'prueba.sonda',
    phase: 'end_of_day',
    order: 9,
    capability: 'needs',
    cadence: 'hour',
    minLevel: 0,
    run: (view, ctx) => {
      for (const row of ctx.citizens) {
        const f = view.components.f32;
        const snap: Record<string, number> = { at: ctx.now };
        for (const k of [...NEEDS, ...EMOTIONS, 'state.stress', 'state.mood']) snap[k] = f[k]![row]!;
        log.set(row, [...(log.get(row) ?? []), snap]);
      }
      return {};
    },
  };
}

/** `guard`: vista congelada (021 CA-005). Es lenta (≈ 100 veces), así que la prueba de un año va sin ella. */
const runnerFor = (world: World, log: Map<number, Record<string, number>[]>, seed = 1, guard = true) =>
  new Runner(world, createRng(seed), {}, { systems: createRegistry([...NEEDS_SYSTEMS, testRoutine, probe(log)]), loop: { guard } });
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

describe('spec 010: necesidades, emociones y salud del día a día', () => {
  it('initNeeds: rangos del prototipo y línea base del ánimo por estabilidad emocional', () => {
    const w = worldWith([{ neuroticism: 0.2 }, { neuroticism: 0.8 }]);
    const f = w.components.f32;
    for (const row of [1, 2]) {
      expect(f['need.hunger']![row]).toBeGreaterThanOrEqual(0.65);
      expect(f['state.stress']![row]).toBeLessThanOrEqual(0.35);
    }
    expect(f['state.moodBaseline']![1]).toBeGreaterThan(f['state.moodBaseline']![2]!);
  });

  it('CA-003: 30 días con la vista congelada; todo en [0,1] y sin NaN; mismo hash con la misma semilla', () => {
    const log = new Map<number, Record<string, number>[]>();
    const w = worldWith([{}, { neuroticism: 0.9 }, { neuroticism: 0.1 }]);
    runnerFor(w, log).advanceDays(30);
    for (const rows of log.values())
      for (const s of rows) for (const [k, v] of Object.entries(s)) if (k !== 'at') expect(v >= 0 && v <= 1 && !Number.isNaN(v), k).toBe(true);
    const again = worldWith([{}, { neuroticism: 0.9 }, { neuroticism: 0.1 }]);
    runnerFor(again, new Map()).advanceDays(30);
    expect(stateHash(again)).toBe(stateHash(w));
  });

  it('CA-004 y 031 CA-006: con EPOC (energía × 1,3) la energía media de 7 días es menor', () => {
    const log = new Map<number, Record<string, number>[]>();
    const w = worldWith([{ energyFactor: 1 }, { energyFactor: 1.3 }]);
    runnerFor(w, log).advanceDays(7);
    const energy = (row: number) => mean(log.get(row)!.map((s) => s['need.energy']!));
    expect(energy(2)).toBeLessThan(energy(1));
  });

  it('CA-005 y 009 CA-004: perder el empleo sube tristeza y miedo ese día y el estrés de las 4 semanas siguientes, más con neuroticismo alto', () => {
    const log = new Map<number, Record<string, number>[]>();
    const w = worldWith([{ neuroticism: 0.2 }, { neuroticism: 0.8 }]);
    const runner = runnerFor(w, log);
    runner.advanceDays(28);
    for (const row of [1, 2]) {
      setOccupation(w, formatId('CIT', row), { kind: 'none', reason: 'unemployed', since: w.now });
      applyPatches(w, emotionPatches(w, row, 'JOB_LOST'), 'prueba');
    }
    expect(w.components.f32['emo.sadness']![2]).toBeGreaterThan(w.components.f32['emo.sadness']![1]!); // neuroticismo
    runner.advanceDays(28);
    const cut = 28 * MINUTES_PER_DAY;
    const stressDelta = (row: number) => {
      const s = log.get(row)!;
      return mean(s.filter((x) => x.at! > cut).map((x) => x['state.stress']!)) - mean(s.filter((x) => x.at! <= cut).map((x) => x['state.stress']!));
    };
    expect(stressDelta(1)).toBeGreaterThan(0);
    expect(stressDelta(2)).toBeGreaterThan(stressDelta(1));
    const firstHour = (row: number) => log.get(row)!.find((x) => x.at! > cut)!;
    expect(firstHour(1)['emo.sadness']).toBeGreaterThan(0.2);
    expect(firstHour(1)['emo.fear']).toBeGreaterThan(0.2);
  });

  it('R-007: enfermedades agudas con FELL_ILL y RECOVERED; la persona enferma descansa; incidencia plausible en un año', () => {
    // 30 personas × medio año, sin la vista congelada (es ≈ 100 veces más lenta); tasa anual = eventos × 2 / 30.
    const w = worldWith(Array.from({ length: 30 }, () => ({})), 3);
    const runner = runnerFor(w, new Map(), 3, false);
    runner.advanceDays(182);
    const events: WorldEvent[] = runner.drainEvents();
    const ill = events.filter((e) => e.type === 'FELL_ILL');
    const rec = events.filter((e) => e.type === 'RECOVERED');
    const perYear = (ill.length * 2) / 30;
    expect(perYear).toBeGreaterThan(1.5);
    expect(perYear).toBeLessThan(8);
    expect(rec.length).toBeGreaterThanOrEqual(ill.length - 30); // cada enfermo se recupera (salvo los del final)
    for (const e of ill) expect(e.causes.length).toBeGreaterThan(0);
  }, 60_000);

  it('R-004: la deuda de sueño suma lo que faltó respecto a las horas de la ficha', () => {
    const w = worldWith([{}]);
    defineColumn(w.components, 'u8', 'health.sleepHours', 8);
    const awake: System = { ...testRoutine, id: 'prueba.insomnio', order: 0, run: (_v, ctx) => ({ patches: ctx.citizens.map((row) => ({ op: 'set', type: 'u8', column: ACTIVITY_COLUMN, row, value: ACTIVITY.idle }) as const) }) };
    new Runner(w, createRng(1), {}, { systems: createRegistry([...NEEDS_SYSTEMS, awake]) }).advanceDays(2);
    expect(w.components.i32['state.sleepDebt']![1]).toBe(2 * 8 * 60);
  });
});
