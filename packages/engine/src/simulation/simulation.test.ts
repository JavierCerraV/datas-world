import { describe, expect, it } from 'vitest';
import { defineColumn } from '../components.ts';
import { createRng } from '../rng.ts';
import { Runner } from '../runner.ts';
import { stateHash } from '../serialize.ts';
import { testConfig } from '../testing.ts';
import { addCitizen, createWorld } from '../world.ts';
import type { World } from '../world.ts';
import { createRegistry } from './registry.ts';
import type { Phase, System } from './system.ts';

/** Mundo con 3 personas y una columna `x` (f32). */
function world3(caps: string[] = ['clock', 'needs']): World {
  const { world } = createWorld(testConfig({ initialCapabilities: caps as never }));
  defineColumn(world.components, 'f32', 'x', 0);
  for (let i = 0; i < 3; i++) addCitizen(world);
  return world;
}

/** Sistema que anota los números aleatorios que recibe. */
function recorder(id: string, phase: Phase, log: number[], capability: System['capability'] = 'needs'): System {
  return {
    id,
    phase,
    order: 0,
    capability,
    cadence: 'tick',
    minLevel: 0,
    run: (_v, _ctx, rng) => {
      log.push(rng.next());
      return {};
    },
  };
}

describe('spec 021: bucle de sistemas', () => {
  it('CA-004: registrar un sistema en una fase intermedia no cambia el azar de los demás', () => {
    const run = (withC: boolean) => {
      const a: number[] = [];
      const b: number[] = [];
      const systems = [recorder('a', 'needs', a), recorder('b', 'economy', b)];
      if (withC) systems.push(recorder('c', 'actions', []));
      const runner = new Runner(world3(), createRng(7), {}, { systems: createRegistry(systems) });
      runner.advanceTicks(10);
      return { a, b };
    };
    expect(run(true)).toEqual(run(false));
  });

  it('CA-005: un sistema que intenta modificar el mundo hace fallar la prueba (vista congelada)', () => {
    const bad = (mutate: (w: World) => void): System => ({
      ...recorder('malo', 'needs', []),
      run: (view) => {
        mutate(view as unknown as World);
        return {};
      },
    });
    const attempts: ((w: World) => void)[] = [
      (w) => {
        w.now = 99;
      },
      (w) => {
        w.components.f32.x![1] = 1;
      },
      (w) => {
        w.citizens.delete('CIT-000001');
      },
      (w) => {
        (w.citizens.get('CIT-000001') as { status: string }).status = 'x';
      },
    ];
    for (const m of attempts) {
      const runner = new Runner(world3(), createRng(1), {}, { systems: createRegistry([bad(m)]), loop: { guard: true } });
      expect(() => runner.advanceTicks(1)).toThrow(/R-007/);
    }
  });

  it('CA-006: sin la capacidad, el sistema no corre; al activarla, corre desde el tick siguiente', () => {
    const log: number[] = [];
    const world = world3();
    const runner = new Runner(world, createRng(3), {}, { systems: createRegistry([recorder('rel', 'interactions', log, 'relationships')]) });
    runner.advanceTicks(3);
    expect(log).toHaveLength(0);
    runner.submit('enable_capability', { capability: 'relationships' });
    expect(log).toHaveLength(0);
    runner.advanceTicks(1);
    expect(log).toHaveLength(1);
  });

  it('R-007: los parches se aplican al final de la fase; la fase siguiente ya los ve', () => {
    const seen: number[] = [];
    const writer: System = { ...recorder('w', 'needs', []), run: () => ({ patches: [{ op: 'add', type: 'f32', column: 'x', row: 1, delta: 1 }] }) };
    const sameNeeds: System = { ...recorder('same', 'needs', []), order: 1, run: (v) => (seen.push(v.components.f32.x![1]!), {}) };
    const later: System = { ...recorder('later', 'economy', []), run: (v) => (seen.push(v.components.f32.x![1]!), {}) };
    const world = world3();
    new Runner(world, createRng(1), {}, { systems: createRegistry([writer, sameNeeds, later]) }).advanceTicks(1);
    expect(seen).toEqual([0, 1]);
    expect(world.components.f32.x![1]).toBe(1);
  });

  it('cadencias, eventos con causas y personas por nivel (R-011: en M2 todos en nivel 2)', () => {
    const calls: Record<string, number> = { tick: 0, hour: 0, day: 0, coarse: 0 };
    const sys = (cadence: System['cadence']): System => ({
      ...recorder(cadence, 'end_of_day', []),
      cadence,
      run: (_v, ctx) => {
        calls[cadence]!++;
        expect(ctx.citizens).toEqual([1, 2, 3]);
        return cadence === 'day' ? { events: [{ type: 'DAY_STARTED', payload: { date: '2027-01-05' }, causes: [{ state: 'prueba', weight: 1 }] }] } : {};
      },
    });
    const detailed: System = {
      ...recorder('detallado', 'memory', []),
      minLevel: 3,
      run: (_v, ctx) => (expect(ctx.citizens).toEqual([]), {}),
      runCoarse: (_v, ctx) => (calls.coarse!++, expect(ctx.citizens).toEqual([1, 2, 3]), {}),
    };
    const runner = new Runner(world3(), createRng(1), {}, { systems: createRegistry([sys('tick'), sys('hour'), sys('day'), detailed]) });
    runner.advanceDays(1);
    expect(calls).toEqual({ tick: 288, hour: 24, day: 1, coarse: 288 });
    expect(runner.drainEvents().filter((e) => e.type === 'DAY_STARTED')).toHaveLength(2); // el del reloj y el del sistema
  });

  it('R-005: ids repetidos, fases o capacidades desconocidas fallan al crear el registro', () => {
    expect(() => createRegistry([recorder('a', 'needs', []), recorder('a', 'economy', [])])).toThrow(/dos veces/);
    expect(() => createRegistry([{ ...recorder('b', 'needs', []), phase: 'bailar' as Phase }])).toThrow(/fase/);
    expect(() => createRegistry([recorder('c', 'needs', [], 'telepatia' as never)])).toThrow(/capacidad/);
    // INV-003: el orden no depende del orden de la lista.
    const x = [recorder('z', 'needs', []), recorder('b', 'decision', []), recorder('a', 'needs', [])];
    expect(createRegistry(x).systems.map((s) => s.id)).toEqual(createRegistry([...x].reverse()).systems.map((s) => s.id));
  });

  it('determinismo: un mundo sin sistemas da el mismo hash que antes del bucle (M0, M1)', () => {
    const a = world3();
    const b = world3();
    new Runner(a, createRng(5)).advanceDays(2);
    new Runner(b, createRng(5), {}, { systems: createRegistry([]) }).advanceDays(2);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('una acción sin validador es un error (017 llega en el bloque E)', () => {
    const actor: System = { ...recorder('act', 'decision', []), run: () => ({ actions: [{ actor: 'CIT-000001', kind: 'eat', reason: [] }] }) };
    expect(() => new Runner(world3(), createRng(1), {}, { systems: createRegistry([actor]) }).advanceTicks(1)).toThrow(/validador/);
  });
});
