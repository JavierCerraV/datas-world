// Charla con ciudadanos en la API (spec 043 R-016, R-019) sobre una copia del mundo de ejemplo de M2.
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ACTIVITY, ACTIVITY_COLUMN, REAL_TIME, stateHash } from '@datas-world/engine';
import { DEFAULT_CONFIG, Gateway, MemoryRecordStore, mockAdapter } from '@datas-world/llm-gateway';
import type { GatewayConfig, MockResponder, ModelConfig } from '@datas-world/llm-gateway';
import { closeDb, insertChatSession, insertChatTurn, nextChatSessionId, openWorldDb } from '@datas-world/persistence';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WorldWorker } from '../../worker/src/worker.ts';
import { buildApi } from './server.ts';
import type { Api } from './server.ts';

const M2 = join(import.meta.dirname, '..', '..', '..', 'docs', 'validaciones', 'mundos', 'm2-482917.db');
const auth = { user: 'ana', password: 'secreta' };
const AUTH = { authorization: `Basic ${Buffer.from('ana:secreta').toString('base64')}` };

const mock = (model: string): ModelConfig => ({ provider: 'mock', model, temperature: 0, maxOutputTokens: 300, timeoutMs: 5_000 });
const config: GatewayConfig = {
  ...DEFAULT_CONFIG,
  purposes: { ...DEFAULT_CONFIG.purposes, dialogue: mock('d'), classify: mock('c'), verify: mock('v'), summarize: mock('s') },
};
const respond: MockResponder = (c) => {
  const sys = c.system.map((p) => p.text).join('\n');
  if (sys.startsWith('Clasifica el tono')) return '{"tone":"amable"}';
  if (sys.startsWith('Revisas la respuesta')) return '{"claims":[],"stance":"ok"}';
  if (sys.startsWith('Resume en una sola frase')) return 'Charlaron un rato.';
  return 'Pues bien, aquí trabajando.';
};

let dir: string;
let db: string;
let api: Api;
let fakeMs = 0;

/** Mensajes SSE de una respuesta: `{ event, data }` en orden. */
const events = (body: string) =>
  body.split('\n\n').filter(Boolean).map((m) => {
    const ev = /event: (.*)/.exec(m)?.[1] ?? '';
    const data = /data: (.*)/.exec(m)?.[1];
    return { event: ev, data: data ? JSON.parse(data) : null };
  });

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'api-charla-'));
  db = join(dir, 'w.db');
  copyFileSync(M2, db);
  api = buildApi({ db, auth, clock: () => '2026-09-27T12:00:00Z', chat: { gateway: new Gateway({ config, adapters: { mock: mockAdapter(respond, { chunkDelayMs: 2 }) }, records: new MemoryRecordStore() }), waitMs: 5_000, nowMs: () => fakeMs } });
});
afterAll(async () => {
  await api.close();
  rmSync(dir, { recursive: true, force: true });
});

/** Alguien despierto y activo del mundo cargado. */
function awakeCitizen(): string {
  const w = api.reader.world;
  const u = w.components.u8;
  for (const [id, c] of w.citizens) {
    const row = Number(id.slice(4));
    if (c.status === 'active' && u.active?.[row] === 1 && u[ACTIVITY_COLUMN]?.[row] !== ACTIVITY.sleep && c.name) return id;
  }
  throw new Error('nadie despierto');
}

describe('charla en la API (043)', () => {
  it('CA-017: sin credenciales responde 401', async () => {
    const r = await api.app.inject({ method: 'POST', url: '/api/chat/sessions', payload: { citizenId: 'CIT-000019', mode: 'sandbox' } });
    expect(r.statusCode).toBe(401);
  });

  it('CA-001 y CA-018: tres charlas sandbox no cambian el mundo; en cada turno la postura llega antes que el texto', async () => {
    const hash = stateHash(api.reader.world);
    const count = () => (api.reader.db.prepare('SELECT count(*) AS n FROM events').get() as { n: number }).n;
    const before = count();
    const people = [...api.reader.world.citizens.values()].filter((c) => c.status === 'active' && c.name).slice(0, 3).map((c) => c.id);
    for (const citizenId of people) {
      const open = await api.app.inject({ method: 'POST', url: '/api/chat/sessions', headers: AUTH, payload: { citizenId, mode: 'sandbox' } });
      expect(open.statusCode).toBe(200);
      const { id, view } = open.json() as { id: string; view: { citizenId: string } };
      expect(view.citizenId).toBe(citizenId);
      const turn = await api.app.inject({ method: 'POST', url: `/api/chat/sessions/${id}/turns`, headers: AUTH, payload: { text: 'Buenas, ¿cómo le va?' } });
      const ev = events(turn.body);
      expect(ev[0]!.event).toBe('stance');
      expect(ev.findIndex((e) => e.event === 'token')).toBeGreaterThan(0);
      expect(ev.at(-1)).toMatchObject({ event: 'done', data: { reply: 'Pues bien, aquí trabajando.' } });
      const end = await api.app.inject({ method: 'POST', url: `/api/chat/sessions/${id}/end`, headers: AUTH });
      expect(end.json()).toMatchObject({ status: 'ended', endReason: 'visitor' });
      const again = await api.app.inject({ method: 'POST', url: `/api/chat/sessions/${id}/turns`, headers: AUTH, payload: { text: 'hola' } });
      expect(again.statusCode).toBe(409);
      const detail = (await api.app.inject({ url: `/api/chat/sessions/${id}`, headers: AUTH })).json() as { turns: unknown[]; log: { type: string }[] };
      expect(detail.turns).toHaveLength(2);
      expect(detail.log.map((l) => l.type)).toContain('CHAT_STANCE_SELECTED');
    }
    api.reader.refresh();
    expect(count()).toBe(before);
    expect(stateHash(api.reader.world)).toBe(hash);
    const chatCommands = api.reader.db.prepare("SELECT count(*) AS n FROM control_commands WHERE cmd LIKE 'chat%'").get() as { n: number };
    expect(chatCommands.n).toBe(0);
  }, 30_000);

  it('R-019.5: una charla sin mensajes se cierra por inactividad', async () => {
    const open = await api.app.inject({ method: 'POST', url: '/api/chat/sessions', headers: AUTH, payload: { citizenId: awakeCitizen(), mode: 'sandbox' } });
    const { id } = open.json() as { id: string };
    fakeMs += 11 * 60_000;
    await api.sweep();
    expect((await api.app.inject({ url: `/api/chat/sessions/${id}`, headers: AUTH })).json()).toMatchObject({ status: 'ended', endReason: 'idle' });
  });

  it('R-019.6: una charla en el mundo que quedó abierta (API caída) se cierra al arrancar y se consolida con sus turnos', async () => {
    const rw = openWorldDb(db);
    const id = nextChatSessionId(rw);
    const citizenId = awakeCitizen();
    insertChatSession(rw, {
      id, citizenId, visitorId: 'EXT-0001', mode: 'in_world', worldAt: 0, worldHash: 'x', testMode: false, llm: {},
      status: 'open', createdAt: 't', updatedAt: 't',
    });
    insertChatTurn(rw, { sessionId: id, seq: 0, speaker: 'visitor', text: 'hola', data: { tone: 'hostil' }, createdAt: 't' });
    insertChatTurn(rw, { sessionId: id, seq: 0, speaker: 'citizen', text: 'Mmm.', data: { stance: 'callar' }, createdAt: 't' });
    closeDb(rw);
    const second = buildApi({ db, auth, clock: () => '2026-09-27T12:00:00Z', chat: { gateway: new Gateway({ config, adapters: { mock: mockAdapter(respond) }, records: new MemoryRecordStore() }) } });
    try {
      const row = (await second.app.inject({ url: `/api/chat/sessions/${id}`, headers: AUTH })).json() as { status: string; endReason: string; inputRef: string };
      expect(row).toMatchObject({ status: 'ended', endReason: 'interrupted', inputRef: expect.stringMatching(/^cmd:\d+$/) });
      const cmd = second.reader.db.prepare('SELECT cmd, arg FROM control_commands WHERE id = ?').get(Number(row.inputRef.slice(4))) as { cmd: string; arg: string };
      expect(cmd.cmd).toBe('chat_session');
      expect(JSON.parse(cmd.arg)).toMatchObject({ sessionId: id, citizenId, turns: [{ tone: 'hostil', stance: 'callar' }] });
    } finally {
      await second.close();
    }
    // Deja la orden atendida para no afectar a la prueba siguiente.
    const w = new WorldWorker(db);
    w.pump(0);
    w.shutdown('prueba');
  });

  it('CA-015: en el mundo, la charla pasa por el worker, pone el tiempo real, no admite otra a la vez y se consolida al cerrar', async () => {
    const worker = new WorldWorker(db);
    const prev = worker.runner.speed;
    const timer = setInterval(() => worker.pump(20), 20);
    try {
      const citizenId = awakeCitizen();
      const open = await api.app.inject({ method: 'POST', url: '/api/chat/sessions', headers: AUTH, payload: { citizenId, mode: 'in_world', testMode: true } });
      expect(open.statusCode).toBe(200);
      const body = open.json() as { id: string; status: string; availableUntil: number };
      expect(body.status).toBe('open');
      expect(body.availableUntil).toBeGreaterThan(api.reader.world.now - 1);
      const second = await api.app.inject({ method: 'POST', url: '/api/chat/sessions', headers: AUTH, payload: { citizenId, mode: 'in_world' } });
      expect(second.statusCode).toBe(409);
      expect(second.json()).toMatchObject({ openSessionId: body.id, openCitizenId: citizenId });
      await new Promise((r) => setTimeout(r, 100));
      expect(worker.runner.speed).toBe(REAL_TIME);
      const turn = await api.app.inject({ method: 'POST', url: `/api/chat/sessions/${body.id}/turns`, headers: AUTH, payload: { text: 'Buenas, ¿cómo va todo?', toneTag: 'amable' } });
      expect(events(turn.body).at(-1)!.event).toBe('done');
      const end = await api.app.inject({ method: 'POST', url: `/api/chat/sessions/${body.id}/end`, headers: AUTH });
      expect(end.json()).toMatchObject({ status: 'ended', inputRef: expect.stringMatching(/^cmd:\d+$/) });
      let held = 0;
      for (let t = 0; t < 50 && held === 0; t++) {
        await new Promise((r) => setTimeout(r, 40));
        held = (worker.db.prepare("SELECT count(*) AS n FROM events WHERE type = 'CONVERSATION_HELD' AND json_extract(payload, '$.sessionId') = ?").get(body.id) as { n: number }).n;
      }
      expect(held).toBe(1);
      expect(worker.runner.speed).toBe(prev);
    } finally {
      clearInterval(timer);
      worker.shutdown('prueba');
      const check = openWorldDb(db);
      closeDb(check);
    }
  }, 30_000);
});
