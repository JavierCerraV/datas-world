---
id: 028
nombre: experiments
estado: borrador
hito: M5
depende_de: [023, 027, 022]
version: 0.2
---

# 028 — Experimentos y ramas

## 1. Propósito
Comparar mundos alternativos: misma población con y sin una intervención (p. ej. JOB_LOST forzado, apoyo social extra), o varias semillas, para estudiar trayectorias.

## 2. Alcance
**Incluye:** ramas desde instantáneas, intervenciones, lotes de semillas, comparación de métricas.
**Fuera de alcance:** estadística avanzada (se exporta).

## 3. Modelo de datos
```ts
interface Experiment { id: string; baseWorld: WorldId; branchAt: WorldMinute; arms: Arm[]; durationDays: number; seeds: number[]; metrics: string[]; }
interface Arm {
  name: string;
  interventions: ExternalInput[];
  capabilities?: { enable?: Capability[]; disable?: Capability[] }; // solo en ramas (spec 001 R-007)
}
```

## 4. Reglas
- **R-001** — Una rama parte de una instantánea y aplica intervenciones como entradas externas.
- **R-002** — Los experimentos corren en la CLI (en local o en el servidor con prioridad baja), nunca en el worker del mundo vivo.
- **R-003** — Resultados exportados a CSV/JSON con metadatos (versión del motor, semillas, capacidades de cada brazo).
- **R-004** — **Brazos por capacidad.** Un brazo puede activar o desactivar capacidades en el punto de rama. Desactivar deja de ejecutar sus sistemas, pero conserva sus datos (no se borra nada). Sirve para medir qué aporta cada capacidad al mismo mundo (p. ej. con y sin `consolidation`).
- **R-005** — **Puertas de peldaño.** Cada peldaño de la escalera (ADR-005, `docs/roadmap.md`) se cierra con un experimento guardado en `docs/validaciones/` cuyos brazos comparan el mundo con y sin las capacidades nuevas.

## 5. Eventos
No define tipos propios (usa los de otras specs).

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* dos brazos idénticos sin intervención, *entonces* resultados idénticos.
- **CA-002** — *Dado* un JOB_LOST forzado en un brazo, *entonces* el informe compara ánimo, dinero y relaciones de la persona entre brazos.
- **CA-003** — *Dado* un brazo con `consolidation` desactivada y otro con ella activa, *entonces* ambos arrancan con el mismo hash y el informe compara memoria en RAM por persona y decisiones sociales.

## 8. Parámetros y calibración
Por definir durante la revisión.

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] Revisar parámetros con los resultados de la primera validación.
- [ ] Enganche de la capa clínica (034 R-007): brazos por intervención (un plan de tratamiento por brazo, incluido "sin intervención") sobre la misma persona y la misma instantánea.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-23 | 0.2 | Brazos que activan o desactivan capacidades y experimentos como puerta de cada peldaño (R-004, R-005, CA-003). ADR-005 |
| 2026-09-24 | 0.2 | Pregunta abierta: brazos por intervención para la capa clínica (spec 034) |
