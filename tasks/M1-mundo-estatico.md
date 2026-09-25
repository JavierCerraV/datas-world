# M1 — Mundo estático

Specs: 003, 004, 005, 006, 007, 008, 009, 029 y 030 (aprobadas). ADR-006 aceptado.

Resultado esperado: `pnpm cli world:new --seed N` crea Data's World con unas 200 personas coherentes con el perfil colombiano y una historia consultable desde 1900. El presente del mundo es el 2026-01-01.
- El mundo se guarda en SQLite y da el mismo hash con la misma semilla.
- `world:report` compara la población generada con el DANE, `world:map` dibuja el mapa en la terminal y `world:history` y `citizen:report` consultan la historia.
- Con el perfil "prototipo" se mantiene la paridad estadística.

Cada bloque se hace en su rama (`m1/a-catalogos`, `m1/b-geografia`…) y termina con un PR que el usuario aprueba. Solo se prueban los criterios marcados **(M1)**.

## Bloque A — Catálogos y perfil de país (ADR-006, spec 029)
- [x] A1. Formato de los catálogos (`packages/generators/catalogs/*.json`) y cargador con validación Zod en el borde. Versión y hash de cada catálogo en `WorldConfig`.
- [x] A2. Catálogos iniciales:
  - `place_kinds`: con las entradas de M1 y las previstas, cada una con su `desde`;
  - `object_kinds`, `org_sectors` (CIIU), `occupations` (CIUO), `education_levels` (CINE), `territory_levels`, `trades_informal`, `historical_events`.
- [x] A3. Perfil `CO-2026.09` y perfil `prototipo`; `profileValue(key, date, scope)` pura, con sus pruebas (029 CA-002, CA-003, CA-004).
- [x] A4. Festivos de Colombia (Ley Emiliani, Pascua con aritmética entera) para los años del mundo (029 CA-001).
- [x] A5. `WorldConfig` con `profile` y `catalogs` (validados y dentro del hash) y `ENGINE_VERSION` 0.2.0. → Los tipos de cada entidad (`Citizen`, `Place`, `Organization`, `Household`, `WorldObject`) y sus columnas se amplían en el bloque que los genera (B a H), para no declarar campos sin usar.

## Bloque B — Geografía y territorio (spec 003)
- [x] B1. Plantilla `prototipo-64x40`: tiles, calles y manzanas (003 CA-004).
- [x] B2. Jerarquía departamento → municipio → comuna → barrio, con códigos DIVIPOLA ficticios y estratos (003 CA-005).
- [x] B3. Puertas y distancias por BFS, derivadas al cargar (003 CA-002, CA-003); mismo mapa con la misma semilla (003 CA-001).

## Bloque C — Lugares (spec 004)
- [x] C1. Lugares desde `PLACE_LAYOUT` + catálogo; edificios con viviendas; iglesia (004 CA-001, CA-002, CA-003, CA-006).
- [x] C2. Horarios y turnos conformes a la jornada vigente (004 R-007).

## Bloque D — Organizaciones (spec 006, sin empleo)
- [x] D1. Una organización por lugar de trabajo, con sector CIIU, puestos con ocupación CIUO y sueldo mensual en múltiplos del salario mínimo (006 CA-007 en su parte de sueldos y turnos).

## Bloque E — Personalidad (spec 009)
- [x] E1. Rasgos Big Five + extras y valores como columnas, con flujo por persona, correlaciones y afrontamiento (009 CA-001, CA-002, CA-003).

## Bloque F — Hogares y población (specs 008, 007)
- [x] F1. Plantillas de hogar del perfil colombiano y del perfil prototipo; viviendas; apellidos; abuelos cuidadores (008 CA-001, CA-002, CA-003, CA-006).
- [x] F2. Ciudadanos:
  - nombres, nacimiento, educación CINE, ahorro y pensión por edad y sexo (007 CA-001, CA-002, CA-004, CA-007);
  - 001 CA-005, pendiente desde M0.
- [x] F3. **Apariencia** de cada ciudadano para los sprites del concepto visual B (docs/identidad-visual.md): tono de piel (1–5), peinado (8), color de pelo con canas según la edad, accesorios (gafas, barba) y ropa según el oficio. Determinista por persona. Requiere proponer el cambio en la spec 007 (la apariencia no está en su modelo de datos) antes de programarlo.

## Bloque G — Empleo y objetos (specs 006, 005)
- [x] G1. Situación laboral GEIH: ocupados formales e informales, desocupados e inactivos (006 CA-001, CA-002, CA-003, CA-007).
- [x] G2. Objetos iniciales de persona y de hogar, con su evento de origen (005 CA-001, CA-002, CA-003).

## Bloque H — Historia generada (spec 030)
- [x] H1. Fundación y crecimiento por décadas; `foundedAt` de lugares y organizaciones.
- [x] H2. Genealogía hacia atrás con antepasados fallecidos o vivos fuera del mundo (`demo.deathMinute`, `demo.generation`).
- [x] H3. Trayectorias previas con hechos históricos como causas (007 CA-003, 030 CA-001 a CA-006; CA-003 y CA-006 desde la CLI en el bloque I).
- [x] H4. Coste: `world:new` en < 5 s y < 2 MB de historia (030 CA-007). Medido en el bloque I con `bench --check`: ≈ 0,25 s y 1,75 MB la base entera.

## Bloque I — CLI y persistencia
- [x] I1. `world:new` con perfil, catálogos, festivos, epoch 2026-01-01 y la opción `--profile prototipo`.
- [x] I2. `world:report`: población frente al perfil, con desviaciones y entradas `por_confirmar`.
- [x] I3. `world:map`: el mapa en la terminal.
- [x] I4. `world:history` y `citizen:report`, con árbol genealógico y línea de vida.
- [x] I5. Guardar, cerrar y cargar un mundo de M1: mismo hash (027 CA-001 con población). Mundo de ejemplo en `docs/validaciones/mundos/` (027 R-011).

## Cierre de M1
- [x] 023 CA-001 y CA-002 con población: dos procesos, mismo hash; semillas distintas dan hashes distintos. CA-001 hecho en el bloque I (100 personas, 30 días) y hashes distintos con 001 CA-005. La parte del 50 % de la CA-002 pasa a M2, porque necesita la vida diaria.
- [x] Decidir el coste del `stateHash` en cada flush con población. Decidido por el usuario: puntos de control (027 R-012). 30 días pasan de 12 s a 2,4 s.
- [x] `pnpm bench` con 200 personas: memoria por persona y tiempo de `world:new`. Nota en `docs/validaciones/M1-cierre.md`: ≈ 16 KB por persona viva y `world:new` en ≈ 0,25 s.
- [x] Paridad con el perfil prototipo (60 personas): edades, hogares y empleo frente al prototipo (`genWorld`), incluida la nueva prueba de la 007 CA-006.
- [x] `/sincronizar-docs all` sin discrepancias; proponer las specs que pasan a `implementada`: 001, 003, 007, 029 y 030 tienen todos sus CA con prueba verde.
- [ ] Revisar y aprobar las specs de M2 (010, 011, 015, 016, 017, 021) antes de redactar `tasks/M2-vida-diaria.md`.
