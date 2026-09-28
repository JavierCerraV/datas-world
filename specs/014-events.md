---
id: 014
nombre: events
estado: implementada
hito: M2
depende_de: [001, 002]
version: 0.1
---

# 014 — Eventos

## 1. Propósito
Modelo común para todo lo que ocurre: tipado, inmutable, con participantes, importancia y causas. Es la columna vertebral de la historia y la explicabilidad.

## 2. Alcance
**Incluye:** estructura del evento, catálogo de tipos, importancia, eventos espontáneos, eventos externos.
**Fuera de alcance:** almacenamiento (027), análisis causal (019).

## 3. Modelo de datos
```ts
interface WorldEvent<T = unknown> {
  id: EntityId;              // EVT-00000000042
  type: EventType;           // 'JOB_LOST'
  at: WorldMinute;
  participants: { id: EntityId; role: string }[];
  placeId?: EntityId;
  importance: number;        // [0,1] objetiva
  payload: T;                // validado por tipo
  causes: CauseRef[];
  origin: 'engine'|'external'|'llm';
}
type CauseRef = { event: EntityId; weight: number } | { state: string; entity: EntityId; value: number; weight: number };
```

## 4. Reglas
- **R-001** — Catálogo central `eventTypes.ts` con: nombre, esquema de payload, importancia base, si puede ser espontáneo, plantilla de texto en español.
- **R-002** — Todo evento no espontáneo tiene ≥1 causa. Espontáneos (azar puro, p. ej. lluvia) llevan `{ state: "rng" }`.
- **R-003** — Los eventos son inmutables; correcciones se hacen con eventos nuevos.
- **R-004** — Nivel de registro: eventos rutinarios de personas en nivel < 2 se agregan (027) en vez de registrarse uno a uno.

## 5. Eventos
No define tipos propios (usa los de otras specs).

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* cualquier evento de tipo no espontáneo, *entonces* `causes.length ≥ 1`.
- **CA-002** — *Dado* un payload inválido, *entonces* la creación del evento falla en desarrollo.
- **CA-003** — *Dado* un evento, *entonces* su texto en español se genera desde plantilla sin LLM.

## 8. Parámetros y calibración
Por definir durante la revisión.

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] Lista inicial del catálogo: tomar los eventos citados en la visión + los del prototipo.


## Adaptación al motor funcional (MF8.1, 2026-09-28)
Según la 035 §8:
- Eventos del motor funcional ya en el catálogo: `PNR_EPISODE` y `THOUGHT_DERIVED` (039, este en nivel ≥ 4), `DEVELOPMENT_YEAR` (041), `LEARNED_FROM_CONVERSATION` (043) y los de las consecuencias de la charla (044).
- Las causas funcionales van como estados `fuente.<fuente>:<ref>` (040 R-006) y como eventos de origen (`src` de funciones y respuestas).
- Pendientes para cuando existan los niveles 3 y 4 (021): `RULE_DERIVED`, `FUNCTION_ACQUIRED` y `BEHAVIOR_EMITTED`.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-24 | 0.1 | Estado → aprobada |
| 2026-09-23 | 0.1 | Precisiones de la implementación (bloque C de M0): en `CauseRef` de estado, `entity` y `value` son opcionales, para admitir `{ state: "rng" }` (R-002) y causas globales (`clock`, `world_config`, `external_input`). El catálogo vive en `packages/engine/src/events.ts` (no en `eventTypes.ts`); la validación del payload es una función `check` por tipo, siempre activa. Catálogo inicial de M0: `WORLD_CREATED`, `DAY_STARTED`, `EXTERNAL_INPUT_APPLIED`, `SPEED_CHANGED`, `WORLD_PAUSED`, `WORLD_RESUMED`, `CAPABILITY_ENABLED`. Sin cambios en reglas ni CA |
| 2026-09-24 | 0.1 | Catálogo: se añade `WORLD_CLOSED` (spec 001 §5), aprobado por el usuario en el bloque E. Sin cambios en reglas ni CA |
| 2026-09-24 | 0.1 | Estado → implementada |
| 2026-09-24 | 0.1 | Catálogo: `HOUSEHOLD_FORMED` (008), `STUDIES_COMPLETED` y `CHILDHOOD_EVENT` (007), para la trayectoria previa de M1. Sin cambios en reglas ni CA |
| 2026-09-24 | 0.1 | Catálogo: `JOB_HIRED`, `INFORMAL_WORK_STARTED`, `JOB_LOST`, `RETIRED` (006, 007), `OBJECT_ACQUIRED` y `OBJECT_INHERITED` (005). Sin cambios en reglas ni CA |
| 2026-09-24 | 0.1 | Catálogo de la historia generada (030 §5): `TOWN_FOUNDED`, `DISTRICT_FOUNDED`, `PLACE_BUILT`, `ORG_FOUNDED`, `CITIZEN_BORN`, `UNION_FORMED`, `MIGRATED`, `CITIZEN_DIED` y `HISTORICAL_CONTEXT`, que es espontáneo porque su causa es externa. Sin cambios en reglas ni CA |
| 2026-09-25 | 0.1 | Catálogo: `HEALTH_INSURANCE_SET` y `CONDITION_DIAGNOSED` (031), `LEISURE_TAKEN_UP` (032), `FELL_ILL`, `RECOVERED` y `STRESS_PEAK` (010). Sin cambios en reglas ni CA |
| 2026-09-25 | 0.1 | Catálogo: `OVERSLEPT` (010 R-004, 011), con causas deuda de sueño, energía y responsabilidad. Sin cambios en reglas ni CA |
| 2026-09-25 | 0.1 | Catálogo: `ARRIVED_LATE` y `TRIP_TAKEN` (016). Sin cambios en reglas ni CA |
| 2026-09-25 | 0.1 | Catálogo: `LEISURE_DONE` (032). Sin cambios en reglas ni CA |
| 2026-09-25 | 0.1 | Catálogo: `SALARY_PAID`, `RENT_PAID`, `RENT_LATE`, `DEBT_TAKEN`, `DEBT_REPAID` y `PAYMENT_MISSED` (015, 008). Sin cambios en reglas ni CA |
| 2026-09-25 | 0.1 | Catálogo: `JOB_WARNING` (006), `OBJECT_GIFTED`, `OBJECT_SOLD` y `OBJECT_LOST` (005). Sin cambios en reglas ni CA |
| 2026-09-28 | — | MF8.1: sección «Adaptación al motor funcional» con lo que cambió en los bloques MF1 a MF7 (o debe cambiar, si la spec sigue en borrador), según la 035 §8. Sin cambios en CA |
