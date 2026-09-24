---
id: 006
nombre: organizations
estado: borrador
hito: M1
depende_de: [004]
version: 0.1
---

# 006 — Organizaciones

## 1. Propósito
Empresas, colegio, hospital, comercios: empleadores con puestos, salarios, jerarquías, cultura y salud financiera. Fuente de empleo, estatus, conflicto y eventos como JOB_LOST.

## 2. Alcance
**Incluye:** puestos, contratación, despidos, turnos, jefes, cultura, finanzas simples.
**Fuera de alcance:** mercado macroeconómico complejo.

## 3. Modelo de datos
```ts
interface Organization {
  id: EntityId;             // ORG-0012
  name: string; sector: 'industry'|'services'|'education'|'health'|'retail'|'hospitality';
  placeIds: EntityId[];
  positions: Position[];
  culture: { strictness: number; warmth: number; stability: number }; // [0,1]
  cash: number; monthlyRevenue: number; // enteros
}
interface Position {
  id: string; title: string; level: number;   // 0 = base
  salary: number; shift: { days: number[]; start: number; end: number };
  holderId?: EntityId; supervisorPositionId?: string;
  requirements: { education: number; skills: Record<string, number> };
}
```

## 4. Reglas
- **R-001** — Cada persona en edad laboral con empleo ocupa exactamente una posición.
- **R-002** — La evaluación del desempeño combina puntualidad, energía y habilidades; faltas y retrasos repetidos acumulan `warnings` del supervisor.
- **R-003** — El despido ocurre con `warnings ≥ WARN_LIMIT` o por crisis financiera de la organización; siempre con causas.
- **R-004** — Las vacantes se cubren eligiendo candidatos por requisitos, red de contactos (012) y azar.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `JOB_HIRED` | contratación | citizenId, positionId | búsqueda, contacto |
| `JOB_WARNING` | llamada de atención | motivo | retraso, falta |
| `JOB_LOST` | despido | motivo | warnings o crisis |
| `PROMOTION` | ascenso | de, a | desempeño |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* una persona con 3 retrasos en un mes y `WARN_LIMIT=3`, *entonces* recibe JOB_LOST con causas que incluyen los 3 retrasos.
- **CA-002** — *Dado* una vacante, *cuando* hay candidatos, *entonces* se cubre en ≤ 30 días con probabilidad alta.
- **CA-003** — *Dado* una organización con caja negativa 2 meses, *entonces* reduce plantilla.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| WARN_LIMIT | 3 |
| salarios | según estrato y sector |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] ¿Trabajo informal (muy relevante en Colombia) desde el MVP?

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
