---
modulo: relationships
ruta: packages/engine/src/relationships
estado: estable
specs: [012, 036, 040, 043, 044]
actualizado: 2026-09-28
---

# Módulo: relationships

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Relaciones asimétricas entre ciudadanos (spec 012 v0.2): encuentros en lugares compartidos, el intercambio con las posturas de la charla, y los vínculos que deja en cada lado (familiaridad, tensión, confianza, etiquetas). El afecto es la función de la otra persona (`cit.<CIT>`) en el almacén de cada quien (036). No confundir con `relations/` (la red relacional de estímulos, 037).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 012 | CA-001 (unidad y mundo), CA-002 (mundo, 100 × 1 año), CA-003, CA-004 (unidad), CA-005 (en `apps/cli`) | — |

## 3. API pública
- `relationshipSystems({ cat, onto, chat, claim, p })`: los tres sistemas, para registrarlos con la vida diaria.
- `createSocialEncounterSystem(deps)`: fase `interactions`, orden 50, capacidad `relationships`, cada tick (R-001 a R-005).
- `createBondLedgerSystem()`: fase `memory`, orden 95: anota cada evento del par en los vínculos de ambos (R-009).
- `createBondDailySystem(p, claim)`: fase `end_of_day`: decaimiento, rupturas, olvido y tope (R-003, R-006, R-008).
- `exchange(a, b, cat, chat, p, now, rng)`: el intercambio de un encuentro (R-002). Modifica los almacenes de trabajo de ambos lados.
- Ayudantes de vínculo: `affectionFor`, `bondWith`, `touch`, `relabel`, `forgettable`, `hasPartner`, `sameOrg`.
- `attachmentOf(store, caregivers)`: el apego como métrica (P4); ningún sistema lo lee.
- `RELATIONSHIP_DEFAULTS`, `personStimulus`, `APPROACH`, `TONE_OF_STANCE`, `CLASH`.

## 4. Diseño interno y decisiones
- **Encuentros (R-001).** Por lugar (orden de id) y por persona despierta y libre (no duerme, no está enferma, de camino ni en una charla): inicia con probabilidad `pInitiate × fuerza de social.acercarse`; elige con quién entre los presentes con peso `0,3 + familiaridad`. Es la forma por persona de la regla por par de la spec (evita el coste cuadrático en lugares grandes). Tope de 3 por hora, contados con `lastEncounter`. Azar `relationships/<lugar>`.
- **Intercambio (R-002).** A inicia (sin oír nada de B: no empareja a B con su propio saludo) y elige postura con la selección de la 043; B recibe esa postura como tono (`TONE_OF_STANCE`) y elige; A recibe la de B. Cada lado empareja `cit.<otro>` con lo que recibe y refuerza o castiga su postura (043 R-009); acercarse se refuerza con lo que recibió. **Contraatacar y poner un límite** solo son opciones con un estímulo aversivo: tono recibido aversivo, tensión viva > 0,1 con el otro o función del otro < −0,1 antes del encuentro. Sin esto, un saludo neutro terminaba en choque el 25 % de las veces.
- **Tensión (R-003, R-005).** Se fija la vigente (decaimiento perezoso de la 044) antes de mover `at`. Un choque la sube 0,1 y emite `ENCOUNTER` (un roce); con tensión previa > 0,3 y sin discusión del par en 2 días es `ARGUMENT`. Un encuentro sin choque en que alguno se abre o aplaca repara el 20 % de la tensión viva: sin reparación, las familias entraban en un bucle de choques.
- **Etiquetas (R-004).** `conocido` desde el primer encuentro; `companero` si comparten organización formal; `amigo` con histéresis y nunca para la familia (ya tiene su etiqueta); `pareja` entre adultos sin pareja que no son familia, con afecto mutuo y trato altos; `ex` tras una ruptura.
- **Causas (R-009).** Cada vínculo guarda sus últimos 5 eventos (`events`): los anota el sistema de registro al final del tick, y las discusiones, amistades, parejas y rupturas los citan como causas.
- **Olvido (R-008).** Conocidos con trato < 0,02 (≈ una semana sin contacto tras un encuentro) y sin tensión viva; por encima de 40 vínculos, el más débil que no sea familia.
- **Parámetros medidos (PA-142 a PA-145).** Con la mezcla real de posturas, el afecto de equilibrio por otra persona ronda 0,1–0,2: la amistad entra en 0,15 (sale en 0,08) y la pareja pide 0,2 mutuo. Números de 100 personas × 1 año en `docs/validaciones/M3-relaciones.md`.
- **Parches.** Vínculos y almacenes van como parches de entidad con `owned` (copias propias por JSON), solo de quien tuvo encuentro.

## 5. Invariantes y guardarraíles
- 012 INV-001: familiaridad, tensión y confianza en [0,1]; función de una persona en [−1,1] (lo comprueba la prueba del mundo).
- 012 INV-002: los vínculos solo cambian aquí, en la 044 y en la generación.
- 012 INV-003: el afecto se lee solo del almacén de la persona (`affectionFor`).
- Es un módulo de selección (las posturas): no importa el temperamento.

## 6. Cómo se prueba
- `relationships.test.ts`: familiaridad, histéresis, olvido, asimetría (CA-001), posturas de choque sin estímulo aversivo, abrirse frente a callar (CA-004), acercarse, ruptura con causas (CA-003), registro de causas y apego.
- `packages/generators/src/relationships-world.test.ts`: punto de partida (R-007) y 100 personas × 1 año (CA-001, CA-002, degeneración, INV-001).
- `apps/cli/src/explain.test.ts`: CA-005.

## 7. Paridad con el prototipo
`genRelations`, `rel`, `setRel`, `firstMeet`, `upgrade`, `interact` (docs/prototipo-referencia.md). Se porta el comportamiento (vínculos asimétricos, amistades, discusiones, parejas), no el código. Desde ADR-007 el prototipo no es la referencia de conducta; sus tasas sirven de orden de magnitud: 100 personas × 1 año dan 79 discusiones (prototipo: 50 con 60 personas), 268 amistades formadas (334) y 2 parejas nuevas (2).

## 8. Pendientes y deuda
- [ ] Encuentros entre vecinos sin coincidir en un lugar (P5, con la 025).
- [ ] Orientación sexual con fuente para la atracción (P3, opción b).
- [ ] Coste: el año de 100 personas pasa de 109 s a 144 s (+32 %). Medir con `pnpm bench` y optimizar si hace falta.
- [ ] `BOND_FORGOTTEN` y `MET` repetidos con desconocidos de paso (≈ 35 olvidos por persona y año): valorar no registrar el primer encuentro fugaz.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-28 | m3/relaciones (R1) | 012 | Documento creado desde la plantilla (sin código) |
| 2026-09-28 | m3/relaciones (R1–R5) | 012 | Módulo implementado: encuentros con las posturas de la charla, vínculos, etiquetas, discusiones, parejas, rupturas, olvido, registro de causas y apego como métrica; parámetros calibrados con 100 personas × 1 año |
| 2026-09-29 | m3/memoria (M5) | 012, 013 | R-001 con la 013 CA-005: con quién se encuentra se pondera también por el valor que tiene la otra persona para quien inicia (directo o derivado de la red, 037), `× max(0,1; 1 + valor)`. Lo que la experiencia generalizó sigue apartando aunque los episodios se olviden. En 100 personas × 1 año las discusiones bajan de 79 a 44 (la gente evita a quien le desagrada) y las amistades quedan igual (286) |
| 2026-09-29 | m3/creencias (K2) | 012, 025 | Con `EncounterDeps.knowledge` y la capacidad `beliefs`, tras el intercambio cada lado que se abrió puede corregir o contarle algo de un tercero al otro (`tellInEncounter`, 025 R-003 a R-006); el encuentro emite el evento y parchea las creencias y la fuerza de contar de quien cuenta. `relationshipSystems` recibe `knowledge` |
