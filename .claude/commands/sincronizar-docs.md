---
description: Revisa que la documentación de módulos y specs refleje el código actual
argument-hint: <ruta del módulo | all>
---
Audita la documentación viva de `$ARGUMENTS` (o de todos los módulos si es `all` o está vacío).

1. Ejecuta `node scripts/guardrails/check.mjs` y corrige lo que reporte.
2. Para cada módulo, compara su `MODULE.md` con el código real:
   - ¿La sección 3 lista exactamente lo que exporta `index.ts`, con contratos correctos?
   - ¿La tabla de criterios coincide con las pruebas que existen y pasan?
   - ¿El diseño describe las estructuras de datos actuales?
   - ¿La paridad con el prototipo refleja la última validación?
3. Comprueba que el `estado` de cada spec coincide con la realidad: implementada solo si todos sus CA tienen prueba verde.
4. Regenera los índices: `node scripts/guardrails/indice.mjs`.
5. Muéstrame las discrepancias y las correcciones propuestas. Aplica solo las de documentación. No toques código sin preguntar.
