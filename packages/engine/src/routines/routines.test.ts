import { describe, expect, it } from 'vitest';
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import type { ActivityKind } from '../activity.ts';
import { MINUTES_PER_DAY, daysFromCivil } from '../calendar.ts';
import { defineColumn } from '../components.ts';
import { hire, setOccupation } from '../employment.ts';
import { initNeeds } from '../needs/columns.ts';
import { needsSystem } from '../needs/system.ts';
import { sleepSystem } from '../needs/illness.ts';
import { createRng } from '../rng.ts';
import { Runner } from '../runner.ts';
import { stateHash } from '../serialize.ts';
import { createRegistry } from '../simulation/registry.ts';
import type { System } from '../simulation/system.ts';
import { TEST_PROFILE, testConfig } from '../testing.ts';
import { addCitizen, addOrganization, addPlace, createWorld } from '../world.ts';
import type { Shift, World } from '../world.ts';
import { initRoutines } from './columns.ts';
import { dayInfo } from './day.ts';
import { oversleepFactor, routinesSystem } from './system.ts';

type Kind = 'formal' | 'unemployed' | 'student' | 'informal';
const EPOCH = '2027-02-01T00:00'; // lunes, en calendario escolar
const TICK = 5;
const DAY = MINUTES_PER_DAY;
const OFFICE: Shift = { days: 'mon-fri', start: 480, end: 1020, lunch: 60 };

/** Mundo de prueba: una persona por entrada, con su situación y, si es formal, su turno. Sin enfermedades (sin eventos). */
function build(people: { kind: Kind; shift?: Shift }[], opts: { holidays?: string[]; seed?: number } = {}): World {
  const { world } = createWorld(
    testConfig({ epoch: EPOCH, initialCapabilities: ['clock', 'needs', 'routines'], profile: TEST_PROFILE, holidays: opts.holidays ?? [], seed: opts.seed ?? 1 }),
  );
  const c = world.components;
  defineColumn(c, 'i32', 'demo.birthMinute', 0);
  defineColumn(c, 'i32', 'money', 500000);
  defineColumn(c, 'u8', 'demo.student', 0);
  defineColumn(c, 'u8', 'health.sleepHours', 8);
  for (const col of ['pers.neuroticism', 'pers.extraversion', 'pers.resilience', 'pers.conscientiousness', 'pers.impulsivity'])
    defineColumn(c, 'f32', col, 0.5);
  const formal = people.filter((p) => p.kind === 'formal');
  const office = addPlace(world, { kind: 'servicios.oficina', name: 'Oficinas' });
  const org = formal.length
    ? addOrganization(world, {
        name: 'Oficinas',
        sector: 'ciiu.7020',
        placeIds: [office],
        positions: formal.map((p) => ({ title: 'Oficinista', level: 0, occupation: 'ciuo.4110', wage: 1_750_905, wagePeriod: 'month' as const, shift: p.shift ?? OFFICE })),
        culture: { strictness: 0.5, warmth: 0.5, stability: 0.5 },
      })
    : undefined;
  let pos = 0;
  for (const p of people) {
    const id = addCitizen(world);
    const row = Number(id.slice(4));
    c.i32['demo.birthMinute']![row] = (p.kind === 'student' ? -10 : -35) * 365 * DAY;
    if (p.kind === 'formal') hire(world, id, org!, `${org}/P${String(++pos).padStart(2, '0')}`);
    else if (p.kind === 'informal') setOccupation(world, id, { kind: 'informal', trade: 'ventas' });
    else setOccupation(world, id, { kind: 'none', reason: p.kind === 'student' ? 'student' : 'unemployed', since: 0 });
    if (p.kind === 'student') c.u8['demo.student']![row] = 1;
  }
  const rng = createRng(opts.seed ?? 1);
  initNeeds(world, rng);
  initRoutines(world, rng);
  return world;
}

/** Sonda: la actividad de cada persona en cada tick, indexada por `minuto / tick`. */
function probe(log: Map<number, number[]>): System {
  return {
    id: 'prueba.sonda',
    phase: 'end_of_day',
    order: 9,
    capability: 'routines',
    cadence: 'tick',
    minLevel: 0,
    run: (view, ctx) => {
      for (const row of ctx.citizens) {
        const acts = log.get(row) ?? [];
        acts[ctx.now / TICK] = view.components.u8[ACTIVITY_COLUMN]![row]!;
        log.set(row, acts);
      }
      return {};
    },
  };
}

const runner = (world: World, log: Map<number, number[]>, extra: System[] = [], guard = false) =>
  new Runner(world, createRng(1), {}, { systems: createRegistry([needsSystem, sleepSystem, routinesSystem, probe(log), ...extra]), loop: { guard } });

/** Ticks del día `d` en [desde, hasta) con alguna de las actividades. */
const count = (acts: number[], d: number, from: number, to: number, kinds: ActivityKind[]) => {
  let n = 0;
  for (let m = from; m < to; m += TICK) if (kinds.some((k) => acts[(d * DAY + m) / TICK] === ACTIVITY[k])) n++;
  return n;
};

describe('spec 011: rutinas', () => {
  it('CA-001: un empleado formal está en su trabajo ≥ 90 % de su turno en días hábiles (el almuerzo del turno cuenta)', () => {
    const log = new Map<number, number[]>();
    const w = build([{ kind: 'formal' }, { kind: 'formal', shift: { days: 'mon-sat', start: 360, end: 900, lunch: 45 } }]);
    runner(w, log).advanceDays(6);
    for (const [row, shift] of [[1, OFFICE], [2, { start: 360, end: 900 }]] as const)
      for (let d = 0; d < 5; d++) {
        const total = (shift.end - shift.start) / TICK;
        expect(count(log.get(row)!, d, shift.start, shift.end, ['work', 'eat']) / total).toBeGreaterThanOrEqual(0.9);
      }
    expect(count(log.get(2)!, 5, 360, 900, ['work'])).toBeGreaterThan(0); // turno de lunes a sábado
    expect(count(log.get(1)!, 5, 480, 1020, ['work'])).toBe(0);
  });

  it('CA-002: con hambre < 0,1 se interrumpe un bloque flexible para comer, pero no el turno', () => {
    const log = new Map<number, number[]>();
    const w = build([{ kind: 'unemployed' }, { kind: 'formal' }]);
    const r = runner(w, log);
    r.advanceTicks((15 * 60) / TICK); // lunes 15:00
    const f = w.components.f32;
    f['need.hunger']![1] = 0.05;
    f['need.hunger']![2] = 0.05;
    r.advanceTicks(1);
    expect(w.components.u8[ACTIVITY_COLUMN]![1]).toBe(ACTIVITY.eat);
    expect(w.components.u8[ACTIVITY_COLUMN]![2]).toBe(ACTIVITY.work);
  });

  it('CA-003: los desempleados buscan empleo los días hábiles y no el fin de semana', () => {
    const log = new Map<number, number[]>();
    const w = build(Array.from({ length: 5 }, () => ({ kind: 'unemployed' as const })));
    runner(w, log).advanceDays(7);
    for (const acts of log.values()) {
      for (let d = 0; d < 5; d++) expect(count(acts, d, 0, DAY, ['job_search'])).toBeGreaterThan(0);
      for (const d of [5, 6]) expect(count(acts, d, 0, DAY, ['job_search'])).toBe(0);
    }
  });

  it('CA-004: en un festivo no hay colegio ni trabajo de turno; Semana Santa y vacaciones del calendario A', () => {
    const log = new Map<number, number[]>();
    const w = build([{ kind: 'student' }, { kind: 'formal' }], { holidays: ['2027-02-03'] }); // miércoles festivo
    runner(w, log).advanceDays(4);
    const [student, worker] = [log.get(1)!, log.get(2)!];
    for (const d of [1, 3]) {
      expect(count(student, d, 0, DAY, ['study'])).toBeGreaterThan(0);
      expect(count(worker, d, 0, DAY, ['work'])).toBeGreaterThan(0);
    }
    expect(count(student, 2, 0, DAY, ['study'])).toBe(0);
    expect(count(worker, 2, 0, DAY, ['work'])).toBe(0);

    const holy = build([], { holidays: ['2027-03-25', '2027-03-26'] }); // Jueves y Viernes Santo de 2027
    const at = (y: number, m: number, d: number) => (daysFromCivil(y, m, d) - daysFromCivil(2027, 2, 1)) * DAY + 600;
    expect(dayInfo(holy, at(2027, 3, 22)).schoolDay).toBe(false); // lunes santo
    expect(dayInfo(holy, at(2027, 3, 29)).schoolDay).toBe(true);
    expect(dayInfo(holy, at(2027, 6, 21)).schoolDay).toBe(false); // vacaciones de mitad de año
    expect(dayInfo(holy, at(2027, 12, 6)).schoolDay).toBe(false); // vacaciones de fin de año
    expect(dayInfo(holy, at(2027, 3, 28)).restDay).toBe(true); // domingo
  });

  it('CA-005: 100 personas × 1 semana; el almuerzo de quienes trabajan cae entre las 12:00 y las 14:00 en ≥ 90 % de los días hábiles', () => {
    const starts = [360, 420, 480, 540];
    const people = Array.from({ length: 100 }, (_, k) =>
      k < 60
        ? { kind: 'formal' as const, shift: { days: k % 3 ? ('mon-fri' as const) : ('mon-sat' as const), start: starts[k % 4]!, end: starts[k % 4]! + 540, lunch: 60 } }
        : { kind: 'informal' as const },
    );
    const log = new Map<number, number[]>();
    const w = build(people);
    runner(w, log).advanceDays(7);
    let ok = 0;
    let days = 0;
    for (const acts of log.values())
      for (let d = 0; d < 5; d++) {
        days++;
        if (count(acts, d, 12 * 60, 14 * 60, ['eat']) >= 30 / TICK) ok++;
      }
    expect(ok / days).toBeGreaterThanOrEqual(0.9);
  }, 60_000);

  it('determinismo con la vista congelada (021 CA-005): misma semilla, mismo hash', () => {
    const a = build([{ kind: 'formal' }, { kind: 'student' }, { kind: 'unemployed' }]);
    const b = build([{ kind: 'formal' }, { kind: 'student' }, { kind: 'unemployed' }]);
    runner(a, new Map(), [], true).advanceDays(3);
    runner(b, new Map(), [], true).advanceDays(3);
    expect(stateHash(a)).toBe(stateHash(b));
  });
});

describe('spec 010 CA-001: quedarse dormido', () => {
  // Insomnio forzado los días 0 y 1 (lunes y martes); la noche del miércoles al jueves se mide el despertar.
  const insomnia: System = {
    id: 'prueba.insomnio',
    phase: 'decision',
    order: 1,
    capability: 'routines',
    cadence: 'tick',
    minLevel: 0,
    run: (_v, ctx) =>
      ctx.now < 2 * DAY ? { patches: [{ op: 'setMany', type: 'u8', column: ACTIVITY_COLUMN, rows: [...ctx.citizens], values: ctx.citizens.map(() => ACTIVITY.idle) }] } : {},
  };

  it('040 CA-006 (R-010): con más descuento, más exceso de sueño por falta de energía; OVERSLEPT cita el descuento', () => {
    expect(oversleepFactor(0.02)).toBeCloseTo(0.39, 2);
    expect(oversleepFactor(0.2)).toBeCloseTo(0.8, 2);
    expect(oversleepFactor(2)).toBeCloseTo(1.21, 2);
    const w = build(Array.from({ length: 20 }, () => ({ kind: 'formal' as const })));
    const r = runner(w, new Map(), [insomnia]);
    r.advanceDays(4);
    const events = r.drainEvents().filter((e) => e.type === 'OVERSLEPT');
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) expect(e.causes.some((c) => 'state' in c && c.state === 'descuento')).toBe(true);
  }, 60_000);

  it('sin dormir 2 noches, más del 50 % se queda dormido al día siguiente (con OVERSLEPT y sus causas)', () => {
    const n = 40;
    const late = (extra: System[]) => {
      const w = build(Array.from({ length: n }, () => ({ kind: 'formal' as const })));
      const r = runner(w, new Map(), extra);
      r.advanceDays(4);
      const events = r.drainEvents().filter((e) => e.type === 'OVERSLEPT' && e.at >= 3 * DAY);
      for (const e of events) expect(e.causes.length).toBe(3);
      return new Set(events.map((e) => (e.payload as { citizenId: string }).citizenId)).size / n;
    };
    const deprived = late([insomnia]);
    expect(deprived).toBeGreaterThan(0.5);
    expect(late([])).toBeLessThan(deprived);
  }, 60_000);
});
