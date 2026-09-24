---
id: 010
nombre: needs
estado: borrador
hito: M2
depende_de: [007, 009]
version: 0.1
---

# 010 — Necesidades, emociones y salud

## 1. Propósito
Estado interno dinámico: necesidades físicas y psicológicas, estrés, ánimo, energía y salud, con retroalimentaciones realistas (dormir mal → cansancio → errores → conflicto → estrés).

## 2. Alcance
**Incluye:** necesidades, emociones básicas, estrés, ánimo, salud física y enfermedades simples.
**Fuera de alcance:** trastornos clínicos.

## 3. Modelo de datos
```ts
interface CitizenState {
  needs: { hunger: number; energy: number; hygiene: number; social: number; fun: number;
           safety: number; autonomy: number; purpose: number };      // [0,1], 1 = satisfecha
  stress: number; mood: number;                                    // [0,1]
  emotions: { joy: number; sadness: number; anger: number; fear: number; shame: number }; // intensidad actual
  sleepDebt: number;                                               // minutos
  illness?: { kind: string; severity: number; until: WorldMinute };
}
```

## 4. Reglas
- **R-001** — Las necesidades decaen por tick con tasas parametrizadas y se satisfacen con acciones (comer, dormir, socializar).
- **R-002** — El estrés sube con necesidades insatisfechas, conflictos, deudas e incertidumbre, modulado por neuroticismo y resiliencia; baja con descanso, apoyo social y ocio.
- **R-003** — El ánimo es una media móvil de emociones y satisfacción con retorno lento a una línea base personal.
- **R-004** — Deuda de sueño alta aumenta probabilidad de quedarse dormido, errores y enfermedad (prototipo: umbral 0.72 energía).
- **R-005** — Emociones intensas se convierten en memorias (013) si superan umbral.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `OVERSLEPT` | se queda dormido | retraso en minutos | sleepDebt, energía |
| `FELL_ILL` | enfermedad | tipo, severidad | estrés, sleepDebt, azar |
| `EMOTIONAL_OUTBURST` | estallido | emoción | estrés alto + provocación |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* una persona sin dormir 2 noches, *entonces* la probabilidad de OVERSLEPT al día siguiente es > 50 %.
- **CA-002** — *Dado* 100 personas × 1 año, *entonces* media de ánimo entre 0.4 y 0.7 y ninguna distribución colapsada (sd > 0.05).
- **CA-003** — *Dado* cualquier tick, *entonces* todos los valores están en [0,1] y sin NaN.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| drenaje energía/h | 0.045 despierto (prototipo) |
| umbral overslept | 0.72 |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] ¿Modelo de emociones discreto o dimensional (valencia/activación)?

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
