-- Migración 003: trayectoria diaria de cada persona (spec 020 R-001). Se escribe con la instantánea diaria y se
-- deriva del estado, como ella: no forma parte del estado del mundo ni del stateHash, y borrarla no cambia la
-- simulación (020 INV-003).

CREATE TABLE trajectory (
  citizen_id INTEGER NOT NULL,    -- número del CIT
  day INTEGER NOT NULL,           -- día del mundo (minuto / 1440)
  mood REAL NOT NULL,
  stress REAL NOT NULL,
  money INTEGER NOT NULL,
  sleep_debt INTEGER NOT NULL,
  PRIMARY KEY (citizen_id, day)
) WITHOUT ROWID;
