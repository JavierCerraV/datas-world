// Menores acompañados sobre el mundo generado (spec 011 v0.3, R-007; CA-006): en 7 días de vida diaria, ningún menor
// de 12 años pasa más de un tick seguido fuera de su vivienda y de su colegio sin un adulto de su hogar en el mismo
// lugar (el tick que tarda en reaccionar cuando el adulto se va y él decide volver).
import { ACTIVITY, ACTIVITY_COLUMN, idNumber } from '@datas-world/engine';
import type { World } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from './country/profile.ts';
import { generateWorld } from './generate.ts';
import { lifeRunner } from './life.ts';
import { catalogs } from './testing.ts';

const YEAR = 365.25 * 1440;
const DAY = 1440;

/** Los menores de 12 años que están, ahora, fuera de casa y del colegio, quietos y sin un adulto de su hogar. */
function aloneKids(w: World): string[] {
  const i = w.components.i32;
  const u = w.components.u8;
  const out: string[] = [];
  for (const c of w.citizens.values()) {
    if (c.ancestor || c.status !== 'active') continue;
    const row = idNumber(c.id);
    if ((w.now - (i['demo.birthMinute']?.[row] ?? 0)) / YEAR >= 12) continue;
    const place = i['loc.place']?.[row] ?? 0;
    const home = c.householdId ? idNumber(w.households.get(c.householdId)!.dwellingId) : 0;
    if (!place || place === home || (i['trip.to']?.[row] ?? 0) > 0) continue;
    const act = u[ACTIVITY_COLUMN]?.[row] ?? 0;
    if (act === ACTIVITY.study || act === ACTIVITY.sick || act === ACTIVITY.sleep) continue;
    const kin = (c.householdId ? w.households.get(c.householdId)!.memberIds : []).filter((m) => m !== c.id);
    const guarded = kin.some((m) => w.citizens.get(m)?.status === 'active' && (w.now - (i['demo.birthMinute']?.[idNumber(m)] ?? 0)) / YEAR >= 18 && (i['loc.place']?.[idNumber(m)] ?? 0) === place && (i['trip.to']?.[idNumber(m)] ?? 0) === 0);
    if (!guarded) out.push(c.id);
  }
  return out;
}

describe('011 CA-006: menores acompañados en el mundo generado', () => {
  it('7 días: ningún niño de menos de 12 años está solo fuera de casa y del colegio más de un tick seguido', () => {
    const { world } = generateWorld({ seed: 482917, profileId: DEFAULT_PROFILE, population: 100, catalogs });
    const runner = lifeRunner(world, catalogs);
    const ticks = Math.round((7 * DAY) / world.config.tickMinutes);
    const run = new Map<string, number>();
    let longest = 0;
    for (let t = 0; t < ticks; t++) {
      runner.advanceTicks(1);
      const now = new Set(aloneKids(world));
      for (const id of [...run.keys()]) if (!now.has(id)) run.delete(id);
      for (const id of now) {
        const n = (run.get(id) ?? 0) + 1;
        run.set(id, n);
        longest = Math.max(longest, n);
      }
    }
    expect(longest).toBeLessThanOrEqual(1);
  }, 240_000);
});
