// El esparcimiento en la vida diaria (032 R-006 con el motor de decisiones 017) sobre el mundo generado.
import {
  NEEDS_SYSTEMS,
  Runner,
  createActionValidator,
  createDecisionSystem,
  createRegistry,
  createRng,
  idNumber,
  mobilitySystem,
  routinesSystem,
} from '@datas-world/engine';
import type { WorldEvent } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '../country/profile.ts';
import { buildWorld, catalogs } from '../testing.ts';
import { leisureTable } from './params.ts';

describe('032 R-006: una semana de esparcimiento en Data\'s World (perfil colombiano, 200 habitantes)', () => {
  it('las aficiones de la ficha se practican con su frecuencia, con el explain como causa; la diversión ni se desploma ni se satura', () => {
    const { world, pop } = buildWorld(DEFAULT_PROFILE, 482917);
    world.capabilities = ['clock', 'needs', 'routines', 'mobility'];
    const table = leisureTable(catalogs.leisure_activities, world.config.profile!, world.config.epoch.slice(0, 10));
    const runner = new Runner(world, createRng(1), {}, {
      systems: createRegistry([...NEEDS_SYSTEMS, routinesSystem, createDecisionSystem(table), mobilitySystem]),
      loop: { validate: createActionValidator(table) },
    });
    runner.advanceDays(7);
    const events: WorldEvent[] = runner.drainEvents();
    const done = events.filter((e) => e.type === 'LEISURE_DONE');
    for (const e of done) {
      const p = e.payload as { citizenId: string; activity: string };
      expect(world.citizens.get(p.citizenId as never)!.leisure!.some((x) => x.key === p.activity)).toBe(true);
      expect(e.causes.length).toBeGreaterThan(0);
    }
    const people = new Set(done.map((e) => (e.payload as { citizenId: string }).citizenId));
    const fun = pop.citizenIds.map((id) => world.components.f32['need.fun']![idNumber(id)]!);
    const meanFun = fun.reduce((s, x) => s + x, 0) / fun.length;
    // La frecuencia sale de la ficha (`perMonth`, con `lastDone`): lo hecho en la semana, entre 0,7 y 2 veces lo esperado.
    let expected = 0;
    for (const id of pop.citizenIds) for (const x of world.citizens.get(id)!.leisure ?? []) expected += (x.perMonth * 7) / 30;
    expect(done.length / expected).toBeGreaterThan(0.7);
    expect(done.length / expected).toBeLessThan(2);
    expect(people.size / pop.citizenIds.length).toBeGreaterThan(0.5);
    expect(meanFun).toBeGreaterThan(0.3);
    expect(meanFun).toBeLessThan(0.95);
  }, 120_000);
});
