# Datas World

Laboratorio de simulación social: una población artificial que vive de forma autónoma, construida con Spec Driven Development y Claude Code. Desarrollo **local** con repositorio en GitHub. El prototipo HTML (`prototipo/index.html`) es la referencia de comportamiento.

## Contenido

```
CLAUDE.md                        Reglas de trabajo para Claude Code (se leen en cada sesión)
.claude/settings.json            Hooks de guardarraíles para Claude Code
.claude/commands/                /nueva-spec /implementar-spec /sincronizar-docs /paridad-prototipo
                                 /revisar-causalidad /prueba-un-anio
.githooks/                       pre-commit y commit-msg
.github/                         CI (GitHub Actions) y plantilla de PR
scripts/guardrails/              Verificaciones (sin dependencias, solo Node)
scripts/prototipo/linea-base.mjs Ejecuta el prototipo sin navegador y mide su comportamiento
scripts/aprobar-spec.mjs         Aprobar specs (paso humano)
docs/vision/                     Documento de visión original (solo lectura)
docs/adr/                        ADR-001 stack · 002 motor y event log · 003 LLM · 004 local y guardarraíles
                                 · 005 capacidades, componentes y memoria jerárquica (propuesta)
docs/prototipo-referencia.md     Prototipo → specs → módulos, parámetros y tolerancias
docs/modulos.md                  Índice vivo de módulos (generado)
docs/modulos/_plantilla-MODULE.md
docs/validaciones/               Línea base del prototipo y resultados de validaciones
docs/arquitectura.md · roadmap.md · glosario.md · despliegue-clouding.md (diferido)
specs/                           000-indice (vivo), _plantilla y specs 001–028
packages/*/MODULE.md, apps/*/MODULE.md   Documentación de cada módulo (antes del código)
tasks/M0-arranque.md             Primera lista de tareas
prototipo/index.html             Prototipo interactivo
```

## Puesta en marcha (una vez)

Necesitas: Node.js 24 LTS, Git, [GitHub CLI](https://cli.github.com/) (`gh`) y Claude Code.

```bash
# 1. Descomprime el kit y entra en la carpeta
cd datas-world

# 2. Git con los guardarraíles activados
git init -b main
git config core.hooksPath .githooks
git add -A && git commit -m "chore: kit de arranque"

# 3. Repositorio privado en tu cuenta personal de GitHub
gh auth login                 # si aún no lo has hecho
gh repo create datas-world --private --source=. --push

# 4. Aprueba las specs de M0 después de leerlas (ajústalas antes si algo no te convence)
node scripts/aprobar-spec.mjs 001 002 014 023 027
git commit -am "spec: aprobar specs de M0" && git push

# 5. Abre Claude Code en la carpeta
claude
```

La primera vez, Claude Code te pedirá **confiar en la carpeta**: acepta, porque los hooks solo funcionan en proyectos de confianza. Con `/hooks` puedes comprobar que están cargados.

Opcional, pero recomendado: en GitHub → Settings → Branches, protege `main` para exigir que la CI pase antes de fusionar.

## Primer prompt para Claude Code

```
Lee CLAUDE.md, docs/roadmap.md, docs/arquitectura.md, docs/prototipo-referencia.md
y las specs 001, 002, 014, 023 y 027. Luego ejecuta tasks/M0-arranque.md en orden,
una casilla a la vez, cada bloque en su propia rama con su PR.
Antes de escribir código de cada bloque, muéstrame el plan breve y los criterios
de aceptación que vas a cubrir con pruebas. Mantén actualizado el MODULE.md de
cada módulo que toques. Si un guardarraíl te bloquea, explícame por qué y qué
necesitas de mí.
```

## Cómo se trabaja cada día

1. Abre `claude`. El hook de inicio te dirá la siguiente tarea.
2. Pide: `/implementar-spec <spec>` o "sigue con la siguiente casilla de tasks/".
3. Revisa el PR en GitHub. La CI repite todas las verificaciones.
4. Antes de cada hito, revisa y aprueba sus specs con `node scripts/aprobar-spec.mjs …`.

## Los guardarraíles, en resumen

| Situación | Resultado |
|---|---|
| No se puede escribir código de un módulo… | …sin su `MODULE.md` ni con specs sin aprobar |
| Claude no puede terminar su turno… | …si cambió código sin actualizar el `MODULE.md` y su bitácora |
| No se puede hacer commit… | …sin pasar las verificaciones ni sin citar la spec en el mensaje |
| Material protegido | La visión, el prototipo y los `.env` no se tocan |
| Índices | `specs/000-indice.md` y `docs/modulos.md` se regeneran solos |

Detalle: CLAUDE.md §10 y `docs/adr/ADR-004-desarrollo-local-y-guardarrailes.md`.
