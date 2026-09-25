// 007 CA-006: con el perfil de paridad, la población inicial se parece a la que genera el prototipo.
// Se ejecuta el propio generador del prototipo (`genWorld`) en un contexto aislado, como en 006 CA-003.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { idNumber } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { PROTOTYPE_PROFILE } from '../country/profile.ts';
import { ageOf, buildWorld } from '../testing.ts';

const SEEDS = Array.from({ length: 10 }, (_, i) => 100 + i);

interface Tally {
  n: number;
  age: number;
  minors: number;
  adults: number;
  money: number;
}
const empty = (): Tally => ({ n: 0, age: 0, minors: 0, adults: 0, money: 0 });
const add = (t: Tally, age: number, money: number) => {
  t.n++;
  t.age += age;
  if (age < 18) t.minors++;
  else {
    t.adults++;
    t.money += money;
  }
};

describe('007 CA-006: paridad de la población inicial con el prototipo (10 semillas, perfil prototipo)', () => {
  it('edad media ±2 años, menores ±0,03 y ahorro medio de los adultos ±15 % respecto a genWorld', () => {
    const html = readFileSync(join(import.meta.dirname, '..', '..', '..', '..', 'prototipo', 'index.html'), 'utf8');
    const code = html.match(/\/\*ENGINE-START\*\/([\s\S]*?)\/\*ENGINE-END\*\//)![1]!;
    const proto = empty();
    const ours = empty();
    for (const s of SEEDS) {
      const ctx = { module: { exports: {} as Record<string, unknown> }, console, Math, Map, Set, Object, Array, String, Number, JSON };
      vm.createContext(ctx);
      vm.runInContext(`${code}\nmodule.exports={W,genWorld};`, ctx);
      const E = ctx.module.exports as { W: { agents: { age: number; money: number }[] }; genWorld: (s: number) => void };
      E.genWorld(s);
      for (const a of E.W.agents) add(proto, a.age, a.money);
      const { world, pop } = buildWorld(PROTOTYPE_PROFILE, s);
      const money = world.components.i32.money!;
      for (const id of pop.citizenIds) add(ours, ageOf(world, id), money[idNumber(id)]!);
    }
    // Medido el 2026-09-24: prototipo 30,1 años · 0,386 · 2,18 M; motor 30,7 · 0,377 · 1,95 M.
    expect(Math.abs(ours.age / ours.n - proto.age / proto.n)).toBeLessThanOrEqual(2);
    expect(Math.abs(ours.minors / ours.n - proto.minors / proto.n)).toBeLessThanOrEqual(0.03);
    const [a, b] = [ours.money / ours.adults, proto.money / proto.adults];
    expect(Math.abs(a - b) / b).toBeLessThanOrEqual(0.15);
  });
});
