# ADR-006 — Catálogos de datos, clasificaciones oficiales y jerarquía territorial colombiana

- **Estado:** aceptada (usuario, 2026-09-24)
- **Fecha:** 2026-09-24

## Contexto

El mundo va a crecer mucho en variedad:
- tipos de lugar: tienda de barrio, supermercado, droguería, cajero automático, banco, bodega, fábrica, alcaldía, estación de policía, universidad, SENA;
- transporte: paraderos, metro, BRT, terminal, aeropuerto;
- tipos de objeto, sectores, ocupaciones;
- más barrios y, después, varios municipios.

El usuario pidió que todo esté **muy bien ordenado** y que el mundo se ajuste a la **organización, las leyes y los indicadores de Colombia**.

En los borradores 0.1 y 0.2 de las specs 004, 005 y 006 los tipos eran uniones fijas en TypeScript (`'office' | 'factory' | …`). Cada tipo nuevo obligaría a cambiar el código del motor y de varias specs, y se acabaría con listas paralelas y desordenadas.

## Decisión

### 1. Todo lo que es "un tipo de algo" es un catálogo de datos
- Un **catálogo** es una tabla versionada (`packages/generators/catalogs/<nombre>.json`) con entradas de clave jerárquica: `categoría.subcategoría.tipo`. Por ejemplo `comercio.minorista.supermercado`, `finanzas.cajero_automatico`, `transporte.masivo.estacion_metro`.
- Cada entrada declara:
  - su nombre en español;
  - el código oficial, si existe;
  - sus atributos por defecto: capacidad, horario, turnos, tamaño en tiles;
  - `desde`: el hito o peldaño en que se puede instanciar;
  - las capacidades del mundo que necesita (spec 001 R-007).
- Catálogos iniciales: `place_kinds`, `object_kinds`, `org_sectors`, `occupations`, `education_levels`, `territory_levels`, `transport_modes`, `trades_informal`.
- El motor no conoce los tipos concretos: trabaja con claves validadas contra el catálogo del mundo. Añadir un tipo es añadir una fila de datos más sus pruebas, no cambiar el motor.

### 2. Clasificaciones oficiales colombianas como códigos
| Catálogo | Clasificación | Entidad |
|---|---|---|
| `org_sectors` | CIIU Rev. 4 A.C. | DANE |
| `occupations` | CIUO-08 A.C. | DANE |
| `education_levels` | CINE 2011 A.C. | DANE, MinEducación |
| `territory_levels` | DIVIPOLA, con códigos ficticios en un rango reservado para lugares inventados | DANE |

Se usan como código de referencia, no como obligación de modelar todo su detalle.

### 3. Jerarquía territorial colombiana
Sigue la Constitución (arts. 286 y 311) y las leyes 136 de 1994 y 1551 de 2012:

```
País → Departamento → Municipio o distrito
     → Área (cabecera urbana | rural)
     → Comuna (urbana) o corregimiento (rural)
     → Barrio (urbano) o vereda (rural)
     → Manzana → Predio o edificio → Unidad (vivienda, local)
```
- Cada nivel es un lugar (`PLC`) de tipo `territorio.<nivel>`, con su padre, su código DIVIPOLA ficticio y, en los barrios, su **estrato** (Ley 142 de 1994, arts. 101–102).
- M1 instancia un departamento ficticio, un municipio (Data's World), una comuna y los barrios del mapa. La estructura ya admite varias comunas, municipios y conexiones intermunicipales (terminal, aeropuerto) sin rediseño.

### 4. Los catálogos forman parte del mundo
- Al crear un mundo se copian en `WorldConfig` la versión y el hash de cada catálogo. Así el `stateHash` los cubre.
- Un catálogo nuevo o ampliado crea mundos distintos. Un mundo guardado sigue funcionando con su versión, y la migración sigue la spec 027 R-011.
- Añadir entradas es compatible con mundos anteriores. Cambiar o quitar una entrada existente exige migración.

### 5. Perfil de país
Las cifras (indicadores del DANE) y las reglas legales (salario mínimo, jornada, recargos, pensión, festivos) viven en el **perfil de país** (spec 029), con fuente y vigencia. Los catálogos dicen *qué existe*; el perfil dice *cómo es Colombia en una fecha*.

## Consecuencias

- **A favor:**
  - crecer es añadir filas ordenadas, con código oficial, fecha de entrada y pruebas;
  - una sola fuente para nombres y atributos;
  - informes comparables con el DANE, porque usan sus mismas clasificaciones.
- **En contra:**
  - un paso más de validación al cargar, con Zod en el borde (ADR-001);
  - los catálogos entran en el hash, así que cualquier cambio en ellos da mundos distintos. Es lo deseable para la reproducibilidad.
- **Specs afectadas:**
  - 003 (jerarquía y barrios);
  - 004 (`PlaceKind` pasa a catálogo);
  - 005 (`kind` pasa a catálogo);
  - 006 (sectores CIIU, ocupaciones CIUO, oficios informales);
  - 007 (educación CINE);
  - 016 (modos de transporte);
  - 029 (nueva, perfil de país).

## Alternativas descartadas

- **Uniones de TypeScript** (borrador 0.2): cada tipo nuevo cambia el código y el orden se pierde.
- **Tipos en la base de datos, editables en caliente**: rompen el determinismo y la reproducibilidad (ADR-002).
