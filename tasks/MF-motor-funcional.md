# MF — Motor funcional-contextual

Specs: 009 v1.0 (temperamento), 035 (paraguas), 036–042 (subspecs). Decisiones: ADR-007 (arquitectura) y ADR-008 (historia sintética). Informe: `docs/investigacion/impacto-motor-funcional.md`.

**Resultado esperado:** las personas de Data's World deciden por la competencia de fuentes de control que su historia construyó:
- funciones directas y derivadas;
- reglas;
- valores;
- eventos privados.

Cada conducta se explica con la cadena del documento rector §12. La batería 042 pasa entera y el motor ocupa ≤ 20 KB por persona.

**Cómo se trabaja:**
- cada bloque va en su rama (`mf/1-temperamento`…), empieza con el plan breve y los criterios, y termina con un PR que el usuario aprueba;
- al final de cada bloque, el mundo se genera y avanza 30 días con `pnpm check` en verde;
- ningún bloque de código empieza sin sus specs aprobadas (regla de oro 1).

**Orden respecto a M2:** MF1 va primero, porque retira la personalidad a utilidad. Después se pueden cerrar los bloques F–H de M2 (economía, trabajo, integración) con el adaptador, y luego MF2–MF8. M3 (vida social) empieza después de MF8, porque 012 y 025 se escriben sobre el motor funcional.

## Bloque MF0 — Fase A: especificación (rama `motor-funcional/fase-a`)
- [x] MF0.1 Inventario de consumidores e informe de impacto.
- [x] MF0.2 ADR-007 (motor funcional-contextual) y ADR-008 (historia de aprendizaje sintética).
- [x] MF0.3 009 v1.0 en revisión (`specs/propuestas/`), 035 en revisión, borradores 036–042.
- [x] MF0.4 Registro de preguntas abiertas; glosario, hoja de ruta, referencia del prototipo y plantilla de specs.
- [x] MF0.5 Aprobación del usuario: 009 v1.0, 035 y este plan.

## Bloque MF1 — Temperamento y adaptador (009 v1.0; rama `mf/1-temperamento`)
Specs: 009 v1.0 (aprobada), 035 (aprobada).
- [x] MF1.1 Mover la propuesta a `specs/009-temperament.md`; 009 v0.3 → `obsoleta`; actualizar `specs:` de los `MODULE.md` afectados.
- [x] MF1.2 Catálogos:
  - `personality_traits` 2026.10.1: solo Big Five;
  - `temperament_params` 2026.10.1: nuevo, con `modula`, mapeo, `residualSd` y `scale`;
  - `life_domains` 2026.10.1: sustituye a `personal_values`.
- [x] MF1.3 Generación: descriptores (R-001) y `tmp.*` (R-002, flujo `gen:temperament`). Se eliminan `pers.coping`, los extras y `val.*`.
- [x] MF1.4 Adaptadores `@deprecated` (`engine/src/temperament/legacy.ts`, `generators/src/personality/legacy.ts`) usados por needs, routines, decision, habits y leisure; ninguna otra lectura de `pers.*`.
- [x] MF1.5 Prueba de arquitectura y regla de ESLint (R-006) con su fixture que viola la regla (CA-B), y la comprobación de caducidad del adaptador (035 §9).
- [x] MF1.6 El mundo de ejemplo de M1 se sigue cargando (027 R-011): el motor ignora las columnas que ya no usa, sin migración ni cambio de su hash; documentar que los mundos nuevos tienen otro hash.
- [x] MF1.7 `citizen:report`: sección de temperamento como descriptor.
- [x] MF1.8 Criterios: 009 CA-A, CA-B, CA-C, CA-D y CA-G. CA-E queda para MF2.

## Bloque MF2 — Estímulos, funciones y laboratorio (036, 042 V-1–V-3, V-6; rama `mf/2-funciones`)
- [x] MF2.1 Ontología compartida de estímulos (catálogo `stimulus_classes`) con rasgos para la generalización.
- [x] MF2.2 Almacenes por persona (funciones y fuerzas de respuesta) con topes, poda y archivo en SQLite (con la entidad).
- [x] MF2.3 Mecanismos:
  - respondiente (R-001) y operante (R-002);
  - extinción contextual (R-003);
  - generalización y discriminación (R-004, R-005);
  - habituación (R-006);
  - reforzadores secundarios y generalizados (R-007, R-008);
  - registro de contingencias (R-011): evento → consecuencia (`EVENT_LEARNING`); conducta → consecuencia pasa a MF3.
- [x] MF2.4 Laboratorio determinista `engine/src/lab/` y escenarios V-1, V-2, V-3 y V-6.
- [x] MF2.5 Enganche con el mundo: las consecuencias de los eventos de M2 (`JOB_LOST`, `FELL_ILL`, `LEISURE_DONE`…) actualizan funciones. Las emociones de 010 salen de las funciones elicitadas presentes (se retira del adaptador la modulación por neuroticismo de las emociones).
- [x] MF2.6 Criterios: 036 CA-001–CA-005; 009 CA-E; `pnpm bench` con KB por persona (`docs/validaciones/MF2-bench-funciones.md`).

## Bloque MF3 — Selección de conducta (040, 036 R-009/R-012; rama `mf/3-seleccion`)
- [x] MF3.1 Estados aprendidos `hist.discountK` y `hist.variability`, inicializados por el temperamento.
- [x] MF3.2 Selección por fuentes de control:
  - candidatas del repertorio y de la rutina como reglas;
  - operaciones motivadoras desde 010;
  - vector de aportes;
  - validador de 017 conservado.
- [x] MF3.3 Causas funcionales en los eventos de las decisiones (`LEISURE_DONE` con sus fuentes y orígenes; `ARRIVED_LATE` cita `OVERSLEPT`, que cita el descuento). La fuerza aprendida de cada afición es una fuente; la frecuencia de la ficha queda como saciedad (intervalo del reforzador).
- [x] MF3.4 Se retiran del adaptador la temperatura (impulsividad), la utilidad de las obligaciones (responsabilidad) y quedarse dormido por responsabilidad. 017 → `obsoleta`; 018 → `obsoleta`.
- [x] MF3.5 Criterios: 040 CA-001–CA-006; 042 V-4 y V-5.

## Bloque MF4 — Red relacional (037; rama `mf/4-red`)
- [x] MF4.1 Grafo por persona con marcos, Crel y Cfunc; enseñanza por la comunidad verbal en los eventos con hablante (`JOB_WARNING`, gota a gota), sin conversaciones hasta M3 (025).
- [x] MF4.2 Vinculación mutua y combinatoria perezosa con caché; transformación de funciones por marco.
- [x] MF4.3 Métricas de red (037 R-008).
- [x] MF4.4 Criterios: 037 CA-001–CA-005; 042 V-7, V-8 y V-11a. CA-004 se cumple con ≤ 2 relaciones por estímulo; con redes muy densas queda abierto (PA-110).

## Bloque MF5 — Reglas, valores y augmentals (038; rama `mf/5-reglas-valores`)
- [x] MF5.1 Reglas: pliance, tracking y augmenting (formativo) con su historia; competencia con las contingencias; reglas de la rutina con desaliento en la búsqueda de empleo.
- [x] MF5.2 Redes de valor desde `life_domains` (raíz `dominio.*`) y red opuesta derivada (`opposition ∘ part_of`).
- [x] MF5.3 La aprobación emparejada con el disfrute (ocio con otros) y con el dinero (contratación). Aún no es generalizada: el tercer reforzador llega con la vida social (M3).
- [x] MF5.4 Criterios: 038 CA-001–CA-005; 042 V-9 y V-11b.

## Bloque MF6 — Eventos privados y flexibilidad (039; rama `mf/6-privados`)
- [x] MF6.1 Eventos privados como estímulos; paso de derivación; episodios de PNR con condición de parada.
- [x] MF6.2 Evitación experiencial como respuesta reforzada negativamente; costes demorados.
- [x] MF6.3 Enmarque jerárquico con "Yo" como repertorio aprendido.
- [x] MF6.4 El estrés y el ánimo de 010 salen de la carga aversiva y apetitiva presente (se retira del adaptador la modulación de estresores por neuroticismo y resiliencia).
- [x] MF6.5 Criterios: 039 CA-001–CA-003; 042 V-10.

## Bloque MF7 — Desarrollo (041; rama `mf/7-desarrollo`)
- [x] MF7.1 Catálogo `development_episodes` y fase de desarrollo en `generateWorld` (flujo `gen:development`).
- [x] MF7.2 Comunidad verbal familiar y escolar; primeros reforzadores generalizados, reglas y redes de valor; `backstory` con causas.
- [x] MF7.3 Hábitos de salud (031) y ficha de esparcimiento (032) desde los repertorios del desarrollo.
- [x] MF7.4 **Eliminar los adaptadores `@deprecated`.** La comprobación de caducidad pasa a exigir su ausencia.
- [x] MF7.5 Criterios: 041 CA-001–CA-004; 042 V-12; 009 CA-F.
- [x] MF7.6 Pestaña **Historia de vida** en la ficha del visor, con los episodios por etapa y el familiograma extenso; ruta `GET /api/citizens/:id/life` (041 R-009, CA-005, CA-006; decisión del usuario, 2026-09-28).

## Bloque MF8 — Integración y cierre (rama `mf/8-cierre`)
- [x] MF8.1 Adaptaciones de specs: 010, 011, 013, 014, 019, 020 (resiliencia como métrica de trayectoria), 021 (niveles), 025 (mentir sin honestidad), 031 y 032, con sus filas de historial.
- [x] MF8.2 035 CA-001 (cadena §12 completa para 20 conductas) y CA-003 (500 × 1 año, ≤ 20 KB por persona, < 10 min). Resultado (2026-09-28): 20 de 20 cadenas completas; motor funcional 10,4 KB por persona; un año con 254 personas (el mapa no aloja 500) en 411 s. Ver MF8.5.
- [ ] MF8.5 Rendimiento con historias densas: la vida diaria es un 53 % más lenta que en MF5 (411 s frente a 268 s con 254 personas). Con 500 personas pasaría de los 10 min (021 CA-002) y la memoria por persona (55 KB) pasa de los 40 KB del peldaño 4. Medir dónde (`netValue` sobre almacenes llenos en cada decisión) y optimizar sin cambiar el comportamiento.
- [x] MF8.3 Batería completa en `docs/validaciones/bateria-conductual.md`. El mundo de ejemplo del motor funcional no se guarda (≈ 24 MB con la historia de desarrollo): las pruebas lo generan al vuelo (README de `docs/validaciones/mundos/`).
- [ ] MF8.4 `/sincronizar-docs all`; proponer las specs que pasan a `implementada`; revisar las specs de M3 sobre el motor nuevo.
