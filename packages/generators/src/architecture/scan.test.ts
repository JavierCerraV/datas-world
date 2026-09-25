// 009 R-006, CA-B: el guardarraíl anticircularidad sobre el código real del repositorio (035 INV-003, §9).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { checkArchitecture, doneTasks } from '@datas-world/engine';
import type { SourceFile } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

function walk(dir: string, out: SourceFile[]): SourceFile[] {
  for (const name of readdirSync(dir).sort()) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.ts')) out.push({ path: relative(ROOT, full).split('\\').join('/'), text: readFileSync(full, 'utf8') });
  }
  return out;
}

describe('guardarraíl anticircularidad sobre el repositorio', () => {
  it('ningún módulo fuera de los permitidos lee el temperamento; la selección no lo importa; el adaptador no ha caducado', () => {
    const files: SourceFile[] = [];
    for (const top of ['packages', 'apps'])
      for (const pkg of readdirSync(join(ROOT, top)).sort()) {
        const src = join(ROOT, top, pkg, 'src');
        try {
          if (statSync(src).isDirectory()) walk(src, files);
        } catch {
          // paquete sin src (todavía)
        }
      }
    expect(files.length).toBeGreaterThan(50);
    const done = doneTasks(readFileSync(join(ROOT, 'tasks', 'MF-motor-funcional.md'), 'utf8'));
    const violations = checkArchitecture(files, done);
    expect(violations.map((v) => `${v.path} [${v.rule}] ${v.detail}`)).toEqual([]);
  });
});
