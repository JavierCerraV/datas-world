import { idNumber, profileValue } from '@datas-world/engine';
import type { World } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, PROTOTYPE_PROFILE, loadProfile } from '../country/profile.ts';
import { ageOf, buildWorld, catalogs } from '../testing.ts';
import { expectedSpend, leisureBudget } from './generate.ts';
import { leisureParams } from './params.ts';
import type { ActivityAttrs } from './params.ts';
import { learnedColumn, offerOf, reachOf } from './select.ts';

const profile = loadProfile(DEFAULT_PROFILE);
const P = leisureParams(profile, '2026-01-01')!;
const attrs = new Map(catalogs.leisure_activities.entries.map((e) => [e.key, e.attrs as unknown as ActivityAttrs]));

describe('spec 032: ficha de esparcimiento de un mundo (perfil colombiano)', () => {
  const { world, pop, events } = buildWorld(DEFAULT_PROFILE, 482917);
  const byId = new Map(events.map((e) => [e.id, e]));
  const offer = offerOf(world);

  it('CA-001 e INV-001 a INV-003: actividades del catálogo, por edad y salud, con lugar posible; afinidad y frecuencia en rango; con su evento', () => {
    for (const id of pop.citizenIds) {
      const c = world.citizens.get(id)!;
      const age = ageOf(world, id);
      if (age < 3) {
        expect(c.leisure ?? []).toEqual([]);
        continue;
      }
      expect(c.leisure!.length).toBeGreaterThanOrEqual(P.count.min);
      expect(c.leisure!.length).toBeLessThanOrEqual(P.count.max);
      for (const x of c.leisure!) {
        const a = attrs.get(x.key)!;
        expect(a, x.key).toBeDefined();
        expect(age >= a.ageRange[0] && age <= a.ageRange[1]).toBe(true);
        expect(reachOf(a, offer)).not.toBe('none');
        expect(x.affinity >= 0 && x.affinity <= 1).toBe(true);
        expect(x.perMonth >= 0 && x.perMonth <= 30).toBe(true);
        const e = c.backstory!.map((b) => byId.get(b)!).find(
          (b) => b.type === 'LEISURE_TAKEN_UP' && (b.payload as { activity: string }).activity === x.key,
        );
        expect(e?.at).toBe(x.since);
        expect(x.since).toBeLessThan(0);
      }
    }
  });

  it('R-003: nadie con discapacidad para caminar o para el autocuidado tiene actividades de esfuerzo', () => {
    for (const id of pop.citizenIds) {
      const dis = world.components.u8['health.disability']![idNumber(id)]!;
      if (!(dis & (4 | 32))) continue;
      for (const x of world.citizens.get(id)!.leisure ?? []) expect(attrs.get(x.key)!.physical, x.key).toBe(0);
    }
  });

  it('CA-005: la misma semilla da la misma ficha', () => {
    const again = buildWorld(DEFAULT_PROFILE, 482917).world;
    for (const id of pop.citizenIds) expect(again.citizens.get(id)!.leisure).toEqual(world.citizens.get(id)!.leisure);
  });

  it('el perfil prototipo no tiene ficha de esparcimiento (paridad)', () => {
    const { world: w, pop: p } = buildWorld(PROTOTYPE_PROFILE, 482917);
    for (const id of p.citizenIds) expect(w.citizens.get(id)!.leisure).toBeUndefined();
  });
});

describe('spec 032: agregado de 20 mundos', () => {
  const rows: { ext: number; open: number; social: number; culture: number }[] = [];
  const spend = new Map<number, number[]>();
  const practice = new Map<string, number>();
  let n12 = 0;
  let overBudget = 0;
  const worlds: World[] = [];
  for (let s = 1; s <= 20; s++) {
    const { world, pop } = buildWorld(DEFAULT_PROFILE, s);
    worlds.push(world);
    for (const id of pop.citizenIds) {
      const L = world.citizens.get(id)!.leisure ?? [];
      if (ageOf(world, id) >= 12) {
        n12++;
        for (const x of L) practice.set(x.key, (practice.get(x.key) ?? 0) + 1);
      }
      if (ageOf(world, id) >= 18)
        rows.push({
          // 041 R-008 (MF7.3): lo aprendido en la historia ocupa el lugar de los rasgos (abrirse, valorar el conocimiento).
          ext: learnedColumn(world, id, 'conv.abrirse'),
          open: Math.max(learnedColumn(world, id, 'dominio.conocimiento'), learnedColumn(world, id, 'dominio.creatividad')),
          social: L.filter((x) => attrs.get(x.key)!.group === 'con_otros').length,
          culture: L.filter((x) => x.key.startsWith('cultura.') || x.key.startsWith('arte.')).length,
        });
      const h = world.households.get(world.citizens.get(id)!.householdId!)!;
      const stratum = world.places.get(world.places.get(h.dwellingId)!.districtId!)!.stratum!;
      const sp = expectedSpend(world, id, catalogs.leisure_activities, P);
      spend.set(stratum, [...(spend.get(stratum) ?? []), sp]);
      if (sp > leisureBudget(world, id, P) + 1) overBudget++;
    }
  }
  const corr = (xs: number[], ys: number[]) => {
    const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
    const my = ys.reduce((s, y) => s + y, 0) / ys.length;
    let sxy = 0,
      sxx = 0,
      syy = 0;
    xs.forEach((x, i) => {
      sxy += (x - mx) * (ys[i]! - my);
      sxx += (x - mx) ** 2;
      syy += (ys[i]! - my) ** 2;
    });
    return sxy / Math.sqrt(sxx * syy);
  };
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

  it('CA-002 (041 R-008): lo aprendido al abrirse se correlaciona con las actividades en compañía y valorar el conocimiento o la creatividad con las culturales y artísticas (r > 0,15)', () => {
    expect(corr(rows.map((r) => r.ext), rows.map((r) => r.social))).toBeGreaterThan(0.15);
    expect(corr(rows.map((r) => r.open), rows.map((r) => r.culture))).toBeGreaterThan(0.15);
  });

  it('CA-003: los estratos bajos gastan menos que el estrato 4, y nadie pasa de su presupuesto', () => {
    expect(mean(spend.get(2)!)).toBeLessThan(mean(spend.get(4)!));
    expect(overBudget).toBe(0);
  });

  it('CA-004: la práctica de las actividades con fuente oficial está a ±0,08 de su popularidad (DANE, ECC)', () => {
    const popularity = profileValue(profile, 'leisure.popularity', '2026-01-01') as Record<string, number>;
    for (const k of ['cultura.cine', 'cultura.lectura'])
      expect(Math.abs((practice.get(k) ?? 0) / n12 - popularity[k]!), k).toBeLessThanOrEqual(0.08);
  });
});
