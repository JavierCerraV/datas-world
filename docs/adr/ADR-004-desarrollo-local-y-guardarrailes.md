# ADR-004 — Desarrollo local con GitHub personal y guardarraíles automáticos

- **Estado:** aceptada
- **Fecha:** 2026-09-23

## Contexto

El usuario desarrollará en su equipo con Claude Code, con el repositorio en su cuenta personal de GitHub. El despliegue en Clouding se pospone. El prototipo HTML se considera el comportamiento objetivo. Se exige que todo quede con guardarraíles, specs y documentación por módulo que se actualice cada vez que se toca ese módulo.

## Decisión

1. **Local primero.** Todo el MVP (M0–M3) y la observación (M4) corren en local con `pnpm dev`. El documento de despliegue en Clouding se conserva como plan diferido. ADR-001 no cambia: el presupuesto de 1 GB sigue siendo un objetivo de diseño, verificado con `pnpm bench`.
2. **Repositorio privado en GitHub personal**, rama `main` protegida por CI. Se trabaja en ramas cortas (`m0/rng`, `m1/geografia`) con PR, aunque se trabaje en solitario: el PR es el punto de revisión humana.
3. **Guardarraíles en cuatro capas**, todas con el mismo script sin dependencias (`scripts/guardrails/`):
   - **Claude Code (hooks en `.claude/settings.json`)**:
     - `SessionStart` inyecta el estado del proyecto.
     - `PreToolUse` bloquea la edición de código si sus specs no están aprobadas o falta `MODULE.md`, y protege la visión, el prototipo y los `.env`.
     - `PreToolUse(Bash)` bloquea `--no-verify`, los push forzados y las escrituras por terminal en código o referencias.
     - `Stop` impide que Claude termine el turno con documentación desincronizada.
   - **Git local (`.githooks/`)**: pre-commit con las mismas verificaciones más `pnpm check`; commit-msg que exige citar la spec.
   - **CI (GitHub Actions)**: las mismas verificaciones contra la rama base, más tipos, lint, pruebas y determinismo.
   - **Revisión humana**: plantilla de PR con lista de verificación.
4. **Documentación viva por módulo**: cada paquete, cada app y cada sistema del motor y de los generadores (`src/<sistema>/`) tiene un `MODULE.md` con secciones fijas y bitácora. Si el código del módulo cambia sin cambiar su `MODULE.md` y sin añadir una fila a la bitácora, los guardarraíles fallan. Los índices `specs/000-indice.md` y `docs/modulos.md` se regeneran solos desde el frontmatter.
5. **Aprobar specs es un acto humano**, con `node scripts/aprobar-spec.mjs <ids>`, que además deja constancia en el historial de la spec.
6. **El prototipo es la referencia de comportamiento** con paridad estadística medible (`docs/prototipo-referencia.md`).

## Consecuencias

- Los guardarraíles detectan la ausencia de actualización, no su calidad. La calidad de la documentación se revisa en el PR.
- Los hooks de Claude Code solo se ejecutan si se confía en el proyecto. Los git hooks requieren `git config core.hooksPath .githooks`, que se automatiza con el script `prepare` de `package.json` en M0.
- Un bloqueo legítimo (por ejemplo, editar el prototipo) requiere una acción explícita del usuario. Esto es deliberado.
