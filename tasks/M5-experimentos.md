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
- [ ] P3b Sesión real de prueba con una persona (OpenRouter) y revisión del diálogo con el usuario.
- [ ] P4 Efecto en el motor: compromiso por sesión, dosis por mecanismo, `PROTOCOL_SESSION`, `PRACTICE_DONE`, `PROTOCOL_ENDED`, adherencia a la práctica (R-004, R-006; CA-002 a CA-004).
- [ ] P5 Pruebas en el mundo y regreso a sesión con lo que le pasó, o abandono (R-012, R-013; CA-011, CA-012).
- [ ] P6 Medidas con los cuatro instrumentos, complacencia e informe (R-007 a R-009; CA-006, CA-007).
- [ ] P7 Comando de la CLI y corrida del piloto, con tope de gasto de 5 USD.
