# M5 — Experimentos

Spec 028 (aprobada 2026-10-07). Hito M5 de `docs/roadmap.md`: mismo mundo con y sin un evento → trayectorias comparables.

- [x] E1 Spec 028 redactada, revisada y aprobada.
- [x] E2 Módulo `experiment` del motor: definición, intervenciones (`force_job_loss`, `grant_money`), métricas, colector, contraste pareado; `disable_capability`; `feedKinds` (028 R-003, R-004, R-006 a R-008).
- [x] E3 `runArm` en generators y comando `experiment:run` con JSON, CSV y Excel (CA-001 a CA-006, CA-008, INV-004).
- [x] E4a Primer experimento real (`docs/validaciones/M5-experimentos.md`): despido forzado y sin `consolidation`, 3 brazos × 3 semillas × 60 días.
- [ ] E4b Experimento de cierre del peldaño 3 con más semillas y la métrica de memoria por persona (CA-003 completo, R-010).
- [ ] E5 Memoria de un brazo de 200 personas × 90 días dentro del presupuesto (CA-007, `pnpm bench`); el primer experimento dio 563–574 MB de proceso.
- [ ] E6 Métrica `psychometrics` por brazo y `--keep-events`.
- [ ] E7 Intervención que sostenga un desempleo (congelar la contratación de una persona N días) y revisar por qué un despido sube los vínculos y el dinero a 7 días.

## Estudio de intervención (spec 047, aprobada 2026-10-08)

Piloto con las 12 personas con episodios de PNR, protocolo ACT de 3 sesiones, `claude-haiku-5-5` en esfuerzo bajo.

- [x] P1 Pasarela lista para `claude-haiku-5-5`: temperatura opcional, `effort`, `thinking`, propósito `therapist` (026 R-014).
- [x] P2 Guía del protocolo (`engine/protocol`) y terapeuta como agente con sesión dialogada y fidelidad (047 R-005 a R-005c; CA-008 a CA-010).
- [x] P3 La persona en la sesión con la charla de la 043 en escenario de consulta (R-005d, R-005e); memoria del terapeuta entre sesiones y terapeuta que no sabe que es una simulación (CA-013); comando `study:session` con la transcripción guardada (CA-005).
- [x] P3b Sesión real de prueba con una persona (Natalia, OpenRouter, 12 turnos) y revisión con el usuario: terapeuta por función (R-005f) y nivel de confianza en consulta.
- [x] P4 Efecto en el motor: compromiso por sesión, dosis por mecanismo, `PROTOCOL_SESSION`, `PRACTICE_DONE`, `PROTOCOL_ENDED`, adherencia a la práctica y asistencia (R-004, R-006, R-013; CA-002 a CA-004). Falta crear las reglas de seguimiento hacia acciones valiosas.
- [ ] P5 Pruebas en el mundo y regreso a sesión con lo que le pasó, o abandono (R-012, R-013; CA-011, CA-012).
- [x] P6 Medidas en cada toma (dicho, decidido por el motor y verdadero), brecha de informe, mecanismos, episodios de rumia, brazo de espera e informe con tokens y coste por sesión (R-007 a R-009, R-001c; CA-006, CA-007, CA-014). Falta la complacencia en la transcripción y la sensibilidad a la dosis.
- [ ] P7 Corrida del piloto en `claude-haiku-5-5` (3 personas, 7 tomas, 3 sesiones) y revisión de resultados con el usuario.
