// Spec 047 §5 (CA-003, CA-004, INV-001, INV-002): el protocolo entra al mundo como entradas externas validadas que dejan
// eventos con causas; una entrada inválida no cambia nada.
import { describe, expect, it } from 'vitest';
import { defineColumn } from '../components.ts';
import { createOntology } from '../functions/sensitivity.ts';
import { emptyStore } from '../functions/types.ts';
import type { FunctionStore } from '../functions/types.ts';
import { stateHash } from '../serialize.ts';
import { AVOIDANCE_W0, PRIVATE_DEFAULTS, SELF_RESPONSE } from '../private/params.ts';
import { responseStrength } from '../private/pnr.ts';
import { TEST_PROFILE, testConfig } from '../testing.ts';
import { applyExternalInput } from '../tick.ts';
import { addHousehold, addPerson, addPlace, createWorld } from '../world.ts';
import type { World } from '../world.ts';
import { ACT_PNR_3 } from './act-pnr-3.ts';
import { protocolInputs } from './inputs.ts';
import { sessionOf } from './tracker.ts';

const onto = createOntology([{ key: 'dominio.familia', kind: 'verbal_term', features: [1, 0] }, { key: 'verbal.deuda', kind: 'verbal_term', features: [0, 1] }]);
const handlers = protocolInputs({ onto });

function person() {
  const { world } = createWorld(testConfig({ epoch: '2027-02-01T00:00', initialCapabilities: ['clock', 'needs', 'routines', 'learning'], profile: TEST_PROFILE, seed: 3 }));
  defineColumn(world.components, 'f32', 'state.stress', 0.2);
  defineColumn(world.components, 'f32', 'need.energy', 0.9);
  const dwelling = addPlace(world, { kind: 'vivienda.unidad', name: 'Vivienda', openingHours: null });
  const h = addHousehold(world, { template: 'single', dwellingId: dwelling });
  const id = addPerson(world, { name: { given: 'Ana', family: ['Rojas', 'Gómez'] }, sex: 'F', birthplace: 'co.cali', householdId: h });
  const store: FunctionStore = { ...emptyStore(), f: [{ s: 'dominio.familia', v: 0.4, c: '', inh: [], hab: 0, n: 5, rs: [], o: 'direct', src: [], at: 0 }] };
  Object.assign(world.citizens.get(id)!, { functions: store });
  world.now = 10 * 60;
  return { world, id };
}
let seq = 0;
const send = (world: World, kind: string, payload: unknown) => applyExternalInput(world, { seq: ++seq, at: world.now, kind, payload }, handlers);
const yo = (world: World, id: string) => responseStrength(world.citizens.get(id as never)?.functions as FunctionStore | undefined, SELF_RESPONSE, PRIVATE_DEFAULTS.selfW0);
const s1 = sessionOf(ACT_PNR_3, 1);
const exchanges = (stance: string) => s1.components.flatMap((c) => Array.from({ length: c.minTurns }, () => ({ component: c.id, stance })));

describe('047 §5: protocol_session', () => {
  it('con la persona presente deja PROTOCOL_SESSION con su dosis y cambia el «Yo» y la evitación (CA-003)', () => {
    const { world, id } = person();
    const r = send(world, 'protocol_session', { citizenId: id, protocol: 'act-pnr-3', session: 1, attended: true, fidelity: 1, exchanges: exchanges('abrirse') });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const e = r.events.find((x) => x.type === 'PROTOCOL_SESSION')!;
    const p = e.payload as { attended: boolean; engagement: number; dose: { yo: number }; yo: { from: number; to: number }; avoidance: { from: number; to: number } };
    expect(p).toMatchObject({ attended: true, engagement: 1 });
    expect(p.dose.yo).toBeGreaterThan(0);
    expect(p.yo.to).toBeGreaterThan(p.yo.from);
    expect(p.avoidance.to).toBeLessThan(AVOIDANCE_W0);
    expect(yo(world, id)).toBeCloseTo(p.yo.to, 3);
    // Tiene causa: la entrada externa aplicada.
    expect(e.causes.some((c) => 'event' in c)).toBe(true);
    expect(e.participants?.[0]?.id).toBe(id);
  });

  it('con posturas evasivas, o si no asistió, queda el evento pero el mundo de la persona no cambia (CA-004, INV-001)', () => {
    for (const payload of [{ attended: true, exchanges: exchanges('evadir') }, { attended: false, exchanges: [] }]) {
      const { world, id } = person();
      const before = JSON.stringify(world.citizens.get(id as never)?.functions);
      const r = send(world, 'protocol_session', { citizenId: id, protocol: 'act-pnr-3', session: 1, fidelity: 0.5, ...payload });
      expect(r.ok).toBe(true);
      expect(JSON.stringify(world.citizens.get(id as never)?.functions)).toBe(before);
      if (r.ok) expect((r.events.find((x) => x.type === 'PROTOCOL_SESSION')!.payload as { dose: unknown }).dose).toEqual({ yo: 0, extincion: 0, valores: 0 });
    }
  });

  it('una entrada inválida se rechaza sin cambiar nada', () => {
    const { world, id } = person();
    const hash = stateHash(world);
    for (const bad of [
      { citizenId: 'CIT-999999', protocol: 'act-pnr-3', session: 1, attended: true, fidelity: 1, exchanges: [] },
      { citizenId: id, protocol: 'otro', session: 1, attended: true, fidelity: 1, exchanges: [] },
      { citizenId: id, protocol: 'act-pnr-3', session: 9, attended: true, fidelity: 1, exchanges: [] },
      { citizenId: id, protocol: 'act-pnr-3', session: 1, attended: true, fidelity: 1, exchanges: 'no' },
    ]) expect(send(world, 'protocol_session', bad).ok).toBe(false);
    expect(stateHash(world)).toBe(hash);
  });
});

describe('047 R-006: protocol_practice y protocol_end', () => {
  it('practicar depende del día y de la persona: es reproducible, deja PRACTICE_DONE solo si practicó y entonces da media dosis', () => {
    const run = () => {
      const { world, id } = person();
      const out: boolean[] = [];
      for (let day = 0; day < 40; day++) {
        world.now = 10 * 60 + day * 1440;
        const r = send(world, 'protocol_practice', { citizenId: id, trials: { yo: 1, extincion: 1, valores: 1 } });
        expect(r.ok).toBe(true);
        if (r.ok) out.push(r.events.some((e) => e.type === 'PRACTICE_DONE'));
      }
      return { out, yo: yo(world, id) };
    };
    const a = run();
    expect(run()).toEqual(a);
    const done = a.out.filter(Boolean).length;
    expect(done).toBeGreaterThan(5);
    expect(done).toBeLessThan(40);
    expect(a.yo).toBeGreaterThan(PRIVATE_DEFAULTS.selfW0);
  });

  it('protocol_end deja PROTOCOL_ENDED con el motivo', () => {
    const { world, id } = person();
    const r = send(world, 'protocol_end', { citizenId: id, reason: 'completo' });
    expect(r.ok && r.events.some((e) => e.type === 'PROTOCOL_ENDED' && (e.payload as { reason: string }).reason === 'completo')).toBe(true);
    expect(send(world, 'protocol_end', { citizenId: id, reason: '' }).ok).toBe(false);
  });
});
