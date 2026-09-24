---
id: 007
nombre: population
estado: borrador
hito: M1
depende_de: [001, 008, 009]
version: 0.1
---

# 007 — Población

## 1. Propósito
Generar y mantener ciudadanos: identidad, datos demográficos, educación, salud base, trayectoria previa. Personas, no pacientes.

## 2. Alcance
**Incluye:** atributos del ciudadano, generación coherente, nacimientos/muertes (post-MVP).
**Fuera de alcance:** personalidad (009), necesidades (010), relaciones (012).

## 3. Modelo de datos
```ts
interface Citizen {
  id: EntityId;              // CIT-000123
  name: { given: string; family: string[] };
  birthMinute: WorldMinute;  // puede ser negativo (antes del epoch)
  sex: 'F'|'M'; genderIdentity?: string;
  householdId: EntityId; homeId: EntityId;
  education: 0|1|2|3|4;      // ninguna … posgrado
  occupation?: { orgId: EntityId; positionId: string };
  health: { physical: number; chronic: string[] };   // [0,1]
  personality: Personality;  // 009
  values: Values;            // 009
  state: CitizenState;       // 010
  money: number;             // entero
  simLevel: 0|1|2|3|4;       // 021
  status: 'active'|'deceased'|'moved_out';
  backstory: EntityId[];     // eventos previos al epoch generados (infancia, estudios, trabajos)
}
```

## 4. Reglas
- **R-001** — La población se genera por hogares (008), no persona a persona, para que edades, apellidos y estratos sean coherentes.
- **R-002** — Cada persona recibe una trayectoria previa mínima (eventos anteriores al epoch) que explique su situación inicial.
- **R-003** — Distribuciones de edad, educación y empleo parametrizadas por barrio.
- **R-004** — Nombres generados de listas locales (español colombiano) con el RNG.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `CITIZEN_BORN` | nacimiento (post-MVP) | padres |  |
| `CITIZEN_DIED` | muerte | causa | salud (010) |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* 200 personas generadas, *entonces* la pirámide de edades se ajusta a la distribución configurada (χ² p>0.05).
- **CA-002** — *Dado* un menor de edad, *entonces* vive en un hogar con al menos un adulto.
- **CA-003** — *Dado* cualquier persona, *entonces* su situación laboral inicial está explicada por ≥1 evento de backstory.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| population.target | 200 |
| % empleo adulto | 60–70% |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] ¿Incluir nacimientos y muertes en M3 o posponer?

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
