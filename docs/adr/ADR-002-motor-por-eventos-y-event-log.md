# ADR-002 — Motor por ticks con registro de eventos append-only

- **Estado:** aceptada
- **Fecha:** 2026-09-23

## Contexto

La visión exige: explicar por qué pasó cada cosa, reproducir el mundo, retroceder (rewind) y reproducir (replay), y conservar historia distinta del estado actual. También tiempo acelerado hasta 1000x.

## Decisión

1. **Tick fijo** del motor (por defecto 5 minutos de mundo). En cada tick se ejecutan sistemas en orden fijo: necesidades → decisiones → acciones → interacciones → economía → memoria → eventos.
2. **Scheduler de eventos futuros** (cola de prioridad por `WorldMinute`, desempate por id) para cosas programadas: pagos, citas, turnos, fin de enfermedad.
3. **Niveles de simulación** (0–4, spec 021): las personas no observadas y sin eventos relevantes se simulan a menor resolución (resúmenes por franja horaria) para ahorrar CPU.
4. **Registro de eventos append-only** en SQLite, con `causes[]`. Los eventos nunca se modifican ni borran (salvo compactación documentada de eventos triviales, spec 027).
5. **Instantáneas periódicas** del estado completo (por defecto cada día de mundo) comprimidas. Rewind = cargar la instantánea anterior + re-simular con la misma semilla y entradas. Replay = lo mismo sin persistir.
6. Las **entradas externas** (acciones del observador, experimentos, futuras intervenciones clínicas) también son eventos con `origin: "external"` y se guardan para que la re-simulación sea exacta.

## Alternativas descartadas

- *Event sourcing puro* (estado = fold de todos los eventos): re-proyectar años de eventos es caro con ½ vCore. Se usa híbrido estado + eventos + instantáneas.
- *Simulación continua por agente asíncrono*: no determinista y difícil de reproducir.

## Consecuencias

- El determinismo se prueba comparando hashes de estado tras N ticks.
- El disco crece con los eventos: se define política de retención y compactación (spec 027) para caber en 5 GB.
