// Movilidad sobre el mundo generado (016 con 033): el paradero de la plaza, el viaje a La Capital y una semana
// de vida con las necesidades, la rutina y la movilidad.
import {
  NEEDS_SYSTEMS,
  Runner,
  TILE,
  createRegistry,
  createRng,
  homeOf,
  idNumber,
  mobilityParams,
  mobilitySystem,
  planTrip,
  routinesSystem,
  tileAt,
  vehiclesOf,
  workplaceOf,
} from '@datas-world/engine';
import type { System } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '../country/profile.ts';
import { ageOf, buildWorld } from '../testing.ts';

describe('016 y 033 sobre el mundo generado (perfil colombiano, 200 habitantes)', () => {
  const { world, pop } = buildWorld(DEFAULT_PROFILE, 482917);
  const places = [...world.places.values()];
  const stop = places.find((p) => p.kind === 'transporte.paradero')!;
  const plaza = places.find((p) => p.kind === 'espacio_publico.plaza')!;
  const cinema = places.find((p) => p.kind === 'ocio.cine')!;

  it('D1: el paradero intermunicipal está en la plaza, con la puerta sobre la calle', () => {
    expect(stop).toBeDefined();
    expect(stop.parentId).toBe(plaza.id);
    expect(tileAt(world.geo!, stop.door!.x, stop.door!.y)).toBe(TILE.road);
  });

  it('033 CA-006: quien va a cine en bus pasa por el paradero, tarda ≥ 2 × travel.minutes y paga 2 × travel.cost', () => {
    const P = mobilityParams(world.config.profile!, world.config.epoch.slice(0, 10));
    // Un adulto sin moto ni carro en el hogar: va en bus.
    const id = pop.citizenIds.find((c) => ageOf(world, c) >= 18 && ![...vehiclesOf(world, idNumber(c))].some((k) => k !== 'transporte.bicicleta'))!;
    const row = idNumber(id);
    const home = homeOf(world, row);
    const go = planTrip(world, row, home, idNumber(cinema.id), 15 * 60, createRng(1), P)!;
    const back = planTrip(world, row, idNumber(cinema.id), home, 15 * 60 + go.minutes + 150, createRng(2), P)!;
    expect([go.mode, back.mode]).toEqual(['bus', 'bus']);
    expect(go.via).toBe(idNumber(stop.id));
    expect(go.minutes + back.minutes).toBeGreaterThanOrEqual(2 * cinema.travel!.minutes);
    expect(go.cost + back.cost).toBe(2 * cinema.travel!.cost);
  });

  it('016 CA-004 y 004 R-003: una semana de vida; nadie viaja en moto ni en carro sin tenerlos, los empleados van a su trabajo y las llegadas tarde tienen causa', () => {
    const { world: w, pop: p } = buildWorld(DEFAULT_PROFILE, 482917);
    w.capabilities = ['clock', 'needs', 'routines', 'mobility'];
    const bad: string[] = [];
    const modes: System = {
      id: 'prueba.modos', phase: 'end_of_day', order: 9, capability: 'mobility', cadence: 'tick', minLevel: 0,
      run: (view, ctx) => {
        for (const row of ctx.citizens) {
          const mode = view.components.u8['trip.mode']![row]!; // 3 = moto, 4 = carro
          if (mode !== 3 && mode !== 4) continue;
          if (!vehiclesOf(view, row).has(mode === 3 ? 'transporte.moto' : 'transporte.carro')) bad.push(`${row}: ${mode}`);
        }
        return {};
      },
    };
    const atWork: number[] = [];
    const probe: System = {
      id: 'prueba.trabajo', phase: 'end_of_day', order: 10, capability: 'mobility', cadence: 'hour', minLevel: 0,
      run: (view, ctx) => {
        // Viernes 2 y lunes 5 de enero de 2026 a las 10:00: días hábiles.
        if (ctx.now !== 34 * 60 && ctx.now !== 4 * 1440 + 10 * 60) return {};
        const workers = p.citizenIds.map(idNumber).filter((r) => workplaceOf(view, r) > 0);
        atWork.push(workers.filter((r) => view.components.i32['loc.place']![r] === workplaceOf(view, r)).length / workers.length);
        return {};
      },
    };
    const runner = new Runner(w, createRng(1), {}, { systems: createRegistry([...NEEDS_SYSTEMS, routinesSystem, mobilitySystem, modes, probe]) });
    runner.advanceDays(7);
    expect(bad).toEqual([]);
    expect(atWork).toHaveLength(2);
    for (const share of atWork) expect(share).toBeGreaterThanOrEqual(0.8);
    for (const e of runner.drainEvents().filter((x) => x.type === 'ARRIVED_LATE')) expect(e.causes.length).toBeGreaterThan(0);
    // Sin deudas de sueño desbocadas (el reposo del enfermo cuenta como sueño, 010 R-004).
    const debt = w.components.i32['state.sleepDebt']!;
    for (const id of p.citizenIds) expect(debt[idNumber(id)]).toBeLessThan(24 * 60);
  }, 120_000);
});
