# Bloque L — Charla con ciudadanos (versión mínima adelantada)

Decisión del usuario (2026-09-27): adelantar una versión mínima de la charla de la spec 043 antes de M6, para probar la coherencia de los ciudadanos con su historia y su reacción a distintos tipos de conversación. La charla `in_world` deja recuerdo y aprendizaje.

Specs: 043 v0.3 (aprobada). Usa las implementadas (014, 030) y las aprobadas (022, 023, 024, 036, 038, 040). Rama `charla/<bloque>`.

**Qué no incluye esta versión mínima:**
- `PersonView` completa de la 025: se usa la mínima de 043 §3;
- recuerdo episódico de la 013: el recuerdo es el evento `CONVERSATION_HELD`, que entra en la vista.

## Bloque L0 — Prerrequisitos
- [x] L0.1 Actualizar la 026 (pasarela LLM) con lo que pide la 043:
  - propósitos `dialogue` y `classify`;
  - modelos y proveedor configurables por propósito;
  - streaming;
  - caché de prompts;
  - registro de respuestas para el replay.

  Pedir su aprobación: el módulo `packages/llm-gateway` no se puede tocar con la 026 en borrador.
- [x] L0.2 Catálogos `chat_tones` (12), `chat_stances` (8) y `chat_scripts` (al menos un guion por tono), con los estímulos verbales nuevos en el catálogo de la 036 (PA-135).

## Bloque L1 — Motor de la conversación (`packages/engine/src/conversation/`)
- [x] L1.1 `MODULE.md` del módulo nuevo.
- [x] L1.2 Tono → estímulo y función aprendida (R-005); valor del visitante (R-006); carga aversiva (R-007).
- [x] L1.3 Selección de postura con las fuentes de la 040, sin leer `tmp.*` ni `pers.*` (R-008); aprendizaje local (R-009).
- [x] L1.4 Charla casual: validar `chat_open` según su situación (R-019.1), con `CONVERSATION_STARTED` y `CONVERSATION_DECLINED`. El cierre por compromiso o inactividad pasa a L3.3.
- [x] L1.5 `consolidateChat`: `CONVERSATION_HELD`, `LEARNED_FROM_CONVERSATION`, topes de aprendizaje y efecto emocional acotado (R-020 a R-022).
- [x] L1.6 Criterios: CA-004, CA-005, CA-006, CA-007, CA-008, CA-013, CA-019 y CA-020.

## Bloque L2 — Pasarela y vista (`packages/llm-gateway/src/chat/`)
- [x] L2.1 `PersonView` mínima y prompt sin verdad del mundo (R-002, R-003).
- [x] L2.2 Clasificador de tono con tiempo máximo y reglas léxicas de respaldo (R-004).
- [x] L2.3 Expresión en streaming; plantillas sin LLM (R-010, R-014); proveedores `mock` y Anthropic.
- [x] L2.4 Verificador asíncrono de afirmaciones y de adherencia (R-012, R-013).
- [x] L2.5 Criterios: CA-002, CA-003, CA-009, CA-010, CA-011, CA-012 y CA-018.

## Bloque L3 — Persistencia, API y worker
- [ ] L3.1 Tablas del chat fuera del hash y entradas externas `chat_open` y `chat_session` (R-001, R-019).
- [ ] L3.2 Endpoints `/api/chat/*` con SSE y basic auth (R-016); tiempo real durante la sesión y velocidad anterior al cerrar.
- [ ] L3.3 El worker aplica las entradas; replay sin red. Actividad `conversation` en `act.kind`, respetada por rutinas y selección mientras dura la charla; cierre por compromiso o inactividad (R-019.5).
- [ ] L3.4 Criterios: CA-001, CA-014, CA-015 y CA-017.

## Bloque L4 — Visor y batería
- [ ] L4.1 Vista de chat del visor (R-017), según el diseño aprobado.
- [ ] L4.2 `pnpm cli chat:battery` con informe (R-015); criterio CA-016.
- [ ] L4.3 Guía de uso para el usuario (`docs/uso-charla.md`) y prueba con un proveedor real: latencia (R-023) y coste por sesión.
