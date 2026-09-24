---
id: 014
nombre: events
estado: borrador
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

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
