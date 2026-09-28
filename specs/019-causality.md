---
id: 019
nombre: causality
estado: borrador
hito: M3
depende_de: [014]
version: 0.1
---

# 019 — Causalidad

## 1. Propósito
Poder explicar por qué pasó cualquier cosa: grafo causal entre eventos y estados, consultas "¿por qué?" y cadenas explicativas.

## 2. Alcance
**Incluye:** grafo causal, pesos, consultas, validación.
**Fuera de alcance:** inferencia causal estadística (fuera, con datos exportados).

## 3. Modelo de datos
```ts
interface CausalQuery { eventId: EntityId; depth: number; minWeight: number; }
interface CausalNode { ref: CauseRef; children: CausalNode[]; text: string; }
```

## 4. Reglas
- **R-001** — Las causas se asignan en el momento de crear el evento, nunca a posteriori.
- **R-002** — Una causa siempre es anterior o simultánea al efecto.
- **R-003** — Los pesos de causas de un evento suman 1 (normalizados).
- **R-004** — `why(eventId, depth)` devuelve un árbol legible en español.

## 5. Eventos
No define tipos propios (usa los de otras specs).

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* un JOB_LOST, *entonces* `why` con profundidad 4 llega hasta causas como falta de sueño o conflicto en el hogar cuando existan.
- **CA-002** — *Dado* todo el log, *entonces* no hay ciclos ni causas del futuro.
- **CA-003** — *Dado* 1 año, *entonces* ≥ 95 % de eventos no espontáneos tienen causas válidas.

## 8. Parámetros y calibración
Por definir durante la revisión.

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] Revisar parámetros con los resultados de la primera validación.


## Adaptación al motor funcional (MF8.1, 2026-09-28)
Según la 035 §8:
- Las causas de una conducta incluyen el vector de aportes por fuente (040 R-006) y la cadena de origen de cada función hasta hechos del registro o del desarrollo (035 CA-001: `citizen:explain`).
- Una función, una relación o una regla sin evento de origen es un error (041 INV-001).

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-28 | — | MF8.1: sección «Adaptación al motor funcional» con lo que cambió en los bloques MF1 a MF7 (o debe cambiar, si la spec sigue en borrador), según la 035 §8. Sin cambios en CA |
