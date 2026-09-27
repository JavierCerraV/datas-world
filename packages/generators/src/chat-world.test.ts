import { ACTIVITY, ACTIVITY_COLUMN, CHAT_UNTIL, REAL_TIME, deserializeWorld, serializeWorld, stateHash } from '@datas-world/engine';
import type { World } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { generateWorld } from './generate.ts';
import { lifeRunner } from './life.ts';

// Charla en un mundo que vive (spec 043 R-019 a R-022; bloque L3.3): el worker aplica `chat_open` y
// `chat_session` con los manejadores de `lifeRunner`; el replay las reinyecta.
const SANTIAGO = 'CIT-000019';
const row = 19;
const DAY = 1440;

/** Mundo de la semilla del proyecto, avanzado hasta las 18:00 del primer día (Santiago ya salió del trabajo). */
function eveningWorld(): World {
  const { world } = generateWorld({ seed: 482917 });
  const r = lifeRunner(world);
  r.resume('prueba');
  while (world.now % DAY !== 18 * 60) r.advanceTicks(1);
  return world;
}

const TURNS = [
  { tone: 'amable', stance: 'abrirse' },
  { tone: 'grosero', stance: 'poner_limite' },
  { tone: 'hostil', stance: 'terminar' },
];

describe('charla en el mundo (043 R-019 a R-022)', () => {
  it('abrir: la persona pasa a charlar y la rutina no la mueve; el resto del mundo sigue su curso', () => {
    const world = eveningWorld();
    const r = lifeRunner(world);
    const opened = r.submit('chat_open', { citizenId: SANTIAGO, visitorId: 'EXT-0001', sessionId: 'CHS-000001' }).events;
    const started = opened.find((e) => e.type === 'CONVERSATION_STARTED');
    expect(started, JSON.stringify(opened.map((e) => e.payload))).toBeDefined();
    const until = world.components.i32[CHAT_UNTIL]![row]!;
    expect(until).toBeGreaterThan(world.now);
    const events = [] as string[];
    for (let i = 0; i < 3 && world.now + 5 < until; i++) {
      r.advanceTicks(1);
      events.push(...r.drainEvents().map((e) => e.type));
      expect(world.components.u8[ACTIVITY_COLUMN]![row]).toBe(ACTIVITY.conversation);
    }
    expect(events.length).toBeGreaterThan(0); // los demás siguen generando eventos (CA-015)
  });

  it('cerrar: recuerdo, aprendizaje acotado y vuelta a su día; una entrada inválida se rechaza sin cambiar el mundo', () => {
    const world = eveningWorld();
    const r = lifeRunner(world);
    r.submit('chat_open', { citizenId: SANTIAGO, visitorId: 'EXT-0001', sessionId: 'CHS-000001' });
    r.advanceTicks(2);
    const hash = stateHash(world);
    expect(() => r.submit('chat_session', { sessionId: 'CHS-000001', citizenId: SANTIAGO, visitorId: 'EXT-0001', turns: [{ tone: 'inventado', stance: 'abrirse' }] })).toThrow();
    expect(stateHash(world)).toBe(hash);
    const closed = r.submit('chat_session', { sessionId: 'CHS-000001', citizenId: SANTIAGO, visitorId: 'EXT-0001', turns: TURNS }).events;
    expect(closed.map((e) => e.type)).toEqual(['EXTERNAL_INPUT_APPLIED', 'CONVERSATION_HELD', 'LEARNED_FROM_CONVERSATION']);
    expect(closed[1]!.causes[0]).toEqual({ event: closed[0]!.id, weight: 1 });
    expect(world.components.i32[CHAT_UNTIL]![row]).toBe(0);
    expect(world.citizens.get(SANTIAGO as never)!.functions!.f.some((f) => f.s === 'ext.EXT-0001' && f.v < 0)).toBe(true);
  });

  it('CA-014: el replay desde la instantánea anterior, con sus entradas, da el mismo estado', () => {
    const world = eveningWorld();
    const snap = serializeWorld(world);
    const r = lifeRunner(world);
    r.setSpeed(REAL_TIME);
    r.submit('chat_open', { citizenId: SANTIAGO, visitorId: 'EXT-0001', sessionId: 'CHS-000001' });
    r.advanceTicks(2);
    r.submit('chat_session', { sessionId: 'CHS-000001', citizenId: SANTIAGO, visitorId: 'EXT-0001', turns: TURNS, summary: 'Empezó bien y terminó mal.' });
    r.advanceTicks(3);
    const expected = stateHash(world);

    const copy = deserializeWorld(snap);
    const replay = lifeRunner(copy);
    replay.enqueueReplay(r.inputs());
    replay.flushReplay();
    replay.advanceTicks(5);
    expect(stateHash(copy)).toBe(expected);
  });

  it('002 R-003: la velocidad de tiempo real se acepta y su evento lo dice', () => {
    const world = eveningWorld();
    const ev = lifeRunner(world).setSpeed(REAL_TIME).find((e) => e.type === 'SPEED_CHANGED')!;
    expect(ev.payload).toEqual({ from: 1, to: 1 / 60 });
  });
});
