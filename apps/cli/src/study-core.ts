// Piezas comunes de los comandos del estudio de intervención (spec 047): la pasarela, una sesión con una persona, su
// archivo y el paso del tiempo entre sesiones. El mundo de origen nunca se escribe (INV-003): lo que cambia es una copia.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ACT_PNR_3, MINUTES_PER_DAY, PROTOCOL_FEED_KINDS, learningParams, protocolInputs, stateHash } from '@datas-world/engine';
import type { ChatSessionInput, DisclosureLevel, EntityId, ProtocolSessionInput, SessionNumber, World, WorldEvent } from '@datas-world/engine';
import { buildOntology, lifeRunner, loadCatalogs } from '@datas-world/generators';
import {
  ChatSession, DEFAULT_CONFIG, Gateway, MemoryRecordStore, anthropicAdapter, chatCatalogs, meteredGateway, mockAdapter, openaiCompatibleAdapter, parseConfig,
  patientResponder, runTherapySession,
} from '@datas-world/llm-gateway';
import type { GatewayConfig, MockResponder, ModelConfig, PatientTurnLog, ProviderAdapter, SessionNote, TherapySessionResult, UsageTotals } from '@datas-world/llm-gateway';
import { WorldRepository, WorldSession, acquireWriterLock, openReadonly, openWorldDb, queryEvents, releaseWriterLock } from '@datas-world/persistence';
import { UsageError, dateOf, nameOf, withDb } from './common.ts';
import type { Io } from './common.ts';

/** El terapeuta es siempre el mismo para la persona: lo que aprende de él en una sesión vale en la siguiente (043 R-006). */
export const VISITOR = 'EXT-TERAPEUTA';

/** Una sesión son unas 160 llamadas con el diálogo acumulado: el tope diario de la charla se queda corto. */
const STUDY_TOKENS = 20_000_000;

/** Terapeuta y persona deterministas: el terapeuta trabaja el primer componente pendiente; la persona dice su postura. */
const mockResponder: MockResponder = (c) => {
  const sys = c.system.map((p) => p.text).join('\n');
  if (sys.startsWith('Clasifica el tono')) return '{"tone":"neutro"}';
  if (sys.startsWith('Revisas la respuesta')) return '{"claims":[],"stance":"ok"}';
  if (c.model === 'mock-terapeuta') {
    if (!c.jsonSchema) return `Nota de prueba: ${c.messages[0]!.text.split('\n')[0]}`;
    const component = (/PENDIENTES: (.*)/.exec(sys)?.[1] ?? '').split(', ')[0] ?? '';
    return JSON.stringify({ read: 'Lectura de prueba.', say: `Hablemos de esto (${component}).`, component, covered: [], notes: 'Formulación de prueba.', close: false });
  }
  return `[${/POSTURA PARA ESTE TURNO: ([^.]+)\./.exec(sys)?.[1] ?? 'sin postura'}] respuesta simulada.`;
};

const TRANSIENT = /429|rate.?limit|overloaded|\b50[234]\b|\b529\b|ETIMEDOUT|ECONNRESET/i;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Reintenta ante límites de tasa o sobrecarga; otros fallos pasan tal cual. */
const withRetry = (inner: () => ProviderAdapter, io: Io): ProviderAdapter => ({
  async call(c) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await inner().call(c);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (attempt >= 6 || !TRANSIENT.test(msg) || c.signal.aborted) throw e;
        io.err(`  proveedor ocupado (${msg.slice(0, 80)}); reintento ${attempt} en ${5 * attempt} s`);
        await sleep(5_000 * attempt);
      }
    }
  },
});

/** Pasarela del estudio. `config`: el archivo debe definir `therapist` y `dialogue`; su `budget` es el tope de gasto. */
export function gatewayFor(provider: string, llmConfig: string, io: Io): Gateway {
  const budget = (c: GatewayConfig): GatewayConfig => ({ ...c, budget: { ...c.budget, dailyTokens: Math.max(c.budget.dailyTokens, STUDY_TOKENS) } });
  if (provider === 'mock') {
    const m = (model: string): ModelConfig => ({ provider: 'mock', model, maxOutputTokens: 800, timeoutMs: 5_000 });
    const purposes = { ...DEFAULT_CONFIG.purposes, dialogue: m('mock-persona'), classify: m('mock'), verify: m('mock'), therapist: m('mock-terapeuta') };
    return new Gateway({ config: budget({ ...DEFAULT_CONFIG, purposes }), adapters: { mock: mockAdapter(mockResponder) }, records: new MemoryRecordStore(10_000) });
  }
  if (provider !== 'config') throw new UsageError('--provider debe ser mock o config');
  if (!existsSync(llmConfig)) throw new UsageError(`no existe ${llmConfig} (use --llm-config RUTA)`);
  const config = budget(parseConfig(JSON.parse(readFileSync(llmConfig, 'utf8'))));
  const { therapist, dialogue } = config.purposes;
  if (!therapist || !dialogue) throw new UsageError(`${llmConfig} debe definir los propósitos therapist y dialogue`);
  // Los dos proveedores reales; `openai_compatible` lee LLM_BASE_URL y LLM_API_KEY del entorno, o `baseUrl` del archivo.
  let a: ProviderAdapter | undefined;
  let o: ProviderAdapter | undefined;
  const adapters = {
    anthropic: withRetry(() => (a ??= anthropicAdapter()), io),
    openai_compatible: withRetry(() => (o ??= openaiCompatibleAdapter(therapist.baseUrl ? { baseUrl: therapist.baseUrl } : {})), io),
  };
  return new Gateway({ config, adapters, records: new MemoryRecordStore(10_000) });
}

/** Final de una sesión a la que la persona no fue (047 R-013). */
export const NO_SHOW = 'no_asistio';

/** Uso del LLM por propósito, con su coste en dólares. */
export type UsageByPurpose = Record<string, UsageTotals>;

export const usdOf = (u: UsageByPurpose): number => Object.values(u).reduce((a, m) => a + m.costMicros, 0) / 1e6;

/** Tabla de uso: llamadas, tokens y coste por propósito y modelo. */
export function usageTable(u: UsageByPurpose): string[] {
  const rows = Object.entries(u);
  if (rows.length === 0) return ['Sin llamadas al LLM.'];
  const sum = (k: 'calls' | 'inputTokens' | 'outputTokens' | 'cachedTokens' | 'cacheWriteTokens') => rows.reduce((a, [, m]) => a + m[k], 0);
  return [
    '| Propósito | Modelo | Llamadas | Tokens de entrada | Entrada leída de caché | Entrada escrita en caché | Tokens de salida | Coste (USD) |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map(([p, m]) => `| ${p} | \`${m.model}\` | ${m.calls} | ${m.inputTokens} | ${m.cachedTokens} | ${m.cacheWriteTokens} | ${m.outputTokens} | ${(m.costMicros / 1e6).toFixed(4)} |`),
    `| **total** | | ${sum('calls')} | ${sum('inputTokens')} | ${sum('cachedTokens')} | ${sum('cacheWriteTokens')} | ${sum('outputTokens')} | **${usdOf(u).toFixed(4)}** |`,
  ];
}

/** Suma de varios usos (por propósito). */
export function addUsage(all: readonly UsageByPurpose[]): UsageByPurpose {
  const out: UsageByPurpose = {};
  for (const u of all)
    for (const [p, m] of Object.entries(u)) {
      const t = (out[p] ??= { model: m.model, calls: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, cacheWriteTokens: 0, costMicros: 0 });
      for (const k of ['calls', 'inputTokens', 'outputTokens', 'cachedTokens', 'cacheWriteTokens', 'costMicros'] as const) t[k] += m[k];
    }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** Archivo de una sesión. */
export interface Saved {
  meta: Record<string, string | number>;
  result: Pick<TherapySessionResult, 'detail' | 'fidelity' | 'covered' | 'missing' | 'claimed' | 'therapistTurns'> & { ended: string };
  formulation: string;
  note: string;
  history: SessionNote[];
  transcript: TherapySessionResult['transcript'];
  patient: (Omit<PatientTurnLog, 'verification'> & { stanceCheck: string; unsupported: number })[];
  /** Llamadas, tokens y coste de esta sesión, por propósito. */
  usage: UsageByPurpose;
}

export const readSaved = (path: string): Saved => JSON.parse(readFileSync(path, 'utf8')) as Saved;

const markdownOf = (s: Saved): string => {
  const first = String(s.meta.name).split(' ')[0]!;
  const lines = [
    `# Sesión ${s.meta.session} · ${s.meta.name} (${s.meta.citizen})`,
    '',
    `Fecha del mundo: ${s.meta.date}. Terapeuta: \`${s.meta.therapistModel}\`. Persona: \`${s.meta.patientModel}\`.`,
    `Final: **${s.result.ended}**${s.result.detail ? ` (${s.result.detail})` : ''} · turnos del terapeuta: ${s.result.therapistTurns} · fidelidad: ${Math.round(s.result.fidelity * 100)} %.`,
    `Faltó: ${s.result.missing.join(', ') || 'nada'}.`,
    '',
    '> Sesión con una persona simulada. La postura entre corchetes la decidió el motor y la lectura en cursiva es del terapeuta para sí mismo; ninguno ve lo del otro. No dice nada sobre personas reales.',
    '',
  ];
  let section = '';
  for (const t of s.transcript) {
    if (t.speaker === 'terapeuta' && t.section !== section) lines.push(`### ${(section = t.section)}`, '');
    if (t.speaker === 'terapeuta' && t.read) lines.push(`*(${t.read})*`, '');
    lines.push(t.speaker === 'terapeuta' ? `**Terapeuta:** ${t.text}` : `**${first}** [${t.stance ?? '—'}]: ${t.text}`, '');
  }
  lines.push('## Nota del terapeuta al cerrar', '', s.note || '—', '', '## Formulación del caso', '', s.formulation || '—', '');
  lines.push('## Uso del LLM en esta sesión', '', ...usageTable(s.usage ?? {}), '');
  return lines.join('\n');
};

export function saveSession(saved: Saved, out: string): void {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(`${out}.json`, `${JSON.stringify(saved, null, 2)}\n`);
  writeFileSync(`${out}.md`, markdownOf(saved));
}

export interface LoadedWorld {
  world: World;
  events: WorldEvent[];
}

export const loadWorld = (path: string): LoadedWorld =>
  withDb(openReadonly(path), (db) => ({ world: new WorldRepository(db).loadWorld(), events: queryEvents(db, { limit: 5_000_000 }) }));

/** Personas con algún episodio de pensamiento negativo repetitivo, por id (047 R-001b). */
export const withPnr = (events: readonly WorldEvent[]): string[] =>
  [...new Set(events.filter((e) => e.type === 'PNR_EPISODE').flatMap((e) => e.participants.map((p) => String(p.id))))].sort();

export interface HoldOptions {
  gateway: Gateway;
  provider: string;
  citizenId: string;
  session: number;
  /** Sesión anterior de esta persona: la memoria del terapeuta. */
  prev?: Saved;
  maxTurns: number;
  /** Nivel de intimidad mínimo de la persona en consulta (047 R-005d). */
  minLevel: DisclosureLevel;
  onTurn?: (turn: number, stance: string | undefined) => void;
}

/** Una sesión con una persona sobre un mundo ya cargado. No lo cambia: sin dosis ni eventos (INV-001). */
export async function holdSession({ world, events }: LoadedWorld, o: HoldOptions): Promise<Saved> {
  if (!world.citizens.has(o.citizenId as EntityId)) throw new UsageError(`no existe ${o.citizenId}`);
  if (o.session > ACT_PNR_3.sessions.length) throw new UsageError(`el protocolo tiene ${ACT_PNR_3.sessions.length} sesiones`);
  const catalogs = loadCatalogs();
  const hashBefore = stateHash(world);
  const sessionId = `EST-${o.citizenId}-s${o.session}`;
  const seed = Number.parseInt(createHash('sha256').update(`${hashBefore}:${sessionId}`).digest('hex').slice(0, 8), 16);
  // Varias sesiones comparten pasarela y presupuesto: esta vista lleva la cuenta de lo que gasta esta.
  const meter = meteredGateway(o.gateway);
  const chat = new ChatSession({
    gateway: meter.gateway, catalogs: chatCatalogs(catalogs), onto: buildOntology(catalogs), P: learningParams(world.config.profile, world.config.epoch.slice(0, 10)),
    view: world, citizenId: o.citizenId, events, sessionId, visitorId: VISITOR, seed, now: world.now, setting: 'consulta', minLevel: o.minLevel,
  });
  const history: SessionNote[] = o.prev ? [...o.prev.history, { session: Number(o.prev.meta.session), note: o.prev.note }] : [];
  const log: PatientTurnLog[] = [];
  const respond = patientResponder(chat, log);
  const r = await runTherapySession({
    gateway: meter.gateway, protocol: ACT_PNR_3, session: o.session as SessionNumber, patientName: chat.view.name, citizenId: o.citizenId, maxTurns: o.maxTurns, history,
    ...(o.prev ? { formulation: o.prev.formulation } : {}),
    respond: async (say, turn) => {
      const reply = await respond(say, turn);
      o.onTurn?.(turn, reply.stance);
      return reply;
    },
  });
  const patient: Saved['patient'] = [];
  for (const { verification, ...l } of log) {
    const ver = await verification;
    patient.push({ ...l, stanceCheck: ver.stanceCheck, unsupported: ver.claims.filter((c) => c.verdict !== 'supported').length });
  }
  const cfg = o.gateway.config.purposes;
  return {
    meta: {
      generatedFor: 'spec 047', world: world.id, citizen: o.citizenId, name: nameOf(world, o.citizenId), session: o.session, date: dateOf(world.now, world.config.epoch),
      provider: o.provider, therapistModel: cfg.therapist?.model ?? '', patientModel: cfg.dialogue?.model ?? '', minLevel: o.minLevel, hashBefore, hashAfter: stateHash(world),
    },
    result: { ended: r.ended, ...(r.detail ? { detail: r.detail } : {}), fidelity: r.fidelity, covered: r.covered, missing: r.missing, claimed: r.claimed, therapistTurns: r.therapistTurns },
    formulation: r.formulation, note: r.note, history, transcript: r.transcript, patient, usage: meter.usage(),
  };
}

/** El archivo de una sesión a la que la persona no fue (R-013): sin diálogo, y la memoria del terapeuta sigue igual. */
export function noShow({ world }: LoadedWorld, o: Pick<HoldOptions, 'citizenId' | 'session' | 'prev' | 'provider' | 'minLevel'>, probability: number): Saved {
  const hash = stateHash(world);
  return {
    meta: {
      generatedFor: 'spec 047', world: world.id, citizen: o.citizenId, name: nameOf(world, o.citizenId), session: o.session, date: dateOf(world.now, world.config.epoch),
      provider: o.provider, therapistModel: '', patientModel: '', minLevel: o.minLevel, hashBefore: hash, hashAfter: hash, attendProbability: Math.round(probability * 1000) / 1000,
    },
    result: { ended: NO_SHOW, fidelity: 0, covered: [], missing: [], claimed: [], therapistTurns: 0 },
    formulation: o.prev?.formulation ?? '', note: o.prev ? `No asistió a la sesión ${o.session}. ${o.prev.note}` : `No asistió a la sesión ${o.session}.`,
    history: o.prev ? [...o.prev.history, { session: Number(o.prev.meta.session), note: o.prev.note }] : [], transcript: [], patient: [], usage: {},
  };
}

/** Una entrada externa para la copia de trabajo. */
export interface StudyInput {
  kind: string;
  payload: unknown;
}

/**
 * Lo que una sesión deja en el mundo (047 R-004, INV-001), como entradas externas: la charla, que la persona recuerda
 * como cualquier conversación (043 R-019), y la sesión del protocolo, de la que el motor saca la dosis a partir de qué
 * componente se trabajó en cada turno y con qué postura respondió ella. Ningún texto del LLM entra al mundo.
 */
export function inputsOf(s: Saved): StudyInput[] {
  const citizenId = String(s.meta.citizen) as EntityId;
  const session = Number(s.meta.session);
  const attended = s.result.ended !== NO_SHOW;
  const out: StudyInput[] = [];
  const turns = s.patient.map((p) => ({ tone: p.tone, stance: p.stance }));
  if (turns.length > 0) {
    const chat: ChatSessionInput = { sessionId: `EST-${citizenId}-s${session}`, citizenId, visitorId: VISITOR, turns, summary: `Fue a consulta con un psicólogo (sesión ${session}).` };
    out.push({ kind: 'chat_session', payload: chat });
  }
  const exchanges = s.transcript.filter((t) => t.speaker === 'persona' && t.stance).map((t) => ({ component: t.section, stance: t.stance! }));
  const protocol: ProtocolSessionInput = { citizenId, protocol: ACT_PNR_3.id, session, attended, fidelity: s.result.fidelity, exchanges };
  out.push({ kind: 'protocol_session', payload: protocol });
  return out;
}

export interface AdvanceOptions {
  /** Entradas que se aplican antes de avanzar, en el minuto actual. */
  atStart?: readonly StudyInput[];
  /** Entradas de cada día, tras avanzarlo: `day` cuenta desde 1. */
  daily?: (day: number) => readonly StudyInput[];
}

/**
 * Avanza la copia de trabajo (047 R-003, R-010): aplica las entradas pendientes y deja que el mundo siga solo. Con
 * `daily`, avanza día a día para aplicar las de cada uno (la práctica, R-006). Los dos brazos usan el mismo Runner, con
 * los manejadores del protocolo, para que sin entradas sean idénticos (INV-002).
 */
export function advanceWorld(work: string, minutes: number, o: AdvanceOptions = {}): void {
  withDb(openWorldDb(work), (db) => {
    acquireWriterLock(db);
    try {
      const repo = new WorldRepository(db);
      const world = repo.loadWorld();
      const catalogs = loadCatalogs();
      const session = new WorldSession(repo, lifeRunner(world, catalogs, {}, { inputs: protocolInputs({ onto: buildOntology(catalogs) }), feedKinds: PROTOCOL_FEED_KINDS }));
      const ticks = (m: number) => Math.round(m / world.config.tickMinutes);
      for (const i of o.atStart ?? []) session.runner.submit(i.kind, i.payload);
      if (!o.daily) session.advanceTicks(ticks(minutes));
      else {
        const days = Math.floor(minutes / MINUTES_PER_DAY);
        for (let day = 1; day <= days; day++) {
          session.advanceTicks(ticks(MINUTES_PER_DAY));
          for (const i of o.daily(day)) session.runner.submit(i.kind, i.payload);
        }
        if (minutes > days * MINUTES_PER_DAY) session.advanceTicks(ticks(minutes - days * MINUTES_PER_DAY));
        session.flush(true);
      }
    } finally {
      releaseWriterLock(db);
    }
  });
}

/** Fecha y hash de una base, para comprobar que es el mundo de una sesión. */
export const stampOf = (path: string): { date: string; hash: string } =>
  withDb(openReadonly(path), (db) => {
    const w = new WorldRepository(db).loadWorld();
    return { date: dateOf(w.now, w.config.epoch), hash: stateHash(w) };
  });
