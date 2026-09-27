// Datos del laboratorio de charla (spec 043 R-001; migración 002): sesiones, turnos, registro append-only y
// registros de la pasarela LLM (026 R-003). Fuera del estado del mundo y del stateHash.
import type { Db } from './db.ts';

export interface ChatSessionRow {
  id: string;
  citizenId: string;
  visitorId: string;
  mode: 'in_world' | 'sandbox';
  worldAt: number;
  worldHash: string;
  testMode: boolean;
  llm: Record<string, unknown>;
  status: 'open' | 'ended';
  endReason?: string;
  availableUntil?: number;
  inputRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatTurnRow {
  sessionId: string;
  seq: number;
  speaker: 'visitor' | 'citizen';
  text: string;
  data: Record<string, unknown>;
  createdAt: string;
}

interface SessionDb {
  id: string; citizen_id: string; visitor_id: string; mode: string; world_at: number; world_hash: string; test_mode: number;
  llm: string; status: string; end_reason: string | null; available_until: number | null; input_ref: string | null;
  created_at: string; updated_at: string;
}

const toSession = (r: SessionDb): ChatSessionRow => ({
  id: r.id, citizenId: r.citizen_id, visitorId: r.visitor_id, mode: r.mode as ChatSessionRow['mode'], worldAt: r.world_at,
  worldHash: r.world_hash, testMode: r.test_mode === 1, llm: JSON.parse(r.llm) as Record<string, unknown>, status: r.status as ChatSessionRow['status'],
  ...(r.end_reason !== null ? { endReason: r.end_reason } : {}),
  ...(r.available_until !== null ? { availableUntil: r.available_until } : {}),
  ...(r.input_ref !== null ? { inputRef: r.input_ref } : {}),
  createdAt: r.created_at, updatedAt: r.updated_at,
});

/** Id siguiente `CHS-000001` (secuencia del laboratorio, no del mundo). */
export function nextChatSessionId(db: Db): string {
  const row = db.prepare("SELECT id FROM chat_sessions ORDER BY id DESC LIMIT 1").get() as { id: string } | undefined;
  const n = row ? Number(row.id.slice(4)) + 1 : 1;
  return `CHS-${String(n).padStart(6, '0')}`;
}

export function insertChatSession(db: Db, s: ChatSessionRow): void {
  db.prepare(`INSERT INTO chat_sessions (id, citizen_id, visitor_id, mode, world_at, world_hash, test_mode, llm, status, end_reason,
    available_until, input_ref, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    s.id, s.citizenId, s.visitorId, s.mode, s.worldAt, s.worldHash, s.testMode ? 1 : 0, JSON.stringify(s.llm), s.status,
    s.endReason ?? null, s.availableUntil ?? null, s.inputRef ?? null, s.createdAt, s.updatedAt,
  );
}

export function updateChatSession(db: Db, id: string, f: Partial<Pick<ChatSessionRow, 'status' | 'endReason' | 'availableUntil' | 'inputRef'>>, updatedAt: string): void {
  const cur = getChatSession(db, id);
  if (!cur) throw new Error(`Charla inexistente: ${id}`);
  const n = { ...cur, ...f };
  db.prepare('UPDATE chat_sessions SET status = ?, end_reason = ?, available_until = ?, input_ref = ?, updated_at = ? WHERE id = ?')
    .run(n.status, n.endReason ?? null, n.availableUntil ?? null, n.inputRef ?? null, updatedAt, id);
}

export function getChatSession(db: Db, id: string): ChatSessionRow | undefined {
  const r = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id) as SessionDb | undefined;
  return r ? toSession(r) : undefined;
}

export function chatSessionsOf(db: Db, citizenId: string): ChatSessionRow[] {
  return (db.prepare('SELECT * FROM chat_sessions WHERE citizen_id = ? ORDER BY created_at, id').all(citizenId) as SessionDb[]).map(toSession);
}

export function openInWorldSession(db: Db): ChatSessionRow | undefined {
  const r = db.prepare("SELECT * FROM chat_sessions WHERE status = 'open' AND mode = 'in_world' LIMIT 1").get() as SessionDb | undefined;
  return r ? toSession(r) : undefined;
}

export function insertChatTurn(db: Db, t: ChatTurnRow): void {
  db.prepare('INSERT OR REPLACE INTO chat_turns (session_id, seq, speaker, text, data, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(t.sessionId, t.seq, t.speaker, t.text, JSON.stringify(t.data), t.createdAt);
}

export function chatTurns(db: Db, sessionId: string): ChatTurnRow[] {
  const rows = db.prepare('SELECT * FROM chat_turns WHERE session_id = ? ORDER BY seq, speaker DESC').all(sessionId) as {
    session_id: string; seq: number; speaker: string; text: string; data: string; created_at: string;
  }[];
  return rows.map((r) => ({ sessionId: r.session_id, seq: r.seq, speaker: r.speaker as ChatTurnRow['speaker'], text: r.text, data: JSON.parse(r.data) as Record<string, unknown>, createdAt: r.created_at }));
}

export function appendChatLog(db: Db, e: { sessionId: string; type: string; payload: unknown; causes: unknown[]; createdAt: string }): void {
  db.prepare('INSERT INTO chat_log (session_id, type, payload, causes, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(e.sessionId, e.type, JSON.stringify(e.payload), JSON.stringify(e.causes), e.createdAt);
}

export function chatLog(db: Db, sessionId: string): { seq: number; type: string; payload: unknown; causes: unknown[]; createdAt: string }[] {
  const rows = db.prepare('SELECT * FROM chat_log WHERE session_id = ? ORDER BY seq').all(sessionId) as { seq: number; type: string; payload: string; causes: string; created_at: string }[];
  return rows.map((r) => ({ seq: r.seq, type: r.type, payload: JSON.parse(r.payload) as unknown, causes: JSON.parse(r.causes) as unknown[], createdAt: r.created_at }));
}

/** Registro de una respuesta LLM (misma forma que `LlmRecord` de `@datas-world/llm-gateway`). */
export interface StoredLlmRecord {
  key: string;
  purpose: string;
  model: string;
  response: { text?: string; data?: unknown };
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number; cacheWriteTokens: number };
  costMicros: number;
  createdAt: string;
  affectsWorld: boolean;
}

/** Almacén SQLite de `llm_records`; cumple la interfaz `RecordStore` de la pasarela (026 R-003). */
export class SqliteRecordStore {
  #db: Db;
  constructor(db: Db) {
    this.#db = db;
  }
  get(key: string): StoredLlmRecord | undefined {
    const r = this.#db.prepare('SELECT * FROM llm_records WHERE key = ?').get(key) as {
      key: string; purpose: string; model: string; response: string; usage: string; cost_micros: number; created_at: string; affects_world: number;
    } | undefined;
    if (!r) return undefined;
    return {
      key: r.key, purpose: r.purpose, model: r.model, response: JSON.parse(r.response) as StoredLlmRecord['response'],
      usage: JSON.parse(r.usage) as StoredLlmRecord['usage'], costMicros: r.cost_micros, createdAt: r.created_at, affectsWorld: r.affects_world === 1,
    };
  }
  put(rec: StoredLlmRecord): void {
    this.#db.prepare('INSERT OR REPLACE INTO llm_records (key, purpose, model, response, usage, cost_micros, created_at, affects_world) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(rec.key, rec.purpose, rec.model, JSON.stringify(rec.response), JSON.stringify(rec.usage), rec.costMicros, rec.createdAt, rec.affectsWorld ? 1 : 0);
  }
  markAffectsWorld(key: string): void {
    this.#db.prepare('UPDATE llm_records SET affects_world = 1 WHERE key = ?').run(key);
  }
  prune(beforeIso: string): number {
    return this.#db.prepare('DELETE FROM llm_records WHERE affects_world = 0 AND created_at < ?').run(beforeIso).changes;
  }
}
