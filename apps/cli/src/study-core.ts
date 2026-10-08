// Piezas comunes de los comandos del estudio de intervención (spec 047): la pasarela, una sesión con una persona, su
// archivo y el paso del tiempo entre sesiones. El mundo de origen nunca se escribe (INV-003): lo que cambia es una copia.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ACT_PNR_3, learningParams, stateHash } from '@datas-world/engine';
import type { ChatSessionInput, DisclosureLevel, EntityId, SessionNumber, World, WorldEvent } from '@datas-world/engine';
import { buildOntology, lifeRunner, loadCatalogs } from '@datas-world/generators';
import {
  ChatSession, DEFAULT_CONFIG, Gateway, MemoryRecordStore, anthropicAdapter, chatCatalogs, mockAdapter, openaiCompatibleAdapter, parseConfig, patientResponder,
  runTherapySession,
} from '@datas-world/llm-gateway';
import type { GatewayConfig, MockResponder, ModelConfig, PatientTurnLog, ProviderAdapter, SessionNote, TherapySessionResult } from '@datas-world/llm-gateway';
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

/** Coste acumulado de la pasarela en dólares. */
export const costOf = (gateway: Gateway): number => Object.values(gateway.metrics()).reduce((a, m) => a + m.costMicros, 0) / 1e6;

/** Archivo de una sesión. */
export interface Saved {
  meta: Record<string, string | number>;
  result: Pick<TherapySessionResult, 'ended' | 'detail' | 'fidelity' | 'covered' | 'missing' | 'claimed' | 'therapistTurns'>;
  formulation: string;
  note: string;
  history: SessionNote[];
  transcript: TherapySessionResult['transcript'];
  patient: (Omit<PatientTurnLog, 'verification'> & { stanceCheck: string; unsupported: number })[];
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
  const chat = new ChatSession({
    gateway: o.gateway, catalogs: chatCatalogs(catalogs), onto: buildOntology(catalogs), P: learningParams(world.config.profile, world.config.epoch.slice(0, 10)),
    view: world, citizenId: o.citizenId, events, sessionId, visitorId: VISITOR, seed, now: world.now, setting: 'consulta', minLevel: o.minLevel,
  });
  const history: SessionNote[] = o.prev ? [...o.prev.history, { session: Number(o.prev.meta.session), note: o.prev.note }] : [];
  const log: PatientTurnLog[] = [];
  const respond = patientResponder(chat, log);
  const r = await runTherapySession({
    gateway: o.gateway, protocol: ACT_PNR_3, session: o.session as SessionNumber, patientName: chat.view.name, citizenId: o.citizenId, maxTurns: o.maxTurns, history,
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
    formulation: r.formulation, note: r.note, history, transcript: r.transcript, patient,
  };
}

/**
 * Pasa el tiempo entre sesiones en la copia de trabajo (047 R-003, R-010). Primero la charla de cada sesión anterior
 * entra en la vida de su persona como cualquier conversación (043 R-019: la recuerda y aprende de cómo la trataron);
 * después el mundo avanza solo. Aún sin dosis del protocolo (R-004).
 */
export function advanceWorld(work: string, prevs: readonly Saved[], minutes: number): void {
  withDb(openWorldDb(work), (db) => {
    acquireWriterLock(db);
    try {
      const repo = new WorldRepository(db);
      const world = repo.loadWorld();
      const session = new WorldSession(repo, lifeRunner(world));
      for (const prev of prevs) {
        const turns = prev.patient.map((p) => ({ tone: p.tone, stance: p.stance }));
        if (turns.length === 0) continue;
        const input: ChatSessionInput = {
          sessionId: `EST-${prev.meta.citizen}-s${prev.meta.session}`, citizenId: String(prev.meta.citizen) as EntityId, visitorId: VISITOR, turns,
          summary: `Fue a consulta con un psicólogo (sesión ${prev.meta.session}).`,
        };
        session.runner.submit('chat_session', input);
      }
      session.advanceTicks(Math.round(minutes / world.config.tickMinutes));
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
