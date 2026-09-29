# M3 — Vida social (sobre el motor funcional)

Hito del roadmap: relaciones asimétricas, memoria, causalidad, historia y conocimiento, escritas sobre el motor funcional (035 §8). Prueba del hito: 100 ciudadanos × 1 año; batería 042 en verde; informes de vida con explicación funcional; rumores con verdad ≠ creencia.

Specs: 012 (aprobada, v0.2), 013, 019, 020 y 025 (borradores). Una rama por bloque: `m3/<bloque>`.

## Bloque R — Relaciones (012; rama `m3/relaciones`)
- [x] R1 Módulo `packages/engine/src/relationships/` (MODULE.md, tipos, parámetros). `Citizen.bonds` amplía el `Bond` de la 044 (familiaridad, etiquetas, encuentros). Capacidad `relationships` en los mundos con vida diaria.
- [x] R2 Encuentros en lugares compartidos con las posturas de la charla (043) sin LLM: la persona como estímulo `cit.<CIT>`, aprendizaje de cada lado, acercarse como respuesta aprendida (R-001 a R-003).
- [x] R3 Etiquetas con histéresis, discusiones, parejas y rupturas con sus eventos (R-004 a R-006); olvido y tope (R-008).
- [x] R4 Punto de partida desde el desarrollo (041): la función de cada pariente y la familiaridad por convivencia (R-007).
- [x] R5 Criterios CA-001 a CA-005; métricas frente al prototipo; apego como métrica (P4).
- [x] R6 Visor: los vínculos en la ficha (quién, etiqueta, familiaridad, afecto de cada lado).

## Bloque M — Memoria (013 v0.3, aprobada; rama `m3/memoria`)
- [x] M1 Módulo `packages/engine/src/memory/`: episodios con saliencia desde las funciones de la persona, olvido en ley de potencia, tope (R-001 a R-005).
- [x] M2 Recuperación con sesgo del ánimo, reconstrucción y repaso por la rumiación (039) y los encuentros (012) (R-006 a R-008).
- [x] M3 Memoria de partida desde el desarrollo (041) y la historia (030), con capítulos del pasado (R-002, R-010).
- [x] M4 La charla recibe lo que la persona recuerda y deja recuerdos (P5).
- [x] M5 Consolidación en la red (R-009) y capítulos en la vida diaria; CA-001 a CA-009.
- [x] M6 Visor: capítulos y recuerdos en la pestaña **Vida**.

## Bloques siguientes (specs en borrador: resolver sus preguntas y aprobarlas antes)
- [x] C 019 Causalidad con el vector de aportes y la cadena de origen (rama `m3/causalidad`):
  - [x] C1 R-002 en `makeEvent` y módulo `packages/engine/src/causality/`.
  - [x] C2 Origen de los estados (R-005): sistema `origins` y citas en necesidades, enfermedad, rutina y economía.
  - [x] C3 `why` (R-004, R-006) en la CLI (`event:why`), la API y el visor («¿por qué?» en la Historia).
  - [x] C4 CA-001 a CA-005; medición del registro en 1 año.
- [x] H 020 Historia retrospectiva funcional y la resiliencia como métrica de trayectoria (rama `m3/historia`):
  - [x] H1 Trayectoria diaria con la instantánea (persistencia, migración 003).
  - [x] H2 Capítulos objetivos y divergencias con los recordados (013).
  - [x] H3 Puntos de inflexión con su «¿por qué?», perfil emergente; CLI `citizen:life`, API y sección Informe del visor.
  - [x] H4 CA-001 a CA-006 con 100 personas × 1 año.
- [x] K 025 Conocimiento, creencias y rumores (rama `m3/creencias`):
  - [x] K1 Catálogo `rumor_topics` y módulo `packages/engine/src/knowledge/` (temas, creencias, verdad solo para el análisis).
  - [x] K2 Contar en los encuentros (012): corrección, relato, ocultar lo propio, deformación y aprendizaje de contar.
  - [x] K3 Sistema de conocimiento (presenciar, oír, corregir, consecuencias); lo que cree de otros en la charla, la API y el visor.
  - [x] K4 CA-001 a CA-005.

## Cierre del hito (rama `m3/cierre`)
- [x] 100 ciudadanos × 1 año con los criterios de las cinco specs (una sola prueba).
- [x] Paridad con el prototipo (`M3-paridad-prototipo.md`): sin cambios respecto al motor funcional; la deuda de empleo y enfermedad sigue abierta.
- [x] Batería 042 en verde.
- [x] Revisión de 5 informes de vida al azar y corrección de lo encontrado (`M3-cierre.md`).
- [x] Memoria y velocidad (`M3-bench-vida.md`).
- [x] Specs 012, 013, 019, 020 y 025 → `implementada` (aprobado por el usuario, 2026-09-29).
