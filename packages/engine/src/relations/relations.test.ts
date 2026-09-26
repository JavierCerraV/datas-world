// Red relacional (spec 037): composición, transformación, claves contextuales, invariantes, métricas y enseñanza.
import { describe, expect, it } from 'vitest';
import type { WorldEvent } from '../events.ts';
import { idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import type { TickCtx, WorldView } from '../simulation/system.ts';
import { testConfig } from '../testing.ts';
import { addHousehold, addPerson, addPlace, createWorld } from '../world.ts';
import { INVERSE, compose, derive, functionalValue } from './derive.ts';
import { networkMetrics, teach } from './network.ts';
import { relationsSystem } from './system.ts';
import { MAX_RELATIONS, emptyNetwork } from './types.ts';
import type { RelationType, RelationalNetwork } from './types.ts';

const TYPES: RelationType[] = ['coordination', 'distinction', 'opposition', 'more', 'less', 'contains', 'part_of', 'causes', 'caused_by', 'before', 'after', 'deictic'];
const TRANSITIVE = ['more', 'less', 'contains', 'part_of', 'causes', 'caused_by', 'before', 'after'];

describe('037: derivación', () => {
  it('CA-001: la inversa de la inversa es la misma relación y la mutua se deriva para todos los tipos', () => {
    for (const t of TYPES) {
      expect(INVERSE[INVERSE[t]]).toBe(t);
      const net = emptyNetwork();
      teach(net, { a: 'A', b: 'B', t, s: 1, now: 0 });
      expect(derive(net, 'B').find((d) => d.to === 'A')!.t).toBe(INVERSE[t]);
    }
  });

  it('CA-001: tabla de composición para todos los pares de tipos (R-002)', () => {
    for (const x of TYPES)
      for (const y of TYPES) {
        const expected =
          x === 'coordination' ? y : y === 'coordination' ? x : x === 'opposition' && y === 'opposition' ? 'coordination' : x === y && TRANSITIVE.includes(x) ? x : null;
        expect(compose(x, y)).toBe(expected);
        // Y en la red: A x B, B y C ⇒ A (x∘y) C, o nada.
        const net = emptyNetwork();
        teach(net, { a: 'A', b: 'B', t: x, s: 1, now: 0 });
        teach(net, { a: 'B', b: 'C', t: y, s: 1, now: 1 });
        const toC = derive(net, 'A').filter((d) => d.to === 'C' && d.path.length === 2);
        expect(toC.map((d) => d.t)).toEqual(expected ? [expected] : []);
      }
  });

  it('INV-001: ninguna derivada supera la fuerza mínima de su camino; profundidad máxima 3', () => {
    const net = emptyNetwork();
    const chain = ['A', 'B', 'C', 'D', 'E'];
    chain.slice(1).forEach((b, k) => teach(net, { a: chain[k]!, b, t: 'coordination', s: 0.5 + 0.1 * k, now: k }));
    for (const d of derive(net, 'A')) expect(d.s).toBeLessThanOrEqual(Math.min(...d.path.map((k) => net.e[k]!.s)) + 1e-12);
    expect(derive(net, 'A').some((d) => d.to === 'E')).toBe(false); // 4 aristas
    expect(derive(net, 'A').some((d) => d.to === 'D')).toBe(true);
  });

  it('INV-002 e INV-003: con y sin memoria, y en dos llamadas, el resultado es el mismo', () => {
    const net = emptyNetwork();
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f'];
    let k = 0;
    for (const a of nodes) for (const b of nodes) if (a < b && (a.charCodeAt(0) + b.charCodeAt(0)) % 3 === 0) teach(net, { a, b, t: TYPES[k++ % TYPES.length]!, s: 0.8, now: k });
    const direct = (x: string) => (x === 'c' ? -0.6 : x === 'f' ? 0.4 : 0);
    const memo = new Map();
    for (const x of nodes) {
      expect(functionalValue(net, direct, x, '', memo)).toEqual(functionalValue(net, direct, x));
      expect(derive(net, x)).toEqual(derive(net, x));
    }
  });

  it('R-005 Crel: una relación con clave relacional solo participa en su contexto', () => {
    const net = emptyNetwork();
    teach(net, { a: 'A', b: 'B', t: 'coordination', s: 1, crel: 'casa', now: 0 });
    teach(net, { a: 'A', b: 'B', t: 'distinction', s: 1, crel: 'colegio', now: 1 });
    expect(derive(net, 'A', 'casa').map((d) => d.t)).toEqual(['coordination']);
    expect(derive(net, 'A', 'colegio').map((d) => d.t)).toEqual(['distinction']);
    expect(networkMetrics(net).flexibility).toBe(1);
  });

  it('R-004 Cfunc y R-006: con la clave funcional la transformación vale del todo; la directa mayor gana', () => {
    const net = emptyNetwork();
    teach(net, { a: 'X', b: 'Y', t: 'coordination', s: 1, cfunc: 'trabajo', now: 0 });
    const direct = (x: string) => (x === 'Y' ? -0.8 : 0);
    expect(functionalValue(net, direct, 'X', 'trabajo').value).toBeCloseTo(-0.8, 10);
    expect(functionalValue(net, direct, 'X', 'casa').value).toBeCloseTo(-0.4, 10);
    expect(functionalValue(net, (x) => (x === 'X' ? 0.9 : direct(x)), 'X', 'trabajo')).toEqual({ value: 0.9, source: 'direct' });
  });

  it('INV-004: la red no pasa del tope y cuenta lo podado; reforzar una relación la sube', () => {
    const net = emptyNetwork();
    for (let k = 0; k < MAX_RELATIONS + 10; k++) teach(net, { a: `n${k}`, b: `n${k + 1}`, t: 'coordination', s: 0.5, now: k });
    expect(net.e.length).toBe(MAX_RELATIONS);
    expect(net.pruned).toBe(10);
    const r = teach(net, { a: 'n600', b: 'n601', t: 'coordination', s: 0.5, now: 999 });
    const s0 = r.s;
    expect(teach(net, { a: 'n600', b: 'n601', t: 'coordination', s: 0.5, now: 1000 }).s).toBeCloseTo(s0 + 0.3 * (1 - s0), 10);
  });

  it('R-008: métricas de una red coherente y de una contradictoria', () => {
    const ok = emptyNetwork();
    teach(ok, { a: 'A', b: 'B', t: 'coordination', s: 1, now: 0 });
    teach(ok, { a: 'B', b: 'C', t: 'coordination', s: 1, now: 1 });
    expect(networkMetrics(ok)).toEqual({ coherence: 1, complexity: 2 / 3, derivationLevel: 1, flexibility: 0 });
    const bad = emptyNetwork();
    teach(bad, { a: 'A', b: 'B', t: 'coordination', s: 1, now: 0 });
    teach(bad, { a: 'A', b: 'B', t: 'opposition', s: 1, now: 1 });
    expect(networkMetrics(bad).coherence).toBeLessThan(1);
  });
});

describe('037 R-007: la comunidad verbal enseña en los eventos con hablante', () => {
  it('CA-005: una advertencia enseña llegar_tarde causes despido; con aversión al despido, llegar tarde se vuelve aversivo', () => {
    const { world } = createWorld(testConfig());
    const dwelling = addPlace(world, { kind: 'vivienda.unidad', name: 'Casa', openingHours: null });
    const h = addHousehold(world, { template: 'single', dwellingId: dwelling });
    const id = addPerson(world, { name: { given: 'Ana', family: ['Rojas', 'Gómez'] }, sex: 'F', birthplace: 'co.cali', householdId: h });
    const row = idNumber(id);
    const warning: WorldEvent = {
      id: 'EVT-00000000007' as EntityId,
      type: 'JOB_WARNING',
      at: 600,
      participants: [
        { id, role: 'empleado' },
        { id: 'ORG-0001' as EntityId, role: 'empleador' },
      ],
      importance: 0.5,
      payload: {},
      causes: [],
      origin: 'engine',
    };
    const ctx = { now: 600, citizens: [row], level: 2, events: [warning] } as unknown as TickCtx;
    const out = relationsSystem.run(world as unknown as WorldView, ctx, undefined as never);
    const patch = out.patches!.find((p) => p.op === 'entity')!;
    const network = (patch as { fields: Record<string, unknown> }).fields.network as RelationalNetwork;
    expect(network.e).toEqual([{ a: 'verbal.llegar_tarde', b: 'verbal.despido', t: 'causes', s: 0.6, o: 'taught', src: ['EVT-00000000007'], at: 600 }]);
    // Quien ya tiene aversión al despido (la dejó un JOB_LOST) deriva aversión a llegar tarde; quien no, no.
    const fired = (x: string) => (x === 'verbal.despido' ? -0.8 : 0);
    expect(functionalValue(network, fired, 'verbal.llegar_tarde').value).toBeCloseTo(-0.8 * 0.6 * 0.5, 10);
    expect(functionalValue(network, () => 0, 'verbal.llegar_tarde').value).toBe(0);
    // Sin evento de enseñanza, nada.
    expect(relationsSystem.run(world as unknown as WorldView, { ...ctx, events: [] } as TickCtx, undefined as never)).toEqual({});
  });
});
