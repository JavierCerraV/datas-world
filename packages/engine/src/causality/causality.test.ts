import { describe, expect, it } from 'vitest';
import { makeEvent } from '../events.ts';
import type { NewEvent, WorldEvent } from '../events.ts';
import type { Counters, EntityId } from '../ids.ts';
import { createRng } from '../rng.ts';
import type { TickCtx, WorldView } from '../simulation/system.ts';
import type { Citizen } from '../world.ts';
import { createOriginsSystem, originCause, sleepCauses } from './origins.ts';
import type { StateOrigins } from './origins.ts';
import { walk, why, whyLines } from './why.ts';

const DAY = 1440;
const A = 'CIT-000001' as EntityId;
const counters = (): Counters => ({ EVT: 0 }) as unknown as Counters;

/** Un registro en memoria: crea eventos con `makeEvent` y los busca por id. */
function log() {
  const c = counters();
  const all = new Map<string, WorldEvent>();
  const add = (at: number, e: NewEvent) => {
    const x = makeEvent(c, at, e);
    all.set(x.id, x);
    return x;
  };
  return { add, get: (id: string) => all.get(id), c };
}
const me = [{ id: A, role: 'persona' }];

describe('019 R-002: nada del futuro', () => {
  it('CA-002: makeEvent rechaza una causa que no es anterior al evento nuevo', () => {
    const { add } = log();
    const first = add(0, { type: 'OVERSLEPT', payload: { citizenId: A, minutes: 30 }, participants: me, causes: [{ state: 'deuda_de_sueno', weight: 1 }] });
    expect(() => add(10, { type: 'OVERSLEPT', payload: { citizenId: A, minutes: 30 }, participants: me, causes: [{ event: 'EVT-00000000005' as EntityId, weight: 1 }] })).toThrow(/019 R-002/);
    expect(add(10, { type: 'OVERSLEPT', payload: { citizenId: A, minutes: 30 }, participants: me, causes: [{ event: first.id, weight: 1 }] }).causes).toHaveLength(1);
  });
});

describe('019 R-004: why', () => {
  /** La cadena de CA-001: una noche de series → se queda dormido → llega tarde → advertencia → despido. */
  function chain() {
    const l = log();
    const series = l.add(-DAY + 60, { type: 'LEISURE_DONE', payload: { citizenId: A, activity: 'series', name: 'Ver series', placeId: 'PLC-0001', with: [] }, participants: me, causes: [{ state: 'fuente.reforzador:actividad.series', entity: A, value: 0.4, weight: 1 }] });
    const overslept = l.add(7 * 60, { type: 'OVERSLEPT', payload: { citizenId: A, minutes: 50 }, participants: me, causes: [{ state: 'deuda_de_sueno', entity: A, value: 180, weight: 0.5 }, { event: series.id, weight: 0.5 }, { state: 'energia', entity: A, value: 0.2, weight: 0.3 }] });
    const late = l.add(8 * 60, { type: 'ARRIVED_LATE', payload: { citizenId: A, minutes: 40, placeId: 'PLC-0002' }, participants: me, causes: [{ event: overslept.id, weight: 0.7 }, { state: 'duracion_viaje', entity: A, value: 30, weight: 0.3 }] });
    const warning = l.add(9 * 60, { type: 'JOB_WARNING', payload: { citizenId: A, orgId: 'ORG-0001', reason: 'llegadas tarde', count: 3 }, participants: me, causes: [{ event: late.id, weight: 1 }] });
    const lost = l.add(10 * 60, { type: 'JOB_LOST', payload: { citizenId: A, reason: 'llegadas tarde' }, participants: me, causes: [{ event: warning.id, weight: 1 }] });
    return { ...l, series, lost };
  }

  it('CA-001: el despido se explica hasta la falta de sueño y la noche que se lo quitó', () => {
    const { get, lost, series } = chain();
    const tree = why(get, lost.id, { depth: 5 })!;
    const nodes = [...walk(tree)].map((x) => x.n);
    expect(nodes.some((n) => n.ref === 'deuda_de_sueno')).toBe(true);
    expect(nodes.some((n) => n.ref === series.id)).toBe(true);
    const lines = whyLines(tree);
    expect(lines[0]).toMatch(/JOB|pierde|empleo|despid/i);
    expect(lines.some((l) => l.includes('venía durmiendo poco'))).toBe(true);
  });

  it('CA-005: el mismo registro da el mismo árbol; respeta la profundidad, el peso mínimo y el tope de nodos', () => {
    const { get, lost } = chain();
    expect(JSON.stringify(why(get, lost.id))).toBe(JSON.stringify(why(get, lost.id)));
    const shallow = why(get, lost.id, { depth: 2 })!;
    expect(Math.max(...[...walk(shallow)].map((x) => x.d))).toBe(2);
    const few = why(get, lost.id, { depth: 6, maxNodes: 3 })!;
    expect([...walk(few)].length).toBe(3);
    // Con peso mínimo alto solo queda la causa principal de cada nivel.
    const main = why(get, lost.id, { depth: 6, minWeight: 0.9 })!;
    for (const { n } of walk(main)) expect(n.children.length).toBeLessThanOrEqual(1);
  });

  it('R-006: una fuente de control se sigue hasta los hechos que formaron hoy esa función', () => {
    const l = log();
    const hired = l.add(0, { type: 'JOB_HIRED', payload: { citizenId: A, orgId: 'ORG-0001', orgName: 'La Tienda', positionId: 'p' }, participants: me, causes: [{ state: 'vacante', weight: 1 }] });
    const act = l.add(100, { type: 'LEISURE_DONE', payload: { citizenId: A, activity: 'series', name: 'Ver series', placeId: 'PLC-0001', with: [] }, participants: me, causes: [{ state: 'fuente.valor:verbal.trabajo', entity: A, value: 0.3, weight: 1 }] });
    const view = { citizens: new Map([[A, { id: A, functions: { f: [{ s: 'verbal.trabajo', v: 0.5, c: '', inh: [], hab: 0, n: 3, rs: [], o: 'direct', src: [hired.id], at: 0 }], r: [], pruned: 0 } }]]) } as unknown as WorldView;
    const tree = why(l.get, act.id, { view })!;
    const source = tree.children[0]!;
    expect(source.kind).toBe('source');
    expect(source.children[0]!.ref).toBe(hired.id);
    expect(source.children[0]!.text).toContain('origen actual');
  });
});

describe('019 R-005: origen de los estados', () => {
  const viewOf = (origins: StateOrigins = {}): WorldView =>
    ({
      citizens: new Map([[A, { id: A, status: 'active', origins } as Citizen]]), households: new Map(),
      components: { i32: { 'routine.bed': [0, 22 * 60], 'routine.wakeW': [0, 6 * 60] }, f32: {}, u8: {} },
    }) as unknown as WorldView;
  const ev = (id: number, type: string, at: number) => ({ id: `EVT-${String(id).padStart(11, '0')}`, type, at, payload: { citizenId: A }, participants: me, causes: [], importance: 0.3, origin: 'engine' }) as unknown as WorldEvent;
  const run = (view: WorldView, events: WorldEvent[], now: number) =>
    createOriginsSystem().run(view, { now, citizens: [1], level: () => 3, events } as TickCtx, createRng(1));

  it('apunta y borra: el despido abre el desempleo y el empleo nuevo lo cierra; lo de la noche le quita el sueño', () => {
    const out = run(viewOf(), [ev(5, 'JOB_LOST', 100), ev(6, 'LEISURE_DONE', DAY + 23 * 60), ev(7, 'LEISURE_DONE', DAY + 15 * 60)], DAY + 23 * 60);
    const o = (out.patches![0] as unknown as { fields: { origins: StateOrigins } }).fields.origins;
    expect(o.desempleo?.event).toBe('EVT-00000000005');
    expect(o.dinero?.event).toBe('EVT-00000000005');
    expect(o.sueno?.event).toBe('EVT-00000000006'); // a las 23:00, dentro de su horario de sueño; el de las 15:00 no
    const later = run(viewOf(o), [ev(9, 'JOB_HIRED', 10 * DAY)], 10 * DAY);
    expect((later.patches![0] as unknown as { fields: { origins: StateOrigins } }).fields.origins.desempleo).toBeUndefined();
  });

  it('cita el hecho vigente con el peso del estado; sin nada detrás, la deuda de sueño es por su horario', () => {
    const view = viewOf({ sueno: { event: 'EVT-00000000006' as EntityId, at: DAY }, conflicto: { event: 'EVT-00000000004' as EntityId, at: 0 } });
    expect(originCause(view, 1, ['sueno'], 2 * DAY, 0.5)).toEqual([{ event: 'EVT-00000000006', weight: 0.5 }]);
    expect(originCause(view, 1, ['sueno'], 10 * DAY, 0.5)).toEqual([]); // fuera de su ventana (3 días)
    expect(originCause(view, 1, ['conflicto', 'sueno'], 2 * DAY, 0.3)).toEqual([{ event: 'EVT-00000000006', weight: 0.3 }]); // el más reciente
    expect(sleepCauses(viewOf(), 1, DAY, 120, 0.5).map((c) => ('state' in c ? c.state : c.event))).toEqual(['deuda_de_sueno', 'horario_de_sueno']);
    expect(sleepCauses(viewOf(), 1, DAY, 0, 0.5)).toHaveLength(1);
  });
});
