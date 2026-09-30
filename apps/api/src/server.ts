// Servidor HTTP de la API (spec 022): lectura del mundo, SSE en vivo y controles autenticados. Solo lee la base,
// salvo `control_commands` (R-001), que atiende el worker.
import { Buffer } from 'node:buffer';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beliefTruth, eventText, lifeReport, topicOf, why } from '@datas-world/engine';
import type { EntityId, WhyNode, WorldEvent } from '@datas-world/engine';
import { buildOntology, knowledgeCatalog, loadCatalogs } from '@datas-world/generators';
import { DEFAULT_CONFIG, Gateway, anthropicAdapter, chatCatalogs, mockAdapter, openaiCompatibleAdapter, parseConfig } from '@datas-world/llm-gateway';
import type { LlmRecord, ProviderAdapter, RecordStore } from '@datas-world/llm-gateway';
import { CONTROL_COMMANDS, SqliteRecordStore, closeDb, enqueueCommand, eventsById, openWorldDb, queryEvents, trajectoryOf } from '@datas-world/persistence';
import type { ControlCommandName, Db } from '@datas-world/persistence';
import { registerChatRoutes } from './chat.ts';
import { placeDetail } from './places.ts';
import { registerDayRoutes } from './days.ts';
import { registerMetricsRoutes } from './metrics.ts';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { lifeView } from './life.ts';
import { WorldReader } from './reader.ts';
import { citizenDetail, dateOf, eventView, nameOf, positions, worldView } from './views.ts';

export interface ApiOptions {
  db: string;
  /** Credenciales de los controles (R-004); sin ellas, desactivados. */
  auth?: { user: string; password: string };
  /** Hora real para `control_commands.created_at` (se inyecta: la lógica no lee el reloj). */
  clock?: () => string;
  /** Charla con ciudadanos (043): pasarela (por defecto, la de `config/llm.json` o la de fábrica) y espera al worker. */
  chat?: { gateway?: Gateway; waitMs?: number; nowMs?: () => number };
}

/** Pasarela de fábrica (026 R-006): `config/llm.json` si existe; el cliente de Anthropic se crea al primer uso. */
function defaultGateway(rw: Db): Gateway {
  const path = join(process.cwd(), 'config', 'llm.json');
  const config = existsSync(path) ? parseConfig(JSON.parse(readFileSync(path, 'utf8'))) : DEFAULT_CONFIG;
  let anthropic: ProviderAdapter | undefined;
  return new Gateway({
    config,
    adapters: {
      anthropic: { call: (c) => (anthropic ??= anthropicAdapter()).call(c) },
      openai_compatible: openaiCompatibleAdapter(),
      mock: mockAdapter(),
    },
    records: sqliteRecords(rw),
  });
}

/** `llm_records` de la base como almacén de la pasarela (026 R-003); el propósito se guarda tal cual. */
function sqliteRecords(rw: Db): RecordStore {
  const s = new SqliteRecordStore(rw);
  return {
    get: (key) => s.get(key) as LlmRecord | undefined,
    put: (r) => s.put(r),
    markAffectsWorld: (key) => s.markAffectsWorld(key),
    prune: (before) => s.prune(before),
  };
}

const eventsQuery = z.object({ since: z.string().regex(/^EVT-\d+$/).optional(), limit: z.coerce.number().int().min(1).max(200).default(100) });
const citizenParams = z.object({ id: z.string().regex(/^CIT-\d+$/) });
const controlBody = z.object({ cmd: z.enum(['pause', 'resume', 'speed', 'step']), arg: z.union([z.string(), z.number()]).optional() });

const MB = 1024 * 1024;

/** Velocidad vigente: la del último `SPEED_CHANGED` (1 si no hay). */
function speedOf(reader: WorldReader): number {
  const last = queryEvents(reader.db, { types: ['SPEED_CHANGED'], latest: true, limit: 1 })[0];
  return last ? (last.payload as { to: number }).to : 1;
}

function authorized(header: string | undefined, auth: { user: string; password: string }): boolean {
  if (!header?.startsWith('Basic ')) return false;
  const [user, password] = Buffer.from(header.slice(6), 'base64').toString('utf8').split(':');
  return user === auth.user && password === auth.password;
}

/** Envío de un mensaje SSE. */
const sse = (reply: FastifyReply, event: string, data: unknown, id?: string) =>
  reply.raw.write(`${id ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

export interface Api {
  app: FastifyInstance;
  reader: WorldReader;
  /** Una vuelta del sondeo (R-006): recarga si cambió el minuto y avisa a los clientes SSE. */
  poll: () => void;
  /** 043 R-019.5: cierra las charlas inactivas o cuyo tiempo disponible terminó. */
  sweep: () => Promise<void>;
  close: () => Promise<void>;
}

export function buildApi(opts: ApiOptions): Api {
  // Conexión de escritura para los datos del laboratorio (043 R-001) y las órdenes; abre antes que el lector para
  // aplicar las migraciones pendientes.
  const rw = openWorldDb(opts.db);
  const reader = new WorldReader(opts.db);
  const app = Fastify({ logger: false });
  const clients = new Set<{ reply: FastifyReply; last?: string }>();

  app.get('/api/health', async () => {
    const w = reader.world;
    let dbMb: number;
    try {
      dbMb = statSync(opts.db).size / MB;
    } catch {
      dbMb = 0;
    }
    return { now: w.now, date: dateOf(w, w.now), status: w.status, speed: speedOf(reader), citizens: positions(w).length, rssMb: Math.round(process.memoryUsage().rss / MB), dbMb: Math.round(dbMb * 10) / 10 };
  });

  app.get('/api/world', async () => worldView(reader.world));

  app.get('/api/citizens', async () => positions(reader.world));

  registerDayRoutes(app, reader); // 022 R-009: días pasados
  registerMetricsRoutes(app, reader); // 022 R-010, R-011: métricas y exportación

  // 022 R-007: ficha de un lugar.
  app.get('/api/places/:id', async (req, reply) => {
    const id = (req.params as { id?: string }).id ?? '';
    if (!/^PLC-\d+$/.test(id)) return reply.code(400).send({ error: 'id inválido' });
    const p = placeDetail(reader.world, id as EntityId);
    return p ?? reply.code(404).send({ error: 'no existe' });
  });

  const knowledge = knowledgeCatalog(loadCatalogs());
  app.get('/api/citizens/:id', async (req, reply) => {
    const p = citizenParams.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'id inválido' });
    const events = queryEvents(reader.db, { participant: p.data.id as EntityId, latest: true, limit: 20 });
    const detail = citizenDetail(reader.world, p.data.id as EntityId, events);
    if (!detail) return reply.code(404).send({ error: 'no existe' });
    // 025 R-008: lo que cree de otros, con la verdad solo para quien observa.
    const w = reader.world;
    const beliefs = (w.citizens.get(p.data.id as EntityId)?.beliefs ?? []).filter((b) => b.about.startsWith('CIT-')).map((b) => ({
      about: b.about, name: nameOf(w, b.about), predicate: b.predicate, topic: topicOf(knowledge, b.predicate)?.name ?? b.predicate.replace(/_/g, ' '),
      source: b.source, sourceName: b.source.startsWith('CIT-') ? nameOf(w, b.source) : null, credibility: b.credibility, hops: b.hops ?? 0,
      truth: beliefTruth(b, queryEvents(reader.db, { participant: b.about as EntityId, limit: 100_000 }), knowledge),
    }));
    return { ...detail, beliefs };
  });

  // 041 R-009: historia de vida (episodios del desarrollo por etapa) y familiograma extenso.
  const lifeCatalogs = loadCatalogs();
  app.get('/api/citizens/:id/life', async (req, reply) => {
    const p = citizenParams.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'id inválido' });
    const id = p.data.id as EntityId;
    const years = queryEvents(reader.db, { participant: id, types: ['DEVELOPMENT_YEAR'], limit: 1000 });
    // 013: también los hechos de sus recuerdos y los que abrieron sus capítulos.
    const memory = reader.world.citizens.get(id)?.memory;
    const causeIds = [...new Set([
      ...years.flatMap((e) => (e.payload as { episodes: [number, string, string, string, number, string][] }).episodes.map((ep) => ep[5]).filter(Boolean)),
      ...(memory?.episodes ?? []).flatMap((m) => (m.event && m.kind === m.kind.toUpperCase() ? [m.event] : [])),
      ...(memory?.chapters ?? []).flatMap((c) => (c.openedBy ? [c.openedBy] : [])),
    ])];
    const causes = new Map(eventsById(reader.db, causeIds as EntityId[]).map((e) => [e.id as string, e]));
    const life = lifeView(reader.world, id, years, causes, lifeCatalogs);
    if (!life) return reply.code(404).send({ error: 'no existe' });
    return life;
  });

  app.get('/api/events', async (req, reply) => {
    const q = eventsQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: q.error.issues.map((i) => i.message).join('; ') });
    const events = q.data.since
      ? queryEvents(reader.db, { afterId: q.data.since as EntityId, limit: q.data.limit })
      : queryEvents(reader.db, { latest: true, limit: q.data.limit });
    return events.map((e) => eventView(reader.world, e));
  });

  // 020 R-007: el informe de vida, bajo demanda (no cambia el mundo).
  app.get('/api/citizens/:id/report', async (req, reply) => {
    const p = citizenParams.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'id inválido' });
    const id = p.data.id as EntityId;
    const w = reader.world;
    if (!w.citizens.get(id) || w.citizens.get(id)!.ancestor) return reply.code(404).send({ error: 'no existe' });
    const mine = queryEvents(reader.db, { participant: id, limit: 1_000_000 });
    const deaths = queryEvents(reader.db, { types: ['CITIZEN_DIED'], limit: 1_000_000 });
    const events = [...new Map([...mine, ...deaths].map((e) => [e.id as string, e])).values()].sort((a, b) => (a.id < b.id ? -1 : 1));
    const byId = new Map(events.map((e) => [e.id as string, e]));
    const names = (s: string) => s.replace(/CIT-\d+/g, (x) => nameOf(w, x) ?? x);
    const report = lifeReport({
      view: w, id, events, trajectory: trajectoryOf(reader.db, id), now: w.now, names,
      get: (x) => byId.get(x) ?? eventsById(reader.db, [x as EntityId])[0],
    });
    // Textos y fechas para el visor: el de cada hecho citado.
    const text = (x: string) => {
      const e = byId.get(x);
      return e ? { id: x, date: dateOf(w, e.at).slice(0, 10), text: names(eventText(e)) } : { id: x, date: '', text: x };
    };
    return {
      ...report,
      chapters: report.chapters.map((c) => ({ ...c, date: dateOf(w, c.from).slice(0, 10), opened: c.openedBy ? text(c.openedBy) : null })),
      remembered: report.remembered.map((c) => ({ ...c, date: dateOf(w, c.from).slice(0, 10) })),
      turningPoints: report.turningPoints.map((t) => ({ ...t, fact: text(t.event) })),
    };
  });

  // 019 R-004, R-007: el árbol de causas de un evento, con fechas y nombres.
  app.get('/api/events/:id/why', async (req, reply) => {
    const id = (req.params as { id?: string }).id ?? '';
    const q = req.query as { depth?: string };
    const depth = Math.min(6, Math.max(1, Number(q.depth ?? 4) || 4));
    if (!/^EVT-\d+$/.test(id)) return reply.code(400).send({ error: 'id inválido' });
    const w = reader.world;
    const tree = why((x) => eventsById(reader.db, [x as EntityId])[0], id, {
      depth, view: w, names: (s) => s.replace(/CIT-\d+/g, (x) => nameOf(w, x) ?? x),
    });
    if (!tree) return reply.code(404).send({ error: 'no existe' });
    const withDates = (n: WhyNode): WhyNode & { date?: string } => ({ ...n, ...(n.at !== undefined ? { date: dateOf(w, n.at) } : {}), children: n.children.map(withDates) });
    return withDates(tree);
  });

  // R-003: SSE con reconexión; `Last-Event-ID` recupera los eventos perdidos.
  app.get('/api/stream', (req, reply) => {
    reply.raw.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    const lastHeader = req.headers['last-event-id'];
    const client: { reply: FastifyReply; last?: string } = { reply };
    const last = typeof lastHeader === 'string' && /^EVT-\d+$/.test(lastHeader) ? lastHeader : queryEvents(reader.db, { latest: true, limit: 1 })[0]?.id;
    if (last) client.last = last;
    clients.add(client);
    const w = reader.world;
    sse(reply, 'tick', { now: w.now, date: dateOf(w, w.now), status: w.status });
    sendEvents(client);
    req.raw.on('close', () => clients.delete(client));
  });

  function sendEvents(client: { reply: FastifyReply; last?: string }): void {
    const events: WorldEvent[] = client.last ? queryEvents(reader.db, { afterId: client.last as EntityId, limit: 200 }) : [];
    for (const e of events) sse(client.reply, 'event', eventView(reader.world, e), e.id);
    if (events.length) client.last = events.at(-1)!.id;
  }

  // R-004: controles con basic auth; la orden queda en `control_commands` para el worker.
  app.post('/api/control', async (req, reply) => {
    if (!opts.auth) return reply.code(503).send({ error: 'controles desactivados: define DATAS_WORLD_USER y DATAS_WORLD_PASSWORD' });
    if (!authorized(req.headers.authorization, opts.auth)) return reply.code(401).header('www-authenticate', 'Basic realm="datas-world"').send({ error: 'credenciales' });
    const b = controlBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'orden inválida' });
    const cmd = b.data.cmd as ControlCommandName;
    if (!CONTROL_COMMANDS.includes(cmd)) return reply.code(400).send({ error: 'orden inválida' });
    const db = openWorldDb(opts.db);
    try {
      const id = enqueueCommand(db, cmd, b.data.arg === undefined ? null : String(b.data.arg), (opts.clock ?? (() => new Date().toISOString()))());
      return { queued: id };
    } finally {
      closeDb(db);
    }
  });

  const catalogs = loadCatalogs();
  const chat = registerChatRoutes(app, {
    rw,
    reader,
    gateway: opts.chat?.gateway ?? defaultGateway(rw),
    catalogs: chatCatalogs(catalogs),
    onto: buildOntology(catalogs),
    authorized: (h) => (opts.auth ? authorized(h, opts.auth) : null),
    clock: opts.clock ?? (() => new Date().toISOString()),
    nowMs: opts.chat?.nowMs ?? (() => Date.now()),
    ...(opts.chat?.waitMs !== undefined ? { waitMs: opts.chat.waitMs } : {}),
  });

  const poll = () => {
    // Un fallo al recargar (base ocupada, estado a medio escribir) no puede tumbar la API: se reintenta al segundo.
    try {
      if (!reader.refresh()) return;
    } catch (e) {
      app.log.warn(`recarga del mundo fallida: ${(e as Error).message}`);
      return;
    }
    const w = reader.world;
    for (const c of clients) {
      sse(c.reply, 'tick', { now: w.now, date: dateOf(w, w.now), status: w.status });
      sendEvents(c);
    }
  };

  return {
    app,
    reader,
    poll,
    sweep: chat.sweep,
    close: async () => {
      for (const c of clients) c.reply.raw.end();
      await app.close();
      reader.close();
      closeDb(rw);
    },
  };
}
