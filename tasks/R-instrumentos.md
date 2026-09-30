# R — Instrumentos psicológicos (capa de investigación)

Spec: 045 v0.2 (borrador). Orden: en paralelo a la elección del rediseño del visor (decisión del usuario, 2026-09-30); la pantalla adopta el estilo elegido en A8 de `M4-observacion.md`.

- [ ] I0 Revisar y aprobar la spec 045 con el usuario (preguntas abiertas de §10: instrumentos de la biblioteca, texto de PDF para proveedores sin PDF, modo entrevista, indicadores que faltan, reactividad).
- [ ] I1 Catálogo de indicadores (`catalogs/indicators.json`) y sus funciones puras sobre la ventana de días (045 R-004), con pruebas.
- [ ] I2 Motor de respuesta determinista: intensidad, estilo de respuesta y ruido con su flujo RNG (R-005, R-006; CA-003).
- [ ] I3 Selección: todos, al azar (simple y estratificado), seleccionados e individual, con exclusiones (R-007; CA-008).
- [ ] I4 Tablas en SQLite: biblioteca (`data/instruments.db`), aplicaciones, respuestas y muestras con miembros (027; R-013).
- [ ] I5 Ingesta: propósito `instrument` y `instrumentModels` en la pasarela (026); PDF con el modelo elegido, salida estructurada y Zod; correspondencia con el catálogo (R-001, R-002; CA-001, CA-007).
- [ ] I6 Biblioteca con los instrumentos de libre uso que apruebe el usuario, ya revisados (R-013; CA-010).
- [ ] I7 Estadística y agrupación: descriptiva, grupos con *d* de Cohen, alfa, test-retest y validez; exportación CSV (R-009; CA-004, CA-005, CA-009).
- [ ] I8 API y CLI: instrumentos, revisión, aplicación, resultados y muestras (`instrument:apply`).
- [ ] I9 Visor «Investigación»: a. Instrumento (subir o elegir, revisión), b. Aplicación, c. Resultados y muestra; marcas en el expediente (R-003, R-010; CA-002, CA-006).
- [ ] I10 Validación: aplicar un cribado de depresión de libre uso al mundo de ejemplo tras 60 días e informar de la variabilidad, la fiabilidad y la validez en `docs/validaciones/`.
