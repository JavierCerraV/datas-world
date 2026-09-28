-- Migración 002: charla con ciudadanos (spec 043 R-001) y registros de la pasarela LLM (spec 026 R-003).
-- Son datos del laboratorio: no forman parte del estado del mundo ni del stateHash. Lo que una charla cambia en
-- el mundo entra por `external_inputs` (chat_open, chat_session) y lo aplica el worker.

CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  citizen_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  mode TEXT NOT NULL,             -- in_world | sandbox
  world_at INTEGER NOT NULL,      -- minuto de la instantánea leída
  world_hash TEXT NOT NULL,
  test_mode INTEGER NOT NULL,
  llm TEXT NOT NULL,              -- JSON: proveedor y modelos
  status TEXT NOT NULL,           -- open | ended
  end_reason TEXT,
  available_until INTEGER,        -- in_world (R-019)
  input_ref TEXT,                 -- "at:seq" de la entrada chat_session
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX chat_sessions_citizen ON chat_sessions(citizen_id, created_at);

CREATE TABLE chat_turns (
  session_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  speaker TEXT NOT NULL,          -- visitor | citizen
  text TEXT NOT NULL,
  data TEXT NOT NULL,             -- JSON: tono, postura, aportes, afirmaciones, verificación, latencia
  created_at TEXT NOT NULL,
  PRIMARY KEY (session_id, seq, speaker)
) WITHOUT ROWID;

-- Registro append-only del laboratorio (043 §5): CHAT_SESSION_STARTED, CHAT_STANCE_SELECTED, …
CREATE TABLE chat_log (
  seq INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  causes TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX chat_log_session ON chat_log(session_id, seq);
CREATE TRIGGER chat_log_no_update BEFORE UPDATE ON chat_log
BEGIN SELECT RAISE(ABORT, 'el registro de la charla es append-only'); END;

CREATE TABLE llm_records (
  key TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  model TEXT NOT NULL,
  response TEXT NOT NULL,
  usage TEXT NOT NULL,
  cost_micros INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  affects_world INTEGER NOT NULL
);
CREATE INDEX llm_records_created ON llm_records(affects_world, created_at);
