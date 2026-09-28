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

// Cada prueba genera y hace vivir el mundo de la semilla: con toda la suite en paralelo supera los 5 s por defecto.
describe('charla en el mundo (043 R-019 a R-022)', { timeout: 60_000 }, () => {
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

  it('044 CA-006: una charla con una afirmación sobre su hijo deja la creencia, y el replay da el mismo estado sin LLM', () => {
    const world = eveningWorld();
    const snap = serializeWorld(world);
    const r = lifeRunner(world);
    r.submit('chat_open', { citizenId: SANTIAGO, visitorId: 'EXT-0001', sessionId: 'CHS-000001' });
    r.advanceTicks(2);
    const turns = [TURNS[0]!, { tone: 'desagradable', stance: 'poner_limite', claims: [{ predicate: 'habla_mal_de_ti', about: 'hijo' }] }];
    const closed = r.submit('chat_session', { sessionId: 'CHS-000001', citizenId: SANTIAGO, visitorId: 'EXT-0001', turns }).events;
    const heard = closed.find((e) => e.type === 'CHAT_CLAIM_HEARD');
    expect(heard, JSON.stringify(closed.map((e) => e.type))).toBeDefined();
    const son = (heard!.payload as { about: string }).about;
    const kid = world.citizens.get(son as never)!;
    expect(kid.motherId === SANTIAGO || kid.fatherId === SANTIAGO).toBe(true);
    r.advanceTicks(3);
    const expected = stateHash(world);

    const copy = deserializeWorld(snap);
    const replay = lifeRunner(copy);
    replay.enqueueReplay(r.inputs());
    replay.flushReplay();
    replay.advanceTicks(5);
    expect(stateHash(copy)).toBe(expected);
    expect(copy.citizens.get(SANTIAGO as never)!.beliefs).toEqual(world.citizens.get(SANTIAGO as never)!.beliefs);
  });

  it('044 R-006 a R-009 e INV-002: la revelación forma una intención; todo encuentro se remonta a lo que oyó; el replay coincide', () => {
    const world = eveningWorld();
    // La primera persona con pareja en su hogar que pueda charlar ahora, con historia de traición (036).
    const partnered = [...world.households.values()].flatMap((h) => h.kinship.filter((k) => k.kind === 'partner').map((k) => k.from)).sort();
    const r0 = lifeRunner(world);
    let who: string | undefined;
    for (const id of partnered) {
      const opened = r0.submit('chat_open', { citizenId: id, visitorId: 'EXT-0001', sessionId: `CHS-${id.slice(4)}` }).events;
      if (opened.some((e) => e.type === 'CONVERSATION_STARTED')) {
        who = id;
        break;
      }
    }
    expect(who).toBeDefined();
    const c = world.citizens.get(who as never)!;
    c.functions!.f.push({ s: 'verbal.traicion', v: -0.9, c: '', inh: [], hab: 0, n: 5, rs: [], o: 'direct', src: [], at: world.now });
    const snap = serializeWorld(world);
    const r = lifeRunner(world);
    // El visitante se gana su confianza y luego se lo cuenta en confidencia (con los valores por defecto, a un
    // desconocido que no se ganó la confianza casi no se le cree lo bastante para actuar: PA-138, PA-139).
    const warm = { tone: 'amable', stance: 'abrirse' };
    const turns = [warm, warm, warm, warm, { tone: 'intimo', stance: 'poner_limite', claims: [{ predicate: 'infiel', about: 'pareja' }] }];
    const all = [...r.submit('chat_session', { sessionId: `CHS-${who!.slice(4)}`, citizenId: who, visitorId: 'EXT-0001', turns }).events];
    const formed = all.find((e) => e.type === 'INTENTION_FORMED');
    expect(formed, JSON.stringify(all.map((e) => [e.type, e.payload]))).toBeDefined();
    for (let i = 0; i < (2 * DAY) / 5; i++) {
      r.advanceTicks(1);
      all.push(...r.drainEvents());
    }
    const byId = new Map(all.map((e) => [e.id, e]));
    const reaches = (id: string, type: string, depth = 0): boolean => {
      const e = byId.get(id as never);
      if (!e || depth > 10) return false;
      return e.type === type || e.causes.some((x) => 'event' in x && reaches(x.event, type, depth + 1));
    };
    const outcome = all.filter((e) => ['CONFRONTATION', 'INTENTION_EXPIRED'].includes(e.type));
    const kind = (formed!.payload as { kind: string }).kind;
    if (kind !== 'rumiar') expect(outcome.length, kind).toBeGreaterThan(0);
    for (const e of all.filter((x) => x.type === 'CONFRONTATION' || x.type === 'BOND_STRAINED')) expect(reaches(e.id, 'CHAT_CLAIM_HEARD')).toBe(true);
    const expected = stateHash(world);

    const copy = deserializeWorld(snap);
    const replay = lifeRunner(copy);
    replay.enqueueReplay(r.inputs());
    replay.flushReplay();
    replay.advanceTicks((2 * DAY) / 5);
    expect(stateHash(copy)).toBe(expected);
  }, 60_000); // dos días de mundo, dos veces: con toda la suite en paralelo supera los 5 s por defecto

  it('002 R-003: la velocidad de tiempo real se acepta y su evento lo dice', () => {
    const world = eveningWorld();
    const ev = lifeRunner(world).setSpeed(REAL_TIME).find((e) => e.type === 'SPEED_CHANGED')!;
    expect(ev.payload).toEqual({ from: 1, to: 1 / 60 });
  });
});
