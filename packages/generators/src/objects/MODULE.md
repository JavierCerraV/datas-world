---
modulo: objects
ruta: packages/generators/src/objects
estado: en-desarrollo
specs: [005, 029]
actualizado: 2026-09-24
---

# Módulo: objects

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Crea los objetos iniciales de las personas (teléfono, bicicleta, herencia) y de los hogares (carro), con su evento de origen anterior al presente.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 005 | CA-001 (agregado de 20 mundos), CA-002, CA-003; R-001 a R-004, R-008 | CA-004 y CA-005 (M2), CA-006 (M3) |

## 3. API pública
Desde `@datas-world/generators`:

| Símbolo | Descripción |
|---|---|
| `generateObjects(world, citizenIds, householdIds, objectKinds, rng)` → `{ objectIds, events }` | Objetos por persona según las reglas `gen` del catálogo y carro por hogar según `gen.objects.carP[estrato]`, cada uno con su evento de origen (`OBJECT_ACQUIRED` u `OBJECT_INHERITED`). Hay que reordenar las trayectorias después (`sortBackstories`) |

## 4. Diseño interno y decisiones
- **Reglas en el catálogo** `object_kinds` (2026.09.2). `gen` es una lista de `{ minAge?, maxAge?, p }` y se aplica la primera que encaje con la edad. `condition` es el rango del estado inicial. En M1:
  - teléfono: adultos 0,9 y de 12 a 17 años 0,6;
  - bicicleta: de 10 a 59 años, 0,3;
  - herencia: 25 años o más, 0,08, con valor emocional 0,95.

  Son los valores de `genObjects`.
- **Carro del hogar:** con `gen.objects.carP` del perfil (estrato 2 → 0,05; 3 → 0,2; 4 → 0,45, estimado; 0 en el perfil prototipo). Lo registra la cabeza del hogar.
- **Fechas:**
  - una compra ocurre en los últimos 5 años y nunca antes de los 10 años de edad;
  - una herencia, en algún momento de la vida adulta.

  El evento queda en la historia del objeto y en la trayectoria de quien lo compra o lo hereda.
- **Azar:** `gen:objects/<dueño>/<tipo>`, así que un objeto no depende de los demás.
- **Coste:** con el perfil colombiano, unos 1,5 objetos por persona de ≈ 250 B cada uno.

## 5. Invariantes y guardarraíles
005 INV-002: dueño CIT o HOU existente, comprobado por `addObject` del motor. Todo objeto inicial tiene evento de origen.

## 6. Cómo se prueba
`src/objects/objects.test.ts` (5 pruebas):
- **CA-002:** evento de origen;
- **CA-003:** carro del hogar visible para todos sus miembros;
- **R-004:** valor emocional y valor mínimo;
- **CA-001:** proporciones agregadas de 20 mundos por edad y carro por estrato.

## 7. Paridad con el prototipo
Porta `genObjects` (probabilidades, precios, "el anillo de su abuela"). El carro no existe en el prototipo (en el perfil prototipo, probabilidad 0).

## 8. Pendientes y deuda
- [ ] Precios con fuente (hoy estimados, en pesos).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-24 | m1/g-empleo-objetos | — | Documento creado desde la plantilla (sin código) |
| 2026-09-24 | m1/g-empleo-objetos (G2) | 005 | `generateObjects` con reglas del catálogo, carro por estrato y eventos de origen. 5 pruebas: 005 CA-001, CA-002, CA-003 |
