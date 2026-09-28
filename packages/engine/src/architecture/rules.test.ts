import { describe, expect, it } from 'vitest';
import { MECHANISM_READS_TEMPERAMENT, SELECTION_READS_TEMPERAMENT, SYSTEM_READS_TRAIT } from './fixtures.ts';
import { POLICY, checkArchitecture, doneTasks } from './rules.ts';

describe('009 R-006: guardarraíl anticircularidad', () => {
  it('CA-B: un módulo de selección que importa o lee el temperamento hace fallar la verificación', () => {
    const v = checkArchitecture([SELECTION_READS_TEMPERAMENT], new Set());
    expect(v.map((x) => x.rule).sort()).toEqual(['lectura-temperamento', 'seleccion-importa-temperamento']);
  });

  it('cualquier sistema fuera de la lista que nombra una columna de temperamento falla; un mecanismo del temperamento no', () => {
    expect(checkArchitecture([SYSTEM_READS_TRAIT], new Set()).map((x) => x.rule)).toEqual(['lectura-temperamento']);
    expect(checkArchitecture([MECHANISM_READS_TEMPERAMENT], new Set())).toEqual([]);
  });

  it('el adaptador solo lo importan los autorizados y caduca con la tarea de su bloque', () => {
    const user = { path: 'packages/engine/src/routines/columns.ts', text: "import { legacyTrait } from '../temperament/legacy.ts';" };
    const legacy = { path: 'packages/engine/src/temperament/legacy.ts', text: '' };
    // El mecanismo, con una política que aún autoriza un importador (como en los bloques MF1 a MF6).
    const withImporter = { ...POLICY, legacyImporters: { 'packages/engine/src/routines/columns.ts': 'MF7.3' } };
    expect(checkArchitecture([user, legacy], new Set(), withImporter)).toEqual([]);
    expect(checkArchitecture([user], new Set(['MF7.3']), withImporter).map((x) => x.rule)).toEqual(['adaptador-caducado']);
    // Desde MF7.4 (041) nadie está autorizado: ni las necesidades (MF6.4), ni la selección (MF3.4), ni nadie más.
    for (const path of ['packages/engine/src/needs/system.ts', 'packages/engine/src/decision/system.ts', 'packages/engine/src/economy/system.ts', user.path])
      expect(checkArchitecture([{ path, text: user.text }], new Set()).map((x) => x.rule), path).toEqual(['adaptador-no-autorizado']);
    // Y si el archivo del adaptador reaparece después de su caducidad, falla.
    expect(checkArchitecture([legacy], new Set([POLICY.legacyExpiry])).map((x) => x.rule)).toEqual(['adaptador-caducado']);
  });

  it('lee las tareas cerradas del plan', () => {
    expect([...doneTasks('- [x] MF1.2 a\n- [ ] MF1.3 b\n- [x] MF3.4 c')]).toEqual(['MF1.2', 'MF3.4']);
  });
});
