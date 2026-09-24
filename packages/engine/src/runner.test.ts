import { describe, expect, it } from 'vitest';
import { createRng } from './rng.ts';
import { Runner } from './runner.ts';
import { deserializeWorld, serializeWorld, stateHash } from './serialize.ts';
import { schedule } from './scheduler.ts';
import { applyExternalInput, tick } from './tick.ts';
import { createWorld } from './world.ts';
import { testConfig } from './testing.ts';
import type { ScheduledHandler } from './tick.ts';

const newRunner = (over = {}) => {
  const { world } = createWorld(testConfig(over));
  return new Runner(world, createRng(world.config.seed));
};

describe('Tick (spec 002)', () => {
  it('avanza tickMinutes y emite DAY_STARTED al llegar a medianoche', () => {
    const { world } = createWorld(testConfig());
    const rng = createRng(1);
    for (let i = 0; i < 287; i++) expect(tick(world, rng)).toEqual([]);
    const events = tick(world, rng);
    expect(world.now).toBe(1440);
    expect(events.map((e) => [e.type, e.payload])).toEqual([['DAY_STARTED', { date: '2027-01-05' }]]);
  });

  it('procesa el scheduler en orden (at, id) con su manejador', () => {
    const { world } = createWorld(testConfig());
    const seen: string[] = [];
    const handlers: Record<string, ScheduledHandler> = { NOTE: (_w, item) => (seen.push(item.id), []) };
    schedule(world.scheduler, { at: 10, id: 'TSK-000000002', kind: 'NOTE', payload: null });
    schedule(world.scheduler, { at: 10, id: 'TSK-000000001', kind: 'NOTE', payload: null });
    schedule(world.scheduler, { at: 5, id: 'TSK-000000003', kind: 'NOTE', payload: null });
    tick(world, createRng(1), handlers);
    tick(world, createRng(1), handlers);
    expect(seen).toEqual(['TSK-000000003', 'TSK-000000001', 'TSK-000000002']);
  });

  it('falla si vence un elemento sin manejador', () => {
    const { world } = createWorld(testConfig());
    schedule(world.scheduler, { at: 5, id: 'TSK-000000001', kind: 'UNKNOWN', payload: null });
    expect(() => tick(world, createRng(1))).toThrow(/UNKNOWN/);
  });
});

describe('Entradas externas y capacidades (spec 001 R-007, 023 R-004)', () => {
  it('CA-006: activar memory sin relationships se rechaza y no cambia el hash', () => {
    const { world } = createWorld(testConfig());
    const h = stateHash(world);
    const r = applyExternalInput(world, {
      at: 0,
      seq: 0,
      kind: 'enable_capability',
      payload: { capability: 'memory' },
    });
    expect(r.ok).toBe(false);
    expect(stateHash(world)).toBe(h);
  });

  it('CA-007: activar relationships desde la misma instantánea da el mismo hash y el evento con causa', () => {
    const cfg = testConfig({ initialCapabilities: ['clock', 'needs', 'routines', 'economy', 'mobility'] });
    const base = new Runner(createWorld(cfg).world, createRng(cfg.seed));
    base.advanceDays(2);
    const snap = JSON.stringify(serializeWorld(base.world));
    const run = () => {
      const r = new Runner(deserializeWorld(JSON.parse(snap)), createRng(cfg.seed));
      const events = r.submit('enable_capability', { capability: 'relationships' }).events;
      r.advanceDays(1);
      return { hash: stateHash(r.world), events, caps: r.world.capabilities };
    };
    const a = run();
    const b = run();
    expect(a.hash).toBe(b.hash);
    expect(a.caps).toContain('relationships');
    const [input, enabled] = a.events;
    expect(input?.type).toBe('EXTERNAL_INPUT_APPLIED');
    expect(enabled?.type).toBe('CAPABILITY_ENABLED');
    expect(enabled?.causes).toEqual([{ event: input?.id, weight: 1 }]);
  });

  it('close emite WORLD_CLOSED con el minuto y el hash previo, sin cambiar el estado del mundo', () => {
    const r = newRunner();
    r.resume('arranque');
    r.advanceDays(1);
    const before = stateHash(r.world);
    const [applied, closed] = r.submit('close', { reason: 'SIGTERM' }).events;
    expect(closed!.type).toBe('WORLD_CLOSED');
    expect(closed!.payload).toEqual({ minute: 1440, hash: before, reason: 'SIGTERM' });
    expect(closed!.causes).toEqual([{ event: applied!.id, weight: 1 }]);
    expect(r.world.status).toBe('running');
  });

  it('continueInputsAfter sigue la numeración de las entradas del minuto actual', () => {
    const a = newRunner();
    a.pause();
    const last = a.submit('close', {}).input;
    const b = new Runner(deserializeWorld(serializeWorld(a.world)), createRng(a.world.config.seed));
    b.continueInputsAfter(last);
    expect(b.resume().length).toBe(2);
    expect(b.inputs()[0]).toMatchObject({ at: 0, seq: 2 });
    const c = newRunner();
    c.continueInputsAfter({ at: -5, seq: 9 }); // de otro minuto: no afecta
    c.pause();
    expect(c.inputs()[0]!.seq).toBe(0);
  });

  it('rechaza entradas con un minuto distinto del actual o de tipo desconocido', () => {
    const { world } = createWorld(testConfig());
    expect(applyExternalInput(world, { at: 5, seq: 0, kind: 'pause', payload: {} }).ok).toBe(false);
    expect(applyExternalInput(world, { at: 0, seq: 0, kind: 'nope', payload: {} }).ok).toBe(false);
  });
});

describe('Runner (spec 002)', () => {
  it('CA-004: "paso" avanza exactamente un tick y deja el mundo en pausa', () => {
    const r = newRunner();
    r.resume();
    r.step();
    expect(r.world.now).toBe(5);
    expect(r.world.status).toBe('paused');
  });

  it('CA-005: avanzar 365 días termina en < 2 s y emite 365 DAY_STARTED', { timeout: 2000 }, () => {
    const r = newRunner();
    r.advanceDays(365);
    const days = r.drainEvents().filter((e) => e.type === 'DAY_STARTED');
    expect(days.length).toBe(365);
    expect(r.world.now).toBe(365 * 1440);
  });

  it('en pausa o a velocidad 0 el tiempo real no avanza el mundo', () => {
    const r = newRunner();
    expect(r.onRealTime(60_000)).toBe(0);
    r.resume();
    r.setSpeed(0);
    expect(r.onRealTime(60_000)).toBe(0);
  });

  it('acumula la fracción de tick entre llamadas (R-008)', () => {
    const r = newRunner();
    r.resume();
    r.setSpeed(1); // 1 min de mundo por segundo real; tick = 5 min
    expect(r.onRealTime(3000)).toBe(0);
    expect(r.onRealTime(3000)).toBe(1);
    expect(r.world.now).toBe(5);
  });
});

describe('Determinismo del reloj y del replay (specs 002, 023)', () => {
  it('determinismo: CA-002 (002) el mismo mundo 7 días a 1x y a 1000x da el mismo hash', () => {
    const slow = newRunner();
    slow.resume();
    slow.setSpeed(1);
    while (slow.world.now < 7 * 1440) slow.onRealTime(60_000); // 60 s reales = 60 min de mundo a 1x
    const fast = newRunner();
    fast.resume();
    fast.setSpeed(1000);
    while (fast.world.now < 7 * 1440) fast.onRealTime(1_008); // 1008 min de mundo por llamada: divide 10 080
    expect(slow.world.now).toBe(fast.world.now);
    expect(stateHash(slow.world)).toBe(stateHash(fast.world));
  });

  it('determinismo: dos ejecuciones con la misma semilla dan el mismo hash tras 30 días', () => {
    const a = newRunner();
    const b = newRunner();
    a.advanceDays(30);
    b.advanceDays(30);
    expect(stateHash(a.world)).toBe(stateHash(b.world));
  });

  it('determinismo: CA-004 y CA-006 (023) el replay con las entradas registradas reproduce el hash', () => {
    const cfg = testConfig({ initialCapabilities: ['clock', 'needs'] });
    const { world } = createWorld(cfg);
    const day0 = JSON.stringify(serializeWorld(world));
    const live = new Runner(world, createRng(cfg.seed));
    live.resume();
    live.advanceDays(10);
    live.submit('enable_capability', { capability: 'relationships' });
    live.setSpeed(100);
    live.advanceDays(20);
    live.pause();
    const recorded = live.inputs();

    const replay = new Runner(deserializeWorld(JSON.parse(day0)), createRng(cfg.seed));
    replay.enqueueReplay(recorded);
    replay.advanceDays(30);
    replay.flushReplay();
    expect(replay.world.now).toBe(30 * 1440);
    expect(stateHash(replay.world)).toBe(stateHash(live.world));
    expect(replay.world.capabilities).toContain('relationships');
  });
});
