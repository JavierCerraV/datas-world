---
id: 022
nombre: observability
estado: borrador
hito: M4
depende_de: [027, 019, 020]
version: 0.1
---

# 022 — Observación, API y métricas

## 1. Propósito
Ver el mundo sin alterarlo: API de consulta, flujo en vivo, controles de tiempo, métricas de salud y exportación para investigación.

## 2. Alcance
**Incluye:** endpoints, SSE, controles, métricas, exportación.
**Fuera de alcance:** visor (024).

## 3. Modelo de datos
```ts
// GET  /api/health                         → { now, speed, effectiveSpeed, tps, rssMb, dbMb }
// GET  /api/world                          → config + calendario + estadísticas
// GET  /api/citizens?district=&q=          → lista resumida
// GET  /api/citizens/:id                   → estado, relaciones, memoria, creencias
// GET  /api/citizens/:id/report            → informe de vida (020)
// GET  /api/events?since=&type=&entity=    → paginado
// GET  /api/events/:id/why?depth=4         → árbol causal (019)
// GET  /api/stream                          → SSE: eventos + tick
// POST /api/control { cmd: pause|resume|speed|step|advance, arg } (autenticado)
// GET  /api/export/:table.csv               → para análisis externo
```

## 4. Reglas
- **R-001** — La API nunca muta el estado del mundo; los controles solo escriben en `control_commands`.
- **R-002** — Validación de entrada y salida con Zod.
- **R-003** — SSE con reconexión y `Last-Event-ID`.
- **R-004** — Controles protegidos por autenticación (basic auth en MVP).

## 5. Eventos
No define tipos propios (usa los de otras specs).

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* el worker corriendo, *entonces* `/api/health` responde en < 50 ms.
- **CA-002** — *Dado* un cliente SSE desconectado 1 min, *cuando* reconecta, *entonces* recibe los eventos perdidos.
- **CA-003** — *Dado* una petición a /api/control sin credenciales, *entonces* 401.

## 8. Parámetros y calibración
Por definir durante la revisión.

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] Revisar parámetros con los resultados de la primera validación.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
