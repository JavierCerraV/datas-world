// La vida diaria de M2 montada (bloque H): niveles de simulación (021 CA-001) y divergencia entre semillas
// (023 CA-002) sobre el mundo generado.
import { idNumber, stateHash } from '@datas-world/engine';
import type { World, WorldEvent } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from './country/profile.ts';
import { generateWorld } from './generate.ts';
import { LIFE_CAPABILITIES, lifeRunner } from './life.ts';
import { catalogs } from './testing.ts';

const YEAR = 365.25 * 1440;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const living = (w: World) => [...w.citizens.values()].filter((c) => !c.ancestor && c.status === 'active').map((c) => idNumber(c.id));
/** Patrimonio de los adultos: saldo − deudas + su parte del ahorro del hogar se ve en el total de hogares. */
const wealth = (w: World) =>
  living(w)
    .filter((r) => (w.now - w.components.i32['demo.birthMinute']![r]!) / YEAR >= 18)
    .reduce((s, r) => s + w.components.i32.money![r]! - (w.components.i32['econ.debt']?.[r] ?? 0), 0) +
  [...w.households.values()].reduce((s, h) => s + (h.savings ?? 0), 0);

describe('la vida diaria de M2 sobre el mundo generado (perfil colombiano, 100 personas)', () => {
  it('los mundos nuevos nacen con las capacidades de la vida diaria; los estáticos, solo con el reloj', () => {
    expect([...generateWorld({ seed: 1, population: 20, catalogs }).world.capabilities].sort()).toEqual([...LIFE_CAPABILITIES].sort());
    expect(generateWorld({ seed: 1, population: 20, catalogs, static: true }).world.capabilities).toEqual(['clock']);
  });

  it('021 CA-001: 30 días en nivel 1 frente a nivel 2: el ánimo medio y el gasto difieren menos del 5 %', () => {
    const run = (level: 1 | 2) => {
      const { world } = generateWorld({ seed: 482917, profileId: DEFAULT_PROFILE, population: 100, catalogs });
      const before = wealth(world);
      lifeRunner(world, catalogs, { level }).advanceDays(30);
      return { mood: mean(living(world).map((r) => world.components.f32['state.mood']![r]!)), spent: before - wealth(world), world };
    };
    const l1 = run(1);
    const l2 = run(2);
    expect(Math.abs(l1.mood - l2.mood) / l2.mood).toBeLessThan(0.05);
    // Gasto neto del pueblo = patrimonio inicial − final (el ingreso es igual en los dos niveles).
    expect(Math.abs(l1.spent - l2.spent) / Math.abs(l2.spent)).toBeLessThan(0.05);
  }, 120_000);

  it('023 CA-002: con las semillas S y S+1, tras 30 días los hashes difieren y más del 50 % de las personas tiene un día 30 distinto', () => {
    const day30 = (seed: number) => {
      const { world } = generateWorld({ seed, profileId: DEFAULT_PROFILE, population: 100, catalogs });
      const r = lifeRunner(world, catalogs);
      r.advanceDays(29);
      r.drainEvents();
      r.advanceDays(1);
      const events: WorldEvent[] = r.drainEvents();
      const byPerson = new Map<string, string[]>();
      for (const e of events) for (const p of e.participants) if (p.id.startsWith('CIT')) byPerson.set(p.id, [...(byPerson.get(p.id) ?? []), `${e.type}@${e.at}`]);
      return { world, byPerson, ids: living(world).map((r2) => `CIT-${String(r2).padStart(6, '0')}`) };
    };
    const a = day30(482917);
    const b = day30(482918);
    expect(stateHash(a.world)).not.toBe(stateHash(b.world));
    const ids = [...new Set([...a.ids, ...b.ids])];
    const differ = ids.filter((id) => JSON.stringify(a.byPerson.get(id) ?? []) !== JSON.stringify(b.byPerson.get(id) ?? [])).length;
    expect(differ / ids.length).toBeGreaterThan(0.5);
  }, 120_000);
});
