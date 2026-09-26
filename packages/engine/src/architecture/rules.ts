// Guardarraíl anticircularidad (spec 009 R-006, CA-B; 035 INV-003 y §9). Lógica pura: recibe los archivos del
// repositorio y las tareas cerradas del plan MF, y devuelve las violaciones. El recorrido del disco lo hace la
// prueba de `packages/generators/src/architecture/` (el motor no hace E/S, CLAUDE.md regla 2).

export interface SourceFile {
  path: string; // relativa a la raíz del repositorio, con '/'
  text: string;
}

export interface Violation {
  path: string;
  rule: 'lectura-temperamento' | 'seleccion-importa-temperamento' | 'adaptador-no-autorizado' | 'adaptador-caducado';
  detail: string;
}

export interface ArchitecturePolicy {
  /** Prefijos de ruta que pueden nombrar columnas `tmp.*` o `pers.*` (009 R-003, R-006). */
  temperamentReaders: readonly string[];
  /** Módulos de selección de conducta (capa 6): nunca importan el temperamento (salvo el adaptador mientras dure). */
  selectionModules: readonly string[];
  /** Archivos del adaptador `@deprecated`. */
  legacyFiles: readonly string[];
  /** Quién puede importar el adaptador y la tarea del plan MF que retira ese uso. */
  legacyImporters: Readonly<Record<string, string>>;
  /** Tarea tras la cual el adaptador no puede existir. */
  legacyExpiry: string;
}

/** Política vigente. Cada bloque MF quita de `legacyImporters` lo que sustituye. */
export const POLICY: ArchitecturePolicy = Object.freeze({
  temperamentReaders: [
    'packages/engine/src/temperament/',
    'packages/engine/src/functions/', // mecanismos de la 036 (035 §5)
    'packages/engine/src/architecture/',
    'packages/generators/src/personality/',
    'packages/generators/src/architecture/',
    'apps/cli/src/ficha.ts', // informe: el temperamento como descriptor (009 R-003)
  ],
  selectionModules: ['packages/engine/src/decision/', 'packages/engine/src/selection/'],
  legacyFiles: ['packages/engine/src/temperament/legacy.ts', 'packages/generators/src/personality/legacy.ts'],
  legacyImporters: {
    'packages/engine/src/needs/columns.ts': 'MF6.4',
    'packages/engine/src/needs/system.ts': 'MF6.4',
    'packages/engine/src/routines/columns.ts': 'MF7.3',
    'packages/engine/src/routines/system.ts': 'MF3.4',
    'packages/engine/src/decision/options.ts': 'MF3.4',
    'packages/engine/src/decision/system.ts': 'MF3.4',
    'packages/engine/src/index.ts': 'MF7.4',
    'packages/generators/src/health/habits.ts': 'MF7.3',
    'packages/generators/src/leisure/select.ts': 'MF7.3',
  },
  legacyExpiry: 'MF7.4',
});

const LITERAL = /['"`](tmp|pers)\.[A-Za-z]/;
const importsOf = (text: string) => [...text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!);
const isTest = (path: string) => path.endsWith('.test.ts');

/** Tareas marcadas en un plan (`- [x] MF3.4 …`). */
export function doneTasks(plan: string): Set<string> {
  return new Set([...plan.matchAll(/^- \[x\] (MF\d+(?:\.\d+)?)/gm)].map((m) => m[1]!));
}

export function checkArchitecture(files: readonly SourceFile[], done: ReadonlySet<string>, policy: ArchitecturePolicy = POLICY): Violation[] {
  const out: Violation[] = [];
  const allowed = (path: string) => policy.temperamentReaders.some((p) => path.startsWith(p));
  const legacyPresent = files.some((f) => policy.legacyFiles.includes(f.path));
  for (const f of files) {
    if (isTest(f.path)) continue; // las pruebas montan columnas para sus escenarios
    const selection = policy.selectionModules.some((p) => f.path.startsWith(p));
    if (!allowed(f.path)) {
      const line = f.text.split('\n').findIndex((l) => LITERAL.test(l));
      if (line >= 0) out.push({ path: f.path, rule: 'lectura-temperamento', detail: `línea ${line + 1}: nombra una columna de temperamento` });
    }
    for (const spec of importsOf(f.text)) {
      if (!/temperament\//.test(spec)) continue;
      const legacy = /temperament\/legacy(\.ts)?$/.test(spec) || /personality\/legacy(\.ts)?$/.test(spec);
      if (selection && !legacy) {
        out.push({ path: f.path, rule: 'seleccion-importa-temperamento', detail: `importa ${spec}` });
        continue;
      }
      if (!legacy || allowed(f.path)) continue;
      const task = policy.legacyImporters[f.path];
      if (!task) out.push({ path: f.path, rule: 'adaptador-no-autorizado', detail: `importa ${spec} sin estar en la política` });
      else if (done.has(task)) out.push({ path: f.path, rule: 'adaptador-caducado', detail: `la tarea ${task} ya está cerrada` });
    }
    if (/personality\/legacy(\.ts)?['"]/.test(f.text) && !allowed(f.path)) {
      const task = policy.legacyImporters[f.path];
      if (!task) out.push({ path: f.path, rule: 'adaptador-no-autorizado', detail: 'importa el adaptador de generadores sin estar en la política' });
      else if (done.has(task)) out.push({ path: f.path, rule: 'adaptador-caducado', detail: `la tarea ${task} ya está cerrada` });
    }
  }
  if (legacyPresent && done.has(policy.legacyExpiry))
    out.push({ path: policy.legacyFiles.join(', '), rule: 'adaptador-caducado', detail: `el adaptador debía eliminarse en ${policy.legacyExpiry}` });
  return out;
}
