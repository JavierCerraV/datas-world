-- Migración 005: índice de los participantes por evento (spec 027 §3). La clave primaria de `event_participants`
-- empieza por la entidad, así que leer los participantes de un evento recorría la tabla entera: con 47 000 filas, 343 ms
-- para los 234 eventos de una persona, y la ficha y el informe de vida del visor tardaban segundos. Coste: una copia
-- de (event_seq, entity_id) por fila, unos 20 MB en un mundo de un millón de participaciones.

CREATE INDEX event_participants_seq ON event_participants (event_seq);
