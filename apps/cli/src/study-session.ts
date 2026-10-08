// `pnpm cli study:session` (spec 047): UNA sesión del protocolo con una persona, para leer el diálogo antes de correr el
// estudio. El terapeuta y la persona van en llamadas separadas; el mundo se lee y no se toca (INV-001, INV-003): aquí no
// hay dosis ni eventos. Escribe la transcripción (JSON y Markdown) con la postura de cada turno y la nota del terapeuta.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { ACT_PNR_3, learningParams, stateHash } from '@datas-world/engine';
import type { EntityId, SessionNumber } from '@datas-world/engine';
import { buildOntology, loadCatalogs } from '@datas-world/generators';
import {
  ChatSession, DEFAULT_CONFIG, Gateway, MAX_TURNS_SESSION, MemoryRecordStore, anthropicAdapter, chatCatalogs, mockAdapter, openaiCompatibleAdapter, parseConfig,
  patientResponder, runTherapySession,
} from '@datas-world/llm-gateway';
import type { GatewayConfig, MockResponder, ModelConfig, PatientTurnLog, ProviderAdapter, SessionNote, TherapySessionResult } from '@datas-world/llm-gateway';
import { WorldRepository, openReadonly, queryEvents } from '@datas-world/persistence';
import { DEFAULT_DB, UsageError, dateOf, nameOf, toInt, withDb } from './common.ts';
import type { Io } from './common.ts';

/** Una sesión son unas 80 llamadas con el diálogo acumulado: el tope diario de la charla se queda corto. */
const SESSION_TOKENS = 6_000_000;

/** Terapeuta y persona deterministas: el terapeuta trabaja el primer componente pendiente; la persona dice su postura. */
const mockResponder: MockResponder = (c) => {
  const sys = c.system.map((p) => p.text).join('\n');
  if (sys.startsWith('Clasifica el tono')) return '{"tone":"neutro"}';
  if (sys.startsWith('Revisas la respuesta')) return '{"claims":[],"stance":"ok"}';
  if (c.model === 'mock-terapeuta') {
    if (!c.jsonSchema) return `Nota de prueba: ${c.messages[0]!.text.split('\n')[0]}`;
    const component = (/PENDIENTES: (.*)/.exec(sys)?.[1] ?? '').split(', ')[0]?.split(' ')[0] ?? '';
    return JSON.stringify({ say: `Hablemos de esto (${component}).`, component, covered: [], notes: 'Formulación de prueba.' });
  }
  return `[${/POSTURA PARA ESTE TURNO: ([^.]+)\./.exec(sys)?.[1] ?? 'sin postura'}] respuesta simulada.`;
};

const TRANSIENT = /429|rate.?limit|overloaded|\b50[234]\b|\b529\b|ETIMEDOUT|ECONNRESET/i;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Reintenta ante límites de tasa o sobrecarga (proveedores gratuitos); otros fallos pasan tal cual. */
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

function gatewayFor(provider: string, llmConfig: string, io: Io): Gateway {
  const budget = (c: GatewayConfig): GatewayConfig => ({ ...c, budget: { ...c.budget, dailyTokens: Math.max(c.budget.dailyTokens, SESSION_TOKENS) } });
  if (provider === 'mock') {
    const m = (model: string): ModelConfig => ({ provider: 'mock', model, maxOutputTokens: 800, timeoutMs: 5_000 });
    const purposes = { ...DEFAULT_CONFIG.purposes, dialogue: m('mock-persona'), classify: m('mock'), verify: m('mock'), therapist: m('mock-terapeuta') };
    return new Gateway({ config: budget({ ...DEFAULT_CONFIG, purposes }), adapters: { mock: mockAdapter(mockResponder) }, records: new MemoryRecordStore(10_000) });
  }
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

interface Saved {
  meta: Record<string, string | number>;
  result: Pick<TherapySessionResult, 'ended' | 'detail' | 'fidelity' | 'covered' | 'missing' | 'claimed' | 'therapistTurns'>;
  formulation: string;
  note: string;
  history: SessionNote[];
  transcript: TherapySessionResult['transcript'];
  patient: (Omit<PatientTurnLog, 'verification'> & { stanceCheck: string; unsupported: number })[];
  /** Llamadas, fuentes, tokens y coste por propósito. Sin latencias: el archivo debe ser reproducible con `mock`. */
  usage: Record<string, { calls: number; bySource: unknown; byFallback: unknown; usage: unknown; costMicros: number }>;
}

const usageOf = (gateway: Gateway): Saved['usage'] =>
  Object.fromEntries(Object.entries(gateway.metrics()).sort(([a], [b]) => (a < b ? -1 : 1)).map(([p, m]) => [p, { calls: m.calls, bySource: m.bySource, byFallback: m.byFallback, usage: m.usage, costMicros: m.costMicros }]));

const markdownOf = (s: Saved): string => {
  const first = String(s.meta.name).split(' ')[0]!;
  const lines = [
    `# Sesión ${s.meta.session} · ${s.meta.name} (${s.meta.citizen})`,
    '',
    `Fecha del mundo: ${s.meta.date}. Terapeuta: \`${s.meta.therapistModel}\`. Persona: \`${s.meta.patientModel}\`.`,
    `Final: **${s.result.ended}**${s.result.detail ? ` (${s.result.detail})` : ''} · turnos del terapeuta: ${s.result.therapistTurns} · fidelidad: ${Math.round(s.result.fidelity * 100)} %.`,
    `Faltó: ${s.result.missing.join(', ') || 'nada'}.`,
    '',
    '> Prueba de una sesión con una persona simulada. La postura entre corchetes la decidió el motor; el terapeuta no la ve. No dice nada sobre personas reales.',
    '',
  ];
  let section = '';
  for (const t of s.transcript) {
    if (t.speaker === 'terapeuta' && t.section !== section) lines.push(`### ${(section = t.section)}`, '');
    lines.push(t.speaker === 'terapeuta' ? `**Terapeuta:** ${t.text}` : `**${first}** [${t.stance ?? '—'}]: ${t.text}`, '');
  }
  lines.push('## Nota del terapeuta al cerrar', '', s.note || '—', '', '## Formulación del caso', '', s.formulation || '—', '');
  return lines.join('\n');
};

export async function studySession(args: string[], io: Io): Promise<void> {
  const { values: v } = parseArgs({
    args,
    options: {
      db: { type: 'string', default: DEFAULT_DB }, citizen: { type: 'string' }, session: { type: 'string' }, previous: { type: 'string' },
      provider: { type: 'string', default: 'mock' }, 'llm-config': { type: 'string', default: 'config/llm.json' },
      'max-turns': { type: 'string', default: String(MAX_TURNS_SESSION) }, out: { type: 'string', default: 'data/estudio/sesion' },
    },
  });
  if (v.provider !== 'mock' && v.provider !== 'config') throw new UsageError('--provider debe ser mock o config');
  const maxTurns = toInt('max-turns', v['max-turns'], 1);
  // La sesión anterior da la persona, la memoria del terapeuta y el número de esta.
  const prev = v.previous ? (JSON.parse(readFileSync(v.previous, 'utf8')) as Saved) : undefined;
  const n = v.session ? toInt('session', v.session, 1) : prev ? Number(prev.meta.session) + 1 : 1;
  if (n > ACT_PNR_3.sessions.length) throw new UsageError(`el protocolo tiene ${ACT_PNR_3.sessions.length} sesiones`);

  const { world, events } = withDb(openReadonly(v.db!), (db) => {
    const w = new WorldRepository(db).loadWorld();
    return { world: w, events: queryEvents(db, { limit: 5_000_000 }) };
  });
  // Sin persona indicada: la primera que tuvo un episodio de PNR (047 R-001b).
  const withPnr = [...new Set(events.filter((e) => e.type === 'PNR_EPISODE').flatMap((e) => e.participants.map((p) => String(p.id))))].sort();
  const citizenId = v.citizen ?? (prev ? String(prev.meta.citizen) : withPnr[0]);
  if (!citizenId) throw new UsageError('ninguna persona tuvo episodios de PNR en este mundo: indique --citizen CIT-…');
  if (!world.citizens.has(citizenId as EntityId)) throw new UsageError(`no existe ${citizenId}`);

  const gateway = gatewayFor(v.provider!, v['llm-config']!, io);
  const catalogs = loadCatalogs();
  const hashBefore = stateHash(world);
  const sessionId = `EST-${citizenId}-s${n}`;
  const seed = Number.parseInt(createHash('sha256').update(`${hashBefore}:${sessionId}`).digest('hex').slice(0, 8), 16);
  const chat = new ChatSession({
    gateway, catalogs: chatCatalogs(catalogs), onto: buildOntology(catalogs), P: learningParams(world.config.profile, world.config.epoch.slice(0, 10)),
    view: world, citizenId, events, sessionId, visitorId: 'EXT-TERAPEUTA', seed, now: world.now, setting: 'consulta', minLevel: 1,
  });
  const history: SessionNote[] = prev ? [...prev.history, { session: Number(prev.meta.session), note: prev.note }] : [];
  const log: PatientTurnLog[] = [];
  io.err(`Sesión ${n} con ${nameOf(world, citizenId)} (${citizenId}), hasta ${maxTurns} turnos…`);
  const r = await runTherapySession({
    gateway, protocol: ACT_PNR_3, session: n as SessionNumber, patientName: chat.view.name, citizenId, maxTurns, history,
    ...(prev ? { formulation: prev.formulation } : {}),
    respond: async (say, turn) => {
      const reply = await patientResponder(chat, log)(say, turn);
      io.err(`  turno ${turn + 1}: ${reply.stance ?? 'se fue'}`);
      return reply;
    },
  });

  const cfg = gateway.config.purposes;
  const patient: Saved['patient'] = [];
  for (const { verification, ...l } of log) {
    const ver = await verification;
    patient.push({ ...l, stanceCheck: ver.stanceCheck, unsupported: ver.claims.filter((c) => c.verdict !== 'supported').length });
  }
  const saved: Saved = {
    meta: {
      generatedFor: 'spec 047', world: world.id, citizen: citizenId, name: nameOf(world, citizenId), session: n, date: dateOf(world.now, world.config.epoch),
      provider: v.provider!, therapistModel: cfg.therapist?.model ?? '', patientModel: cfg.dialogue?.model ?? '', hashBefore, hashAfter: stateHash(world),
    },
    result: { ended: r.ended, ...(r.detail ? { detail: r.detail } : {}), fidelity: r.fidelity, covered: r.covered, missing: r.missing, claimed: r.claimed, therapistTurns: r.therapistTurns },
    formulation: r.formulation, note: r.note, history, transcript: r.transcript, patient, usage: usageOf(gateway),
  };
  mkdirSync(dirname(v.out!), { recursive: true });
  writeFileSync(`${v.out}.json`, `${JSON.stringify(saved, null, 2)}\n`);
  writeFileSync(`${v.out}.md`, markdownOf(saved));

  const templates = patient.filter((p) => p.expression === 'template').length;
  const cost = Object.values(saved.usage).reduce((a, m) => a + m.costMicros, 0) / 1e6;
  io.out(`Sesión ${n}: ${r.ended}${r.detail ? ` (${r.detail})` : ''} · ${r.therapistTurns} turnos · fidelidad ${Math.round(r.fidelity * 100)} % · coste ${cost.toFixed(4)} USD`);
  if (templates > 0) io.out(`AVISO: en ${templates} de ${patient.length} turnos el LLM de la persona no respondió y habló la plantilla de la postura.`);
  io.out(`Transcripción: ${v.out}.md · datos: ${v.out}.json`);
  if (r.ended === 'sin_llm') throw new Error(`el LLM del terapeuta no respondió (${r.detail ?? 'sin detalle'})`);
}
