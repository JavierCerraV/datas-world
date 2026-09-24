#!/usr/bin/env node
// Regenera los índices vivos a partir del frontmatter:
//   specs/000-indice.md (entre marcadores) y docs/modulos.md.
// Uso: node scripts/guardrails/indice.mjs [--check]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, read, exists, frontmatter, loadSpecs, walk } from './lib.mjs';

const START = '<!-- INDICE:INICIO (generado por scripts/guardrails/indice.mjs, no editar a mano) -->';
const END = '<!-- INDICE:FIN -->';

export function moduleDocs() {
  return [...walk('packages'), ...walk('apps')].filter((p) => p.endsWith('/MODULE.md')).sort();
}

export function buildSpecIndex() {
  const specs = loadSpecs();
  const docs = moduleDocs().map((p) => ({ p, fm: frontmatter(read(p)) ?? {} }));
  const rows = Object.keys(specs).sort().map((id) => {
    const s = specs[id];
    const title = (read(s.file).match(/^# \d+ — (.*)$/m) ?? [])[1] ?? s.nombre;
    const mods = docs.filter((d) => Array.isArray(d.fm.specs) && d.fm.specs.includes(id)).map((d) => `\`${d.p.replace('/MODULE.md', '')}\``).join(', ') || '—';
    const dep = Array.isArray(s.depende_de) ? s.depende_de.join(', ') : '';
    return `| [${id}](${s.file.replace('specs/', '')}) | ${title} | ${s.hito ?? ''} | ${dep} | ${s.estado ?? ''} | ${mods} |`;
  });
  return ['| Spec | Título | Hito | Depende de | Estado | Módulos que la implementan |', '|---|---|---|---|---|---|', ...rows].join('\n');
}

export function buildModulesDoc() {
  const rows = moduleDocs().map((p) => {
    const t = read(p); const fm = frontmatter(t) ?? {};
    const log = t.split('## 9. Bitácora de cambios')[1] ?? '';
    const last = log.split('\n').filter((l) => /^\| \d{4}-/.test(l)).pop();
    const lastTxt = last ? last.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 1).concat(last.split('|').map((s) => s.trim()).filter(Boolean).slice(-1)).join(' · ') : '—';
    return `| [\`${p.replace('/MODULE.md', '')}\`](../${p}) | ${fm.estado ?? ''} | ${(Array.isArray(fm.specs) ? fm.specs : []).join(', ') || '—'} | ${lastTxt} |`;
  });
  return `# Módulos

> Archivo generado por \`scripts/guardrails/indice.mjs\`. No editar a mano: se actualiza solo a partir del \`MODULE.md\` de cada módulo.

Cada módulo (paquete, app o sistema del motor) tiene un \`MODULE.md\` que se actualiza **cada vez que se toca su código**. Plantilla: [\`docs/modulos/_plantilla-MODULE.md\`](modulos/_plantilla-MODULE.md).

| Módulo | Estado | Specs | Último cambio |
|---|---|---|---|
${rows.join('\n')}
`;
}

export function renderSpecIndexFile() {
  const cur = read('specs/000-indice.md');
  const i = cur.indexOf(START), j = cur.indexOf(END);
  if (i < 0 || j < 0) return cur;
  return cur.slice(0, i + START.length) + '\n' + buildSpecIndex() + '\n' + cur.slice(j);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check');
  const targets = [['specs/000-indice.md', renderSpecIndexFile()], ['docs/modulos.md', buildModulesDoc()]];
  let stale = 0;
  for (const [p, content] of targets) {
    const old = exists(p) ? read(p) : '';
    if (old === content) continue;
    stale++;
    if (!check) { writeFileSync(join(ROOT, p), content); console.log(`actualizado ${p}`); }
    else console.error(`desactualizado: ${p}`);
  }
  process.exit(check && stale ? 1 : 0);
}
