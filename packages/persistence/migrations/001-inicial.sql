-- Migración 001: esquema inicial (spec 027 §3, v0.3).

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  data BLOB NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE events (
  seq INTEGER PRIMARY KEY,
  id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  at INTEGER NOT NULL,
  importance REAL NOT NULL,
  payload BLOB NOT NULL,
  causes TEXT NOT NULL,
  origin TEXT NOT NULL,
  place_id TEXT
);

CREATE TABLE event_participants (
  event_seq INTEGER NOT NULL,
  entity_id TEXT NOT NULL,
  role TEXT,
  PRIMARY KEY (entity_id, event_seq)
) WITHOUT ROWID;

CREATE INDEX events_at ON events(at);
CREATE INDEX events_type_at ON events(type, at);

-- INV-001: el registro es append-only. La compactación (M4) retirará estos triggers en su propia migración.
CREATE TRIGGER events_no_update BEFORE UPDATE ON events
BEGIN SELECT RAISE(ABORT, 'INV-001: los eventos son inmutables'); END;
CREATE TRIGGER events_no_delete BEFORE DELETE ON events
BEGIN SELECT RAISE(ABORT, 'INV-001: los eventos no se borran'); END;

CREATE TABLE snapshots (at INTEGER PRIMARY KEY, hash TEXT NOT NULL, data BLOB NOT NULL);

CREATE TABLE external_inputs (at INTEGER, seq INTEGER, kind TEXT, payload BLOB, PRIMARY KEY (at, seq));

CREATE TABLE control_commands (
  id INTEGER PRIMARY KEY,
  cmd TEXT,
  arg TEXT,
  created_at TEXT,
  done INTEGER DEFAULT 0
);

CREATE TABLE components (
  name TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  length INTEGER NOT NULL,
  initial REAL NOT NULL,
  data BLOB NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE memory_archive (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  at INTEGER NOT NULL,
  data BLOB NOT NULL
);
CREATE INDEX memory_archive_owner_at ON memory_archive(owner_id, at);
