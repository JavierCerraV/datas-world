-- Migración 004: viajes para el visor (spec 027 R-013). El worker anota cada viaje al empezar, tick a tick, para
-- que el visor reproduzca los trayectos a su hora. Es un dato de observación: no forma parte del estado del mundo
-- ni del stateHash, el motor no lo lee y solo se guardan los últimos días (MOVES_KEEP_DAYS).

CREATE TABLE movements (
  citizen_id INTEGER NOT NULL,    -- número del CIT
  depart_at INTEGER NOT NULL,     -- minuto de salida
  arrive_at INTEGER NOT NULL,     -- minuto de llegada
  from_place INTEGER NOT NULL,    -- número del PLC de origen
  to_place INTEGER NOT NULL,      -- número del PLC de destino
  mode TEXT NOT NULL,             -- walk, bike, moto, car o bus (016)
  PRIMARY KEY (citizen_id, depart_at)
) WITHOUT ROWID;

CREATE INDEX movements_arrive ON movements (arrive_at);
