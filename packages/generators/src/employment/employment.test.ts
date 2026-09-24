import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { profileNumber, stateHash } from '@datas-world/engine';
import type { EntityId } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, PROTOTYPE_PROFILE, loadProfile } from '../country/profile.ts';
import { ageOf, buildWorld } from '../testing.ts';
import { employmentProbability } from './generate.ts';

const seeds = (from: number, n = 20) => Array.from({ length: n }, (_, i) => from + i);

describe('spec 006/007: situación laboral de un mundo (perfil colombiano)', () => {
  const { world, pop, orgIds, events } = buildWorld(DEFAULT_PROFILE, 482917);
  const byId = new Map(events.map((e) => [e.id, e]));

  it('006 CA-002: cada puesto tiene como mucho un titular que lo referencia; cada organización con personal tiene jefe', () => {
    const holders = new Set<EntityId>();
    for (const orgId of orgIds) {
      const o = world.organizations.get(orgId)!;
      for (const p of o.positions) {
        if (!p.holderId) continue;
        expect(holders.has(p.holderId)).toBe(false);
        holders.add(p.holderId);
        expect(world.citizens.get(p.holderId)!.occupation).toEqual({ kind: 'formal', orgId, positionId: p.id });
      }
      if (o.positions.some((p) => p.holderId)) expect(o.positions[0]!.holderId, o.name).toBeDefined();
    }
    for (const id of pop.citizenIds) {
      const occ = world.citizens.get(id)!.occupation!;
      if (occ.kind === 'formal') expect(holders.has(id)).toBe(true);
    }
  });

  it('los menores de 15 no trabajan y los de 15 a 17 nunca tienen un puesto formal', () => {
    for (const id of pop.citizenIds) {
      const a = ageOf(world, id);
      const occ = world.citizens.get(id)!.occupation!;
      if (a < 15) expect(occ.kind).toBe('none');
      if (a < 18) expect(occ.kind).not.toBe('formal');
    }
  });

  it('007 CA-003: la situación laboral de cada adulto ocupado, desocupado o pensionado la explica un evento de su trayectoria', () => {
    const expected: Record<string, string> = {
      formal: 'JOB_HIRED',
      informal: 'INFORMAL_WORK_STARTED',
      independent: 'INFORMAL_WORK_STARTED',
    };
    for (const id of pop.citizenIds) {
      if (ageOf(world, id) < 18) continue;
      const c = world.citizens.get(id)!;
      const occ = c.occupation!;
      const types = c.backstory!.map((e) => byId.get(e)!.type);
      if (occ.kind !== 'none') expect(types, id).toContain(expected[occ.kind]);
      else if (occ.reason === 'unemployed') expect(types).toContain('JOB_LOST');
      else if (occ.reason === 'pensioned') expect(types).toContain('RETIRED');
      let prev = -Infinity;
      for (const e of c.backstory!) {
        expect(byId.get(e)!.at).toBeGreaterThanOrEqual(prev);
        expect(byId.get(e)!.at).toBeLessThan(0);
        prev = byId.get(e)!.at;
      }
    }
  });

  it('employmentProbability usa el tramo de edad más alto alcanzado', () => {
    const t = { '15': 0.1, '18': 0.6, '65': 0.2 };
    expect([14, 15, 17, 18, 64, 65, 90].map((a) => employmentProbability(t, a))).toEqual([
      0, 0.1, 0.1, 0.6, 0.6, 0.2, 0.2,
    ]);
  });

  it('determinismo: el mundo completo da el mismo hash con la misma semilla', () => {
    expect(stateHash(buildWorld(DEFAULT_PROFILE, 482917).world)).toBe(stateHash(world));
  });
});

describe('006 CA-001: mercado laboral agregado de 20 mundos', () => {
  const tally = (profileId: string, list: number[]) => {
    let pet = 0,
      emp = 0,
      informal = 0,
      unemp = 0,
      a1864 = 0,
      e1864 = 0;
    const perWorld: number[] = [];
    for (const s of list) {
      const { world, pop } = buildWorld(profileId, s);
      let wp = 0,
        we = 0;
      for (const id of pop.citizenIds) {
        const a = ageOf(world, id);
        const occ = world.citizens.get(id)!.occupation!;
        const employed = occ.kind !== 'none';
        if (a >= 18 && a < 65) {
          a1864++;
          if (employed) e1864++;
        }
        if (a < 15) continue;
        pet++;
        wp++;
        if (employed) {
          emp++;
          we++;
          if (occ.kind !== 'formal') informal++;
        } else if (occ.reason === 'unemployed') unemp++;
      }
      perWorld.push(we / wp);
    }
    return { to: emp / pet, td: unemp / (emp + unemp), informality: informal / emp, e1864: e1864 / a1864, perWorld };
  };

  it('perfil colombiano: ocupación (15+) y desempleo a ±0,03 de la GEIH; informalidad entre 13 ciudades y el total nacional; cada pueblo a ±0,10', () => {
    const co = loadProfile(DEFAULT_PROFILE);
    const at = '2026-01-01';
    const r = tally(DEFAULT_PROFILE, seeds(1));
    expect(Math.abs(r.to - profileNumber(co, 'labor.employmentRate', at))).toBeLessThanOrEqual(0.03);
    expect(Math.abs(r.td - profileNumber(co, 'labor.unemploymentRate', at))).toBeLessThanOrEqual(0.03);
    expect(r.informality).toBeGreaterThanOrEqual(profileNumber(co, 'labor.informality', at, '13ciudades'));
    expect(r.informality).toBeLessThanOrEqual(profileNumber(co, 'labor.informality', at));
    for (const v of r.perWorld)
      expect(Math.abs(v - profileNumber(co, 'labor.employmentRate', at))).toBeLessThanOrEqual(0.1);
  });

  it('perfil prototipo: la ocupación de 18 a 64 años está en 0,86 ± 0,04 y no hay informalidad', () => {
    const r = tally(PROTOTYPE_PROFILE, seeds(1));
    expect(Math.abs(r.e1864 - 0.86)).toBeLessThanOrEqual(0.04);
    expect(r.informality).toBe(0);
  });
});

describe('006 CA-003: paridad del empleo con el prototipo (10 semillas, perfil prototipo)', () => {
  it('el reparto del empleo formal por tipo de lugar está a ±0,06 del que genera genJobs del prototipo', () => {
    const html = readFileSync(join(import.meta.dirname, '..', '..', '..', '..', 'prototipo', 'index.html'), 'utf8');
    const code = html.match(/\/\*ENGINE-START\*\/([\s\S]*?)\/\*ENGINE-END\*\//)![1]!;
    const MAP: Record<string, string> = {
      oficina: 'servicios.oficina',
      hospital: 'salud.hospital',
      colegio: 'educacion.colegio',
      fabrica: 'industria.fabrica',
      tienda: 'comercio.tienda_barrio',
      cafe: 'ocio.cafe',
      restaurante: 'ocio.restaurante',
      gimnasio: 'ocio.gimnasio',
    };
    const proto: Record<string, number> = {};
    for (const s of seeds(100, 10)) {
      const ctx = {
        module: { exports: {} as Record<string, unknown> },
        console,
        Math,
        Map,
        Set,
        Object,
        Array,
        String,
        Number,
        JSON,
      };
      vm.createContext(ctx);
      vm.runInContext(`${code}\nmodule.exports={W,genWorld};`, ctx);
      const E = ctx.module.exports as {
        W: { agents: { job: { org: number } | null }[]; places: { type: string }[] };
        genWorld: (s: number) => void;
      };
      E.genWorld(s);
      for (const a of E.W.agents)
        if (a.job) proto[MAP[E.W.places[a.job.org]!.type]!] = (proto[MAP[E.W.places[a.job.org]!.type]!] ?? 0) + 1;
    }
    const ours: Record<string, number> = {};
    for (const s of seeds(100, 10)) {
      const { world, pop } = buildWorld(PROTOTYPE_PROFILE, s);
      for (const id of pop.citizenIds) {
        const occ = world.citizens.get(id)!.occupation!;
        if (occ.kind !== 'formal') continue;
        const kind = world.places.get(world.organizations.get(occ.orgId)!.placeIds[0]!)!.kind;
        ours[kind] = (ours[kind] ?? 0) + 1;
      }
    }
    const norm = (o: Record<string, number>) => {
      const t = Object.values(o).reduce((a, b) => a + b, 0);
      return (k: string) => (o[k] ?? 0) / t;
    };
    const [p, q] = [norm(proto), norm(ours)];
    for (const k of Object.values(MAP)) expect(Math.abs(p(k) - q(k)), k).toBeLessThanOrEqual(0.06);
  });
});
