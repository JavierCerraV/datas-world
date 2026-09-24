// Utilidades compartidas de los guardarraíles. Solo Node estándar, sin dependencias.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { execSync } from 'node:child_process';

export const ROOT = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
export const rel = (p) => relative(ROOT, resolve(ROOT, p)).split(sep).join('/');
export const read = (p) => readFileSync(join(ROOT, p), 'utf8');
export const exists = (p) => existsSync(join(ROOT, p));

/** Frontmatter YAML simple (clave: valor, listas [a, b]). */
export function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.*?)\s*(#.*)?$/i);
    if (!kv) continue;
    let v = kv[2];
    if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    out[kv[1]] = v;
  }
  return out;
}

/** Specs: { '012': { file, estado, nombre, hito, depende_de } } */
export function loadSpecs() {
  const specs = {};
  if (!exists('specs')) return specs;
  for (const f of readdirSync(join(ROOT, 'specs'))) {
    const m = f.match(/^(\d{3})-.+\.md$/);
    if (!m || m[1] === '000') continue;
    const fm = frontmatter(read(`specs/${f}`)) ?? {};
    specs[m[1]] = { file: `specs/${f}`, ...fm };
  }
  return specs;
}

/** Busca el MODULE.md más cercano subiendo desde un archivo, sin salir de packages/ o apps/. */
export function moduleDocFor(file) {
  const r = rel(file);
  if (!/^(packages|apps)\//.test(r)) return null;
  // Los sistemas del motor y de los generadores son módulos propios: packages/engine/src/<sistema>/MODULE.md
  const sub = r.match(/^(packages\/(?:engine|generators)\/src\/[^/]+)\/.+/);
  if (sub) return `${sub[1]}/MODULE.md`;
  let dir = dirname(r);
  while (dir && dir !== '.' && /^(packages|apps)\/[^/]+/.test(dir)) {
    if (exists(`${dir}/MODULE.md`)) return `${dir}/MODULE.md`;
    dir = dirname(dir);
  }
  return `${r.split('/').slice(0, 2).join('/')}/MODULE.md`; // esperado aunque no exista
}

/** ¿El archivo es código de un módulo (no su documentación)? */
export const isModuleCode = (file) => /^(packages|apps)\/[^/]+\/(src|test|tests)\/.+\.(ts|tsx|js|mjs|css|html|sql)$/.test(rel(file));

export const SPEC_OK = new Set(['aprobada', 'implementada']);

/** Specs de un MODULE.md que NO están aprobadas. */
export function unapprovedSpecsFor(moduleDoc, specs = loadSpecs()) {
  if (!exists(moduleDoc)) return { missingDoc: true, bad: [] };
  const fm = frontmatter(read(moduleDoc)) ?? {};
  const ids = Array.isArray(fm.specs) ? fm.specs : [];
  const bad = ids.filter((id) => !specs[id] || !SPEC_OK.has(specs[id].estado)).map((id) => `${id} (${specs[id]?.estado ?? 'no existe'})`);
  return { missingDoc: false, bad, ids };
}

export function git(cmd) {
  try { return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

/** Archivos cambiados: en local = trabajo sin confirmar + no rastreados; en CI = contra la rama base. */
export function changedFiles({ base } = {}) {
  if (git('rev-parse --is-inside-work-tree') !== 'true') return [];
  const lists = base
    ? [git(`diff --name-only ${base}...HEAD`)]
    : [git('diff --name-only HEAD'), git('diff --name-only --cached'), git('ls-files --others --exclude-standard')];
  return [...new Set(lists.filter(Boolean).join('\n').split('\n').filter(Boolean))];
}

export function diffOf(file, { base } = {}) {
  return (base ? git(`diff ${base}...HEAD -- "${file}"`) : git(`diff HEAD -- "${file}"`)) ?? '';
}

export function walk(dir, acc = []) {
  if (!exists(dir)) return acc;
  for (const e of readdirSync(join(ROOT, dir))) {
    if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue;
    const p = `${dir}/${e}`;
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, acc); else acc.push(p);
  }
  return acc;
}

export const MODULE_SECTIONS = ['## 1. Propósito', '## 2. Specs que implementa', '## 3. API pública', '## 4. Diseño interno y decisiones',
  '## 5. Invariantes y guardarraíles', '## 6. Cómo se prueba', '## 7. Paridad con el prototipo', '## 8. Pendientes y deuda', '## 9. Bitácora de cambios'];
