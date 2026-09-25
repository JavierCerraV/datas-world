# M2 — Vida diaria

Specs aprobadas: 010, 011, 015, 016, 017 y 021, más los criterios **(M2)** de 004, 005, 006, 008, 009, 023, 031, 032 y 033.

**Resultado esperado:** `pnpm cli world:advance --days 30` hace que las 200 personas de Data's World **vivan**:
- se levantan (o se quedan dormidas), comen, trabajan o estudian, descansan;
- van al bar, a misa o a La Capital según su ficha;
- cobran la quincena, pagan el arriendo y los servicios, se enferman, se endeudan.

Cada cosa que les pasa queda como evento con sus causas. Ánimo, estrés, empleo y dinero caen dentro de la tolerancia del prototipo (`pnpm cli validate:parity`).

**Cómo se trabaja:** cada bloque va en su rama (`m2/a-bucle`, `m2/b-necesidades`…) y termina con un PR que el usuario aprueba. Antes de programar cada bloque, se muestran el plan breve y los criterios que se cubrirán.

## Bloque A — Bucle de simulación y registro de sistemas (spec 021)
- [x] A1. Interfaz `System` (fase, orden, capacidad, cadencia, `run` y `runCoarse`), registro estático ordenado y validado (R-005), `WorldView` de solo lectura (congelada en pruebas) y parches aplicados al final de cada fase (R-007).
- [x] A2. Flujos RNG por sistema (`sys:<id>`, R-008). Las capacidades de M2 (`needs`, `routines`, `mobility`, `economy`) ya existían en la spec 001; el motor de decisiones usa `routines`, sin capacidad nueva.
- [x] A3. Niveles de M2 (R-011): todos en nivel 2, con `runCoarse` para quien está por debajo del mínimo de un sistema. El presupuesto (R-009) y la observación (R-010) llegan con los niveles 3 y 4 (M3–M4).
- [x] A4. Criterios: 021 CA-004, CA-005 y CA-006. El `tick` de M0 recorre el registro sin cambiar el hash de un mundo sin sistemas.

## Bloque B — Necesidades, emociones y salud del día a día (spec 010)
- [x] B1. Columnas de necesidades, emociones, estrés, ánimo, deuda de sueño y enfermedad aguda; valores iniciales al crear el mundo desde la personalidad y la ficha de salud.
- [x] B2. Sistema `needs`: decaimiento por hora (R-001), estrés con neuroticismo y resiliencia (R-002), ánimo con retorno a la línea base (R-003), deuda de sueño (R-004), emociones disparadas por eventos (R-005). `OVERSLEPT` pasa al bloque C (necesita la hora de despertar).
- [x] B3. Efectos de la ficha de salud (031 R-007) y enfermedades agudas del perfil (`health.acute.*`, R-007): `FELL_ILL` y `RECOVERED`.
- [x] B4. Criterios: 010 CA-003, CA-004, CA-005; 031 CA-006; 009 CA-004. (010 CA-001 en el bloque C; CA-002 y CA-006 en el bloque H con un año).

## Bloque C — Rutinas (spec 011)
- [x] C1. Rutinas derivadas por situación (R-001): turno del puesto, colegio en calendario A, informal, desempleado, cuidado, pensionado, niño pequeño.
- [x] C2. Comidas colombianas (R-002), calendario con domingos, festivos y vacaciones escolares (R-003), bloques libres para esparcimiento (R-004).
- [x] C3. Criterios: 011 CA-001 a CA-005; 010 CA-001 (`OVERSLEPT` tras dos noches sin dormir, con la hora de despertar de la rutina).

## Bloque D — Movilidad y uso de los lugares (specs 016, 004)
- [x] D1. Paradero intermunicipal en la plaza (`transporte.paradero` pasa a M1 en el catálogo y a la plantilla `datas-world-v1`).
- [x] D2. Viajes: modos según objetos, dinero y salud; tiempos por calle; bus a La Capital con espera y costo; persona en tránsito (004 R-003).
- [x] D3. Horarios y capacidad de los lugares: entrar a un lugar cerrado o lleno es una acción inválida (004 R-004, R-005).
- [x] D4. Criterios: 016 CA-001 a CA-004; 004 CA-004 y CA-005; 033 CA-006.

## Bloque E — Motor de decisiones y acciones (spec 017)
- [x] E1. Opciones (rutina, necesidades urgentes, eventos recientes, ficha de esparcimiento), utilidad y softmax con temperatura por impulsividad.
- [x] E2. Acciones validadas (`follow_routine`, `eat`, `sleep`, `go_to`, `work`, `study`, `leisure`, `job_search`…) y `explain` como causa (R-005).
- [x] E3. Esparcimiento en la vida diaria (032 R-006): `LEISURE_DONE` satisface `fun`.
- [x] E4. Criterios: 017 CA-001, CA-003, CA-004, CA-005; 032 CA-006.

## Bloque F — Economía (spec 015)
- [x] F1. Cuentas: saldos de personas y hogares, caja de las organizaciones y "resto del país"; conservación exacta (R-006).
- [x] F2. Generación (M1 ampliado): tenencia de la vivienda (ECV 2024) y arriendo por estrato; ahorro del hogar.
- [x] F3. Ingresos: quincena con descuentos de salud y pensión y auxilio de transporte; ingreso informal diario; pensión mensual.
- [x] F4. Gastos: arriendo, servicios públicos con subsidio y contribución por estrato, alimentación, transporte, cuotas moderadoras, medicamentos y esparcimiento.
- [x] F5. Déficit y deudas: ahorro → banco (si hay empleo formal) → gota a gota → impago; estrés por deuda (R-005).
- [x] F6. Criterios: 015 CA-001 a CA-005; 008 CA-004.

## Bloque G — Trabajo y objetos en la vida diaria (specs 006, 005)
- [x] G1. Retrasos, advertencias y despido (006 CA-004); vacantes y contratación (006 CA-005); organizaciones con caja negativa reducen personal (006 CA-006).
- [x] G2. Objetos en la vida diaria: regalos con valor sentimental y objetos que nunca desaparecen de la base (005 CA-004, CA-005).

## Bloque H — Integración, paridad y cierre de M2
- [ ] H1. `pnpm cli validate:parity`: 10 semillas × 365 días del perfil prototipo frente a la línea base; resultado en `docs/validaciones/`.
- [ ] H2. Prueba de 100 personas × 1 año con el perfil colombiano: 010 CA-002 y CA-006, 015 CA-006, sin NaN ni degeneraciones.
- [ ] H3. Niveles y rendimiento: 021 CA-001 (nivel 1 frente a 2) y CA-002 (500 personas, 1 año en < 10 min); `pnpm bench` con la vida diaria; memoria por persona.
- [ ] H4. Determinismo con vida diaria: 023 CA-002 completo (el 50 % de las personas con un evento distinto el día 30).
- [ ] H5. Mundo de ejemplo de M2 en `docs/validaciones/mundos/` (027 R-011) y prueba de que el de M1 se carga y avanza.
- [ ] H6. `/sincronizar-docs all`; proponer las specs que pasan a `implementada`; revisar las specs de M3 (012, 013, 019, 020, 025) antes de redactar `tasks/M3-vida-social.md`.
