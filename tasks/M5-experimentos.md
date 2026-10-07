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
