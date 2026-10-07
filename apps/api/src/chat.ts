// Charla con ciudadanos en la API (spec 043 R-016, R-019): abrir, turnos por SSE (postura → texto → fin),
// cerrar y consultar. La charla `in_world` pasa por el worker (`chat_open`, `chat_session` en control_commands) y
// pone el mundo en tiempo real mientras dura; la `sandbox` solo lee. Todo con basic auth (cuesta dinero).
import { createHash } from 'node:crypto';
import { REAL_TIME, learningParams, stateHash } from '@datas-world/engine';
import type { ChatSessionInput, EntityId, Ontology, WorldEvent } from '@datas-world/engine';
import { ChatSession } from '@datas-world/llm-gateway';
import type { ChatCatalogs, Gateway } from '@datas-world/llm-gateway';
import {
  appendChatLog, chatLog, chatSessionsOf, chatTurns, enqueueCommand, getChatSession, insertChatSession, insertChatTurn,
  nextChatSessionId, openChatSessions, openInWorldSession, queryEvents, updateChatSession,
} from '@datas-world/persistence';
import type { ChatSessionRow, Db } from '@datas-world/persistence';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { WorldReader } from './reader.ts';

/** 043 §8, `IDLE_END_MIN`: minutos sin mensajes del visitante tras los que el ciudadano se despide. */
export const IDLE_END_MIN = 10;
export const VISITOR = 'EXT-0001';

export interface ChatDeps {
  rw: Db;
  reader: WorldReader;
  gateway: Gateway;
  catalogs: ChatCatalogs;
  onto: Ontology;
  /** `true` si la cabecera es válida; `null` si los controles están desactivados (sin credenciales). */
  authorized: (header: string | undefined) => boolean | null;
  clock: () => string;
  nowMs: () => number;
  /** Espera máxima a que el worker atienda una orden (ms). */
  waitMs?: number;
}

interface Live {
  session: ChatSession;
  row: ChatSessionRow;
  prevSpeed?: number;
  lastMs: number;
  busy: boolean;
}

const openBody = z.object({ citizenId: z.string().regex(/^CIT-\d+$/), mode: z.enum(['in_world', 'sandbox']), testMode: z.boolean().optional() });
const idParams = z.object({ id: z.string().regex(/^CHS-\d+$/) });

const sse = (reply: FastifyReply, event: string, data: unknown) => reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function speedOf(db: Db): number {
  const last = queryEvents(db, { types: ['SPEED_CHANGED'], latest: true, limit: 1 })[0];
  return last ? (last.payload as { to: number }).to : 1;
}

/** Eventos candidatos para la vista: los suyos y los nacimientos y muertes (la vista filtra la familia, R-003). */
function candidateEvents(db: Db, citizenId: string): WorldEvent[] {
  const own = queryEvents(db, { participant: citizenId as EntityId, limit: 100_000 });
  const kin = queryEvents(db, { types: ['CITIZEN_BORN', 'CITIZEN_DIED'], limit: 100_000 });
  const byId = new Map([...own, ...kin].map((e) => [e.id, e]));
  return [...byId.values()].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}

export function registerChatRoutes(app: FastifyInstance, d: ChatDeps): { sweep: () => Promise<void> } {
  const live = new Map<string, Live>();
  const log = (sessionId: string, type: string, payload: unknown, causes: unknown[] = []) =>
    appendChatLog(d.rw, { sessionId, type, payload, causes, createdAt: d.clock() });

  const guard = (header: string | undefined, reply: FastifyReply): boolean => {
    const ok = d.authorized(header);
    if (ok === null) void reply.code(503).send({ error: 'charla desactivada: define DATAS_WORLD_USER y DATAS_WORLD_PASSWORD' });
    // Sin `WWW-Authenticate`: el navegador abriría su propia ventana de acceso (y en una página sin ventana la
    // petición quedaría colgada); el visor pide las credenciales con su formulario (022 R-004).
    else if (!ok) void reply.code(401).send({ error: 'credenciales' });
    return ok === true;
  };

  /** Encola una orden para el worker y espera a que la atienda (1 aplicada, −1 rechazada, 0 sin respuesta). */
  async function command(cmd: 'chat_open' | 'chat_session' | 'speed', arg: string, wait = true): Promise<number> {
    const id = enqueueCommand(d.rw, cmd, arg, d.clock());
    if (!wait) return 1;
    const stmt = d.rw.prepare('SELECT done FROM control_commands WHERE id = ?');
    for (let t = 0; t < (d.waitMs ?? 5_000); t += 50) {
      const done = (stmt.get(id) as { done: number }).done;
      if (done !== 0) return done;
      await sleep(50);
    }
    return 0;
  }

  /** Consolida en el mundo una charla `in_world` y devuelve la referencia de la orden (R-019.6). */
  function consolidate(input: ChatSessionInput): string {
    return `cmd:${enqueueCommand(d.rw, 'chat_session', JSON.stringify(input), d.clock())}`;
  }

  async function close(id: string, reason: string): Promise<ChatSessionRow | undefined> {
    const l = live.get(id);
    if (!l) {
      recoverOrphans(); // abierta en la base pero sin sesión viva: se cierra y se consolida
      return getChatSession(d.rw, id);
    }
    live.delete(id);
    // El cierre no puede quedarse a medias: si el resumen falla, se consolida sin él y la charla termina igual.
    const input = await l.session.close().catch(() => l.session.input());
    let inputRef: string | undefined;
    try {
      if (l.row.mode === 'in_world') {
        inputRef = consolidate(input);
        if (l.prevSpeed !== undefined && l.prevSpeed !== REAL_TIME) await command('speed', String(l.prevSpeed), false);
      }
    } finally {
      updateChatSession(d.rw, id, { status: 'ended', endReason: reason, ...(inputRef ? { inputRef } : {}) }, d.clock());
    }
    log(id, 'CHAT_SESSION_ENDED', { sessionId: id, reason, turns: input.turns.length }, [{ state: `fin:${reason}`, weight: 1 }]);
    return getChatSession(d.rw, id);
  }

  /**
   * Charlas que quedaron abiertas sin sesión viva (la API se cerró o se cayó durante la charla): se cierran y,
   * si eran en el mundo, se consolidan con los turnos guardados para que el ciudadano las recuerde (R-019.6).
   */
  function recoverOrphans(): number | undefined {
    let restored: number | undefined;
    for (const row of openChatSessions(d.rw)) {
      if (live.has(row.id)) continue;
      const turns = chatTurns(d.rw, row.id);
      const pairs = turns.filter((t) => t.speaker === 'citizen').flatMap((c) => {
        const v = turns.find((t) => t.speaker === 'visitor' && t.seq === c.seq);
        const tone = v?.data.tone;
        const stance = c.data.stance;
        return typeof tone === 'string' && typeof stance === 'string' ? [{ tone, stance }] : [];
      });
      let inputRef: string | undefined;
      if (row.mode === 'in_world')
        inputRef = consolidate({ sessionId: row.id, citizenId: row.citizenId as EntityId, visitorId: row.visitorId, turns: pairs });
      updateChatSession(d.rw, row.id, { status: 'ended', endReason: 'interrupted', ...(inputRef ? { inputRef } : {}) }, d.clock());
      log(row.id, 'CHAT_SESSION_ENDED', { sessionId: row.id, reason: 'interrupted', turns: pairs.length }, [{ state: 'fin:interrupted', weight: 1 }]);
      const prev = chatLog(d.rw, row.id).find((e) => e.type === 'CHAT_SESSION_STARTED')?.payload as { prevSpeed?: number } | undefined;
      if (row.mode === 'in_world' && prev?.prevSpeed !== undefined) {
        restored = prev.prevSpeed;
        if (prev.prevSpeed !== REAL_TIME) void command('speed', String(prev.prevSpeed), false);
      }
    }
    return restored;
  }
  recoverOrphans();

  /**
   * Hay un solo visitante: abrir otra charla en el mundo cierra la anterior (motivo `replaced`, consolidada), sea
   * una viva que quedó sin despedida (diálogo cerrado con Esc, página recargada) o una huérfana en la base.
   * Devuelve la velocidad que había antes de la charla anterior: la nueva la hereda para restaurarla al cerrar
   * (la orden de restaurar aún no se ha aplicado, así que el registro todavía dice «tiempo real»).
   */
  async function replacePrevious(): Promise<{ busy: true } | { busy: false; prevSpeed?: number }> {
    const prev = [...live.values()].find((l) => l.row.mode === 'in_world');
    if (prev?.busy) return { busy: true };
    if (prev) {
      await close(prev.row.id, 'replaced');
      return { busy: false, ...(prev.prevSpeed !== undefined ? { prevSpeed: prev.prevSpeed } : {}) };
    }
    const restored = openInWorldSession(d.rw) ? recoverOrphans() : undefined;
    return { busy: false, ...(restored !== undefined ? { prevSpeed: restored } : {}) };
  }

  app.post('/api/chat/sessions', async (req, reply) => {
    if (!guard(req.headers.authorization, reply)) return reply;
    const b = openBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'petición inválida' });
    d.reader.refresh();
    const person = d.reader.world.citizens.get(b.data.citizenId as EntityId);
    if (!person || person.status !== 'active') return reply.code(404).send({ error: 'no existe' });
    const inWorld = b.data.mode === 'in_world';
    let prevSpeed: number | undefined;
    if (inWorld) {
      const r = await replacePrevious();
      if (r.busy) return reply.code(409).send({ error: 'la charla anterior está a mitad de un turno; espera a que responda' });
      prevSpeed = r.prevSpeed;
    }
    const id = nextChatSessionId(d.rw);
    let availableUntil: number | undefined;
    if (inWorld) {
      prevSpeed ??= speedOf(d.reader.db);
      const done = await command('chat_open', JSON.stringify({ citizenId: b.data.citizenId, visitorId: VISITOR, sessionId: id }));
      if (done !== 1) return reply.code(503).send({ error: 'el worker no atendió la apertura; ¿está corriendo?' });
      // El worker marca la orden antes de guardar sus eventos: se espera al evento de la apertura.
      let ev: WorldEvent | undefined;
      for (let t = 0; t < (d.waitMs ?? 5_000) && !ev; t += 50) {
        ev = queryEvents(d.reader.db, { types: ['CONVERSATION_STARTED', 'CONVERSATION_DECLINED'], latest: true, limit: 50 })
          .find((e) => (e.payload as { citizenId: string }).citizenId === b.data.citizenId && ((e.payload as { sessionId?: string }).sessionId ?? id) === id);
        if (!ev) await sleep(50);
      }
      d.reader.refresh();
      if (!ev || ev.type === 'CONVERSATION_DECLINED') {
        const reason = ev ? (ev.payload as { reason: string }).reason : 'sin respuesta';
        return reply.send({ id: null, status: 'declined', reason });
      }
      availableUntil = (ev.payload as { availableUntil: number }).availableUntil;
      if (prevSpeed !== REAL_TIME) await command('speed', String(REAL_TIME), false);
    }
    const world = d.reader.world;
    const hash = stateHash(world);
    const seed = Number.parseInt(createHash('sha256').update(hash + id).digest('hex').slice(0, 8), 16);
    const session = new ChatSession({
      gateway: d.gateway, catalogs: d.catalogs, onto: d.onto, P: learningParams(world.config.profile, world.config.epoch.slice(0, 10)),
      view: world, citizenId: b.data.citizenId, events: candidateEvents(d.reader.db, b.data.citizenId), sessionId: id, visitorId: VISITOR, seed, now: world.now,
    });
    const row: ChatSessionRow = {
      id, citizenId: b.data.citizenId, visitorId: VISITOR, mode: b.data.mode, worldAt: world.now, worldHash: hash, testMode: b.data.testMode ?? false,
      llm: { dialogue: d.gateway.config.purposes.dialogue?.model ?? null, classify: d.gateway.config.purposes.classify?.model ?? null },
      status: 'open', ...(availableUntil !== undefined ? { availableUntil } : {}), createdAt: d.clock(), updatedAt: d.clock(),
    };
    insertChatSession(d.rw, row);
    log(id, 'CHAT_SESSION_STARTED', { sessionId: id, citizenId: row.citizenId, visitorId: VISITOR, mode: row.mode, worldAt: row.worldAt, worldHash: hash, testMode: row.testMode, llm: row.llm, ...(prevSpeed !== undefined ? { prevSpeed } : {}) }, [{ state: 'visitante', weight: 1 }]);
    live.set(id, { session, row, ...(prevSpeed !== undefined ? { prevSpeed } : {}), lastMs: d.nowMs(), busy: false });
    return { id, mode: row.mode, status: 'open', ...(availableUntil !== undefined ? { availableUntil } : {}), view: session.view };
  });

  app.post('/api/chat/sessions/:id/turns', async (req, reply) => {
    if (!guard(req.headers.authorization, reply)) return reply;
    const p = idParams.safeParse(req.params);
    const tones = d.catalogs.tones.map((t) => t.key) as [string, ...string[]];
    const b = z.object({ text: z.string().min(1).max(1_000), toneTag: z.enum(tones).optional() }).safeParse(req.body);
    if (!p.success || !b.success) return reply.code(400).send({ error: 'petición inválida' });
    const l = live.get(p.data.id);
    if (!l) return reply.code(getChatSession(d.rw, p.data.id) ? 409 : 404).send({ error: getChatSession(d.rw, p.data.id) ? 'la charla ya terminó' : 'no existe' });
    if (l.busy || l.session.ended) return reply.code(409).send({ error: l.busy ? 'hay un turno en curso' : 'la charla ya terminó' });
    l.busy = true;
    const id = p.data.id;
    const row = Number(l.row.citizenId.slice(4));
    let now = l.row.worldAt;
    let forced: string | undefined;
    let liveState: { energy: number; stress: number } | undefined;
    if (l.row.mode === 'in_world') {
      d.reader.refresh();
      const w = d.reader.world;
      now = w.now;
      if (l.row.availableUntil !== undefined && now >= l.row.availableUntil) forced = 'terminar';
      liveState = { energy: w.components.f32['need.energy']?.[row] ?? 1, stress: w.components.f32['state.stress']?.[row] ?? 0 };
    }
    reply.hijack();
    reply.raw.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    try {
      const out = await l.session.turn(b.data.text, {
        ...(b.data.toneTag ? { toneTag: b.data.toneTag } : {}), ...(liveState ? { live: liveState } : {}), ...(forced ? { forced } : {}), now,
        onStance: ({ tone, choice, claims }) => sse(reply, 'stance', { tone, claims, stance: choice.stance, sources: choice.sources.slice(0, 3), probabilities: choice.probabilities, forced: choice.forced }),
        onText: (text) => sse(reply, 'token', { text }),
      });
      const at = d.clock();
      insertChatTurn(d.rw, { sessionId: id, seq: out.seq, speaker: 'visitor', text: b.data.text, data: { ...out.tone, claims: out.claims }, createdAt: at });
      const citizenData = { stance: out.choice.stance, sources: out.choice.sources, forced: out.choice.forced, expression: out.expression, llmRef: out.llmRef ?? null, latencyMs: out.latencyMs, stanceCheck: 'pending' };
      insertChatTurn(d.rw, { sessionId: id, seq: out.seq, speaker: 'citizen', text: out.reply, data: citizenData, createdAt: at });
      log(id, 'CHAT_VISITOR_SAID', { sessionId: id, seq: out.seq, ...out.tone }, [{ state: 'visitante', weight: 1 }]);
      log(id, 'CHAT_STANCE_SELECTED', { sessionId: id, seq: out.seq, stance: out.choice.stance, sources: out.choice.sources }, out.choice.sources.slice(0, 3).map((s) => ({ state: `fuente.${s.source}${s.ref ? `:${s.ref}` : ''}`, weight: Math.min(1, Math.abs(s.contribution)) })));
      log(id, 'CHAT_CITIZEN_REPLIED', { sessionId: id, seq: out.seq, expression: out.expression, llmRef: out.llmRef ?? null, latencyMs: out.latencyMs }, [{ state: 'postura', weight: 1 }]);
      sse(reply, 'done', { seq: out.seq, reply: out.reply, expression: out.expression, latencyMs: out.latencyMs, level: out.level, ended: l.session.ended });
      void out.verification.then((v) => {
        insertChatTurn(d.rw, { sessionId: id, seq: out.seq, speaker: 'citizen', text: out.reply, data: { ...citizenData, claims: v.claims, stanceCheck: v.stanceCheck }, createdAt: at });
        for (const c of v.claims.filter((x) => x.verdict !== 'supported'))
          log(id, 'CHAT_CLAIM_FLAGGED', { sessionId: id, seq: out.seq, claim: c, verdict: c.verdict }, c.evidence ? [{ event: c.evidence, weight: 1 }] : [{ state: 'sin_evidencia', weight: 1 }]);
      }).catch(() => undefined);
    } catch (e) {
      sse(reply, 'error', { error: (e as Error).message });
    } finally {
      reply.raw.end();
      l.busy = false;
      l.lastMs = d.nowMs();
    }
    if (l.session.ended) await close(id, forced ? 'obligation' : 'citizen').catch((e: Error) => app.log.error(e));
    return reply;
  });

  app.post('/api/chat/sessions/:id/end', async (req, reply) => {
    if (!guard(req.headers.authorization, reply)) return reply;
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'id inválido' });
    const row = await close(p.data.id, 'visitor');
    return row ? row : reply.code(404).send({ error: 'no existe' });
  });

  app.get('/api/chat/sessions/:id', async (req, reply) => {
    if (!guard(req.headers.authorization, reply)) return reply;
    const p = idParams.safeParse(req.params);
    const row = p.success ? getChatSession(d.rw, p.data.id) : undefined;
    if (!row) return reply.code(404).send({ error: 'no existe' });
    return { ...row, turns: chatTurns(d.rw, row.id), log: chatLog(d.rw, row.id) };
  });

  app.get('/api/chat/sessions', async (req, reply) => {
    if (!guard(req.headers.authorization, reply)) return reply;
    const q = z.object({ citizenId: z.string().regex(/^CIT-\d+$/) }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'falta citizenId' });
    return chatSessionsOf(d.rw, q.data.citizenId);
  });

  /** R-019.5: cierra por inactividad y, en el mundo, por su próximo compromiso aunque el visitante no escriba. */
  const sweep = async () => {
    // Se llama con `void` cada 30 s: un rechazo sin atrapar tumbaría el proceso de la API.
    try {
      d.reader.refresh();
      for (const [id, l] of [...live]) {
        if (l.busy) continue;
        if (d.nowMs() - l.lastMs > IDLE_END_MIN * 60_000) await close(id, 'idle');
        else if (l.row.mode === 'in_world' && l.row.availableUntil !== undefined && d.reader.world.now >= l.row.availableUntil) await close(id, 'obligation');
      }
    } catch (e) {
      app.log.warn(`revisión de charlas fallida: ${(e as Error).message}`);
    }
  };
  return { sweep };
}
