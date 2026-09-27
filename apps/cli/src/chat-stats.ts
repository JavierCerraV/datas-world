// `pnpm cli chat:stats` (spec 043 R-023, tarea L4.3): latencia y coste de las charlas guardadas en la base, para
// comprobar con el proveedor real los objetivos de fluidez (`FIRST_TOKEN_P50_MS`, `TOTAL_P95_MS`) y cuánto cuesta
// una sesión. Solo lee las tablas del laboratorio (chat_sessions, chat_turns, llm_records); no toca el mundo.
import { parseArgs } from 'node:util';
import { openReadonly } from '@datas-world/persistence';
import type { Db } from '@datas-world/persistence';
import { DEFAULT_DB, withDb } from './common.ts';
import type { Io } from './common.ts';

/** 043 §8: objetivos de fluidez. */
export const FIRST_TOKEN_P50_MS = 1_500;
export const TOTAL_P95_MS = 5_000;

export interface ChatStats {
  sessions: number;
  inWorld: number;
  turns: number;
  /** Respuestas del ciudadano generadas por el LLM (el resto, plantillas sin LLM, R-014). */
  llmTurns: number;
  firstToken: { p50: number; p95: number; n: number };
  total: { p50: number; p95: number; n: number };
  meetsTargets: { firstTokenP50: boolean; totalP95: boolean };
  /** Coste en dólares por propósito (todas las llamadas registradas) y por sesión. */
  costByPurpose: Record<string, { calls: number; usd: number; inputTokens: number; outputTokens: number; cachedTokens: number }>;
  totalUsd: number;
  /** Coste total repartido entre las sesiones con al menos un turno. */
  usdPerSession: number;
  /** Coste de clasificar y expresar ligado a cada sesión por sus referencias (sin verificar ni resumir). */
  perSession: { id: string; citizenId: string; turns: number; usd: number }[];
}

const pct = (xs: number[], p: number) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]!);
};
const usd = (micros: number) => micros / 1_000_000;

export function chatStats(db: Db): ChatStats {
  const sessions = db.prepare('SELECT id, citizen_id, mode FROM chat_sessions ORDER BY id').all() as { id: string; citizen_id: string; mode: string }[];
  const turns = db.prepare('SELECT session_id, speaker, data FROM chat_turns ORDER BY session_id, seq, speaker DESC').all() as { session_id: string; speaker: string; data: string }[];
  const records = db.prepare('SELECT key, purpose, usage, cost_micros FROM llm_records ORDER BY key').all() as { key: string; purpose: string; usage: string; cost_micros: number }[];
  const costOf = new Map(records.map((r) => [r.key, r.cost_micros]));

  const firstToken: number[] = [];
  const total: number[] = [];
  let citizenTurns = 0;
  let llmTurns = 0;
  const bySession = new Map<string, { turns: number; micros: number }>();
  for (const t of turns) {
    const d = JSON.parse(t.data) as { llmRef?: string | null; expression?: string; latencyMs?: { firstToken?: number; total?: number } };
    const s = bySession.get(t.session_id) ?? { turns: 0, micros: 0 };
    if (d.llmRef) s.micros += costOf.get(d.llmRef) ?? 0;
    if (t.speaker === 'citizen') {
      s.turns++;
      citizenTurns++;
      if (d.expression === 'llm') {
        llmTurns++;
        if (d.latencyMs?.firstToken !== undefined) firstToken.push(d.latencyMs.firstToken);
        if (d.latencyMs?.total !== undefined) total.push(d.latencyMs.total);
      }
    }
    bySession.set(t.session_id, s);
  }

  const costByPurpose: ChatStats['costByPurpose'] = {};
  let totalMicros = 0;
  for (const r of records) {
    const u = JSON.parse(r.usage) as { inputTokens: number; outputTokens: number; cachedTokens: number };
    const c = (costByPurpose[r.purpose] ??= { calls: 0, usd: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0 });
    c.calls++;
    c.usd += usd(r.cost_micros);
    c.inputTokens += u.inputTokens;
    c.outputTokens += u.outputTokens;
    c.cachedTokens += u.cachedTokens;
    totalMicros += r.cost_micros;
  }
  const withTurns = sessions.filter((s) => (bySession.get(s.id)?.turns ?? 0) > 0).length;
  const ft = { p50: pct(firstToken, 0.5), p95: pct(firstToken, 0.95), n: firstToken.length };
  const tt = { p50: pct(total, 0.5), p95: pct(total, 0.95), n: total.length };
  return {
    sessions: sessions.length,
    inWorld: sessions.filter((s) => s.mode === 'in_world').length,
    turns: citizenTurns,
    llmTurns,
    firstToken: ft,
    total: tt,
    meetsTargets: { firstTokenP50: ft.n > 0 && ft.p50 <= FIRST_TOKEN_P50_MS, totalP95: tt.n > 0 && tt.p95 <= TOTAL_P95_MS },
    costByPurpose,
    totalUsd: usd(totalMicros),
    usdPerSession: withTurns > 0 ? usd(totalMicros) / withTurns : 0,
    perSession: sessions.map((s) => ({ id: s.id, citizenId: s.citizen_id, turns: bySession.get(s.id)?.turns ?? 0, usd: usd(bySession.get(s.id)?.micros ?? 0) })),
  };
}

const money = (x: number) => `${x.toFixed(4)} USD`;
const mark = (ok: boolean, n: number) => (n === 0 ? 'sin datos' : ok ? 'cumple' : 'NO cumple');

export function formatChatStats(s: ChatStats): string[] {
  const lines = [
    `Charlas: ${s.sessions} (${s.inWorld} en el mundo) · respuestas del ciudadano: ${s.turns}, con LLM ${s.llmTurns}, con plantilla ${s.turns - s.llmTurns}`,
    `Primer token: p50 ${s.firstToken.p50} ms, p95 ${s.firstToken.p95} ms (${s.firstToken.n} respuestas) · objetivo p50 ≤ ${FIRST_TOKEN_P50_MS} ms: ${mark(s.meetsTargets.firstTokenP50, s.firstToken.n)}`,
    `Respuesta completa: p50 ${s.total.p50} ms, p95 ${s.total.p95} ms · objetivo p95 ≤ ${TOTAL_P95_MS} ms: ${mark(s.meetsTargets.totalP95, s.total.n)}`,
    `Coste total: ${money(s.totalUsd)} · por charla con mensajes: ${money(s.usdPerSession)}`,
    'Por propósito:',
    ...Object.entries(s.costByPurpose).map(([p, c]) => `  ${p.padEnd(10)} ${String(c.calls).padStart(5)} llamadas · ${money(c.usd)} · entrada ${c.inputTokens} tk, salida ${c.outputTokens} tk, caché ${c.cachedTokens} tk`),
  ];
  const top = [...s.perSession].filter((x) => x.turns > 0).sort((a, b) => b.usd - a.usd || (a.id < b.id ? -1 : 1)).slice(0, 5);
  if (top.length) lines.push('Charlas más caras (clasificar + expresar):', ...top.map((x) => `  ${x.id} ${x.citizenId} · ${x.turns} turnos · ${money(x.usd)}`));
  return lines;
}

export function chatStatsCommand(args: string[], io: Io): void {
  const { values: v } = parseArgs({ args, options: { db: { type: 'string', default: DEFAULT_DB }, json: { type: 'boolean', default: false } } });
  const s = withDb(openReadonly(v.db), chatStats);
  if (v.json) io.out(JSON.stringify(s, null, 2));
  else for (const l of formatChatStats(s)) io.out(l);
}
