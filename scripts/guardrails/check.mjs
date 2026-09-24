#!/usr/bin/env node
// Verificación de guardarraíles. Se ejecuta:
//  - al terminar cada turno de Claude Code (hook Stop, con --hook)
//  - en el pre-commit (.githooks/pre-commit)
//  - en `pnpm check` y en CI (con --ci --base origin/main)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, read, exists, frontmatter, loadSpecs, changedFiles, diffOf, isModuleCode, moduleDocFor,
  unapprovedSpecsFor, walk, MODULE_SECTIONS, SPEC_OK, rel } from './lib.mjs';
import { renderSpecIndexFile, buildModulesDoc } from './indice.mjs';

const argv = process.argv.slice(2);
const HOOK = argv.includes('--hook');
const CI = argv.includes('--ci');
const base = CI ? (argv[argv.indexOf('--base') + 1] ?? 'origin/main') : undefined;

let hookInput = {};
if (HOOK) { try { hookInput = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch {} }

const errors = [];
const warn = [];
const specs = loadSpecs();
const addedRow = (d) => /^\+\| \d{4}-\d{2}-\d{2}/m.test(d);

// A. Todo módulo con código tiene MODULE.md completo; todo sistema del motor también.
const code = [...walk('packages'), ...walk('apps')].filter(isModuleCode);
const docsNeeded = new Set(code.map(moduleDocFor));
for (const f of [...walk('packages/engine/src'), ...walk('packages/generators/src')]) {
  const m = f.match(/^(packages\/(?:engine|generators)\/src\/[^/]+)\/.+\.ts$/);
  if (m) docsNeeded.add(`${m[1]}/MODULE.md`);
}
for (const doc of docsNeeded) {
  if (!exists(doc)) { errors.push(`Falta ${doc}. Créalo desde docs/modulos/_plantilla-MODULE.md.`); continue; }
  const t = read(doc);
  const missing = MODULE_SECTIONS.filter((s) => !t.includes(s));
  if (missing.length) errors.push(`${doc} no tiene las secciones: ${missing.join(' · ')}`);
  const { bad } = unapprovedSpecsFor(doc, specs);
  if (bad.length) errors.push(`${doc} tiene código pero sus specs no están aprobadas: ${bad.join(', ')}`);
}

// B. Documentación sincronizada con los cambios.
const changed = changedFiles({ base });
const changedSet = new Set(changed);
const touchedDocs = new Set(changed.filter(isModuleCode).map(moduleDocFor));
for (const doc of touchedDocs) {
  if (!changedSet.has(doc)) { errors.push(`Se modificó código de ${doc.replace('/MODULE.md', '')} pero no su ${doc}. Actualiza API/diseño si cambió y añade una fila en "## 9. Bitácora de cambios".`); continue; }
  const d = diffOf(doc, { base });
  const isNew = d === '' && exists(doc);
  const ok = isNew ? /^\| \d{4}-\d{2}-\d{2}/m.test(read(doc).split('## 9. Bitácora de cambios')[1] ?? '') : addedRow(d);
  if (!ok) errors.push(`${doc} cambió pero no tiene una fila nueva en la bitácora (formato: | AAAA-MM-DD | tarea/commit | specs | cambio |).`);
}

// C. Specs aprobadas/implementadas que cambian deben registrar el cambio en su historial.
for (const f of changed.filter((p) => /^specs\/\d{3}-.+\.md$/.test(p) && !p.startsWith('specs/000'))) {
  const fm = exists(f) ? frontmatter(read(f)) ?? {} : {};
  const d = diffOf(f, { base });
  if (d && (SPEC_OK.has(fm.estado) || /^[-+]estado:/m.test(d)) && !addedRow(d)) {
    errors.push(`${f} cambió (estado: ${fm.estado}) sin fila nueva en "## 11. Historial de cambios".`);
  }
}

// D. Determinismo del motor (spec 023 R-001).
const FORBIDDEN = [/\bMath\.random\s*\(/, /\bDate\.now\s*\(/, /\bnew Date\s*\(\s*\)/, /\bperformance\.now\s*\(/, /\bcrypto\.randomUUID\b/,
  /from\s+['"]node:(fs|net|http|https|child_process)['"]/, /require\(\s*['"](node:)?(fs|net|http|https)['"]\s*\)/];
for (const f of walk('packages/engine/src').filter((p) => p.endsWith('.ts'))) {
  const lines = read(f).split('\n');
  lines.forEach((l, i) => { if (!/determinismo-permitido/.test(l) && FORBIDDEN.some((re) => re.test(l))) errors.push(`${f}:${i + 1} usa una API no determinista o de E/S prohibida en el motor: ${l.trim()}`); });
}

// E. Índices vivos al día (se regeneran solos salvo en CI).
const targets = [['specs/000-indice.md', exists('specs/000-indice.md') ? renderSpecIndexFile() : null], ['docs/modulos.md', buildModulesDoc()]];
for (const [p, content] of targets) {
  if (content == null) continue;
  const old = exists(p) ? read(p) : '';
  if (old === content) continue;
  if (CI) errors.push(`${p} está desactualizado: ejecuta node scripts/guardrails/indice.mjs y confirma el resultado.`);
  else { writeFileSync(join(ROOT, p), content); warn.push(`Índice regenerado: ${p}`); }
}

// Salida
for (const w of warn) console.log(`ℹ ${w}`);
if (!errors.length) { if (!HOOK) console.log('✔ Guardarraíles OK'); process.exit(0); }
const msg = `GUARDARRAÍLES — ${errors.length} problema(s):\n` + errors.map((e) => ` • ${e}`).join('\n') +
  '\nCorrígelos antes de terminar (ver CLAUDE.md §5 y §10).';
if (HOOK && hookInput.stop_hook_active) { console.error(msg + '\n(Aviso repetido: informa al usuario de lo que queda pendiente.)'); process.exit(0); }
console.error(msg);
process.exit(HOOK ? 2 : 1);
