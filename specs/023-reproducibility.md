---
id: 023
nombre: reproducibility
estado: aprobada
hito: M0 (base) · M5 (rewind/replay y ramas)
depende_de: [001, 002]
version: 0.2
---

# 023 — Reproducibilidad y azar

## 1. Propósito
Garantizar que misma semilla + mismas entradas + misma versión del motor = mismo mundo, y que semillas distintas producen historias distintas. Base del rewind, replay y experimentos.

## 2. Alcance
**Incluye:** generador aleatorio, flujos con nombre, reglas de determinismo, hash de estado, pruebas de reproducibilidad y divergencia, registro de entradas externas.
**Fuera de alcance:** formato de instantáneas (027), diseño de experimentos (028).

## 3. Modelo de datos
```ts
interface Rng {
  next(): number;                    // [0,1)
  int(minIncl: number, maxIncl: number): number;
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  weighted<T>(items: readonly [T, number][]): T;
  normal(mean: number, sd: number): number;  // Box–Muller determinista
  fork(name: string): Rng;           // flujo derivado estable
  state(): RngState;                 // serializable
}
// Implementación: PCG32 o splitmix64/xoshiro128** (el prototipo usa splitmix32).
// fork(name) = new Rng(hash32(parentSeed, name)) — no consume del padre.

interface ExternalInput {
  at: WorldMinute; seq: number;
  kind: string; payload: unknown;    // acciones del observador, respuestas LLM, intervenciones
}
```

## 4. Reglas
- **R-001** — Prohibido en `packages/engine`: `Math.random`, `Date`, `performance.now`, `crypto.randomUUID`, E/S. Se impone con una regla de ESLint (`no-restricted-globals` / `no-restricted-syntax`) y una prueba que busca esos tokens.
- **R-002** — Cada sistema usa su flujo: `rng.fork('needs')`, `rng.fork('social')`… Las decisiones de una persona usan `rng.fork('CIT-000042').fork(dayIndex)` para que añadir o quitar personas no cambie el azar de las demás más de lo necesario.
- **R-003** — Nada de coma flotante dependiente de plataforma en decisiones críticas: evitar `Math.pow` con exponentes no enteros en comparaciones umbral; preferir operaciones básicas. `Math.exp/log/sin` se consideran estables en V8 pero se documenta el riesgo.
- **R-004** — Toda entrada externa se registra como `ExternalInput` antes de aplicarse; el replay las re-inyecta en el mismo `(at, seq)`.
- **R-005** — La versión del motor forma parte de la identidad del mundo; un replay con otra versión se marca como "no garantizado".
- **R-006** — **Capacidades.** Activar una capacidad es una entrada externa (`kind: 'enable_capability'`, spec 001 R-007). El replay la re-inyecta en el mismo `(at, seq)`, de modo que un mundo que empezó en el peldaño 1 y se amplió después se reproduce exactamente.
- **R-007** — **Flujos por sistema.** Cada sistema recibe `rng.fork('sys:' + id)` (spec 021 R-008) y la inicialización de una capacidad usa `rng.fork('cap:' + nombre)`. Añadir un sistema o una capacidad no altera los números que reciben los demás.

## 5. Eventos
| `EXTERNAL_INPUT_APPLIED` | entrada externa | kind, payload |

## 6. Invariantes
- **INV-001** — Ningún test del motor depende del reloj real.

## 7. Criterios de aceptación
- **CA-001** — *Dado* semilla S, *cuando* se genera un mundo de 100 personas y se avanza 30 días dos veces en procesos distintos, *entonces* los hashes coinciden.
- **CA-002** — *Dado* semillas S y S+1, *cuando* se avanza 30 días, *entonces* los hashes difieren y al menos el 50 % de las personas tienen un evento del día 30 distinto.
- **CA-003** — *Dado* `rng.fork('a')`, *cuando* se consumen valores del padre, *entonces* la secuencia de `fork('a')` no cambia.
- **CA-004** — *Dado* un mundo con entradas externas registradas, *cuando* se hace replay desde la instantánea del día 0, *entonces* el hash final coincide con el original.
- **CA-005** — El linter falla si aparece `Math.random` en `packages/engine`.
- **CA-006** — *Dado* un mundo que activó `relationships` el día 10 por entrada externa, *cuando* se hace replay desde el día 0, *entonces* el hash del día 30 coincide con el original.

## 10. Preguntas abiertas
- [ ] ¿PCG32 o xoshiro128**? Ambos válidos; elegir el más simple de auditar.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial |
| 2026-09-23 | 0.2 | Replay de activaciones de capacidades y flujos RNG por sistema y por capacidad (R-006, R-007, CA-006). ADR-005 |
| 2026-09-24 | 0.2 | Estado → aprobada |
