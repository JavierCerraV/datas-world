#!/usr/bin/env node
// Cambia el estado de una o varias specs y registra el cambio en su historial.
// Uso: node scripts/aprobar-spec.mjs 001 002 014          (→ aprobada)
//      node scripts/aprobar-spec.mjs --estado en-revision 012
// Es el paso humano del flujo SDD: úsalo tú, no Claude Code.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
let estado = 'aprobada';
const i = args.indexOf('--estado');
if (i >= 0) { estado = args[i + 1]; args.splice(i, 2); }
const hoy = new Date().toISOString().slice(0, 10);
const files = readdirSync('specs');
for (const id of args) {
  const f = files.find((x) => x.startsWith(`${id}-`));
  if (!f) { console.error(`No existe la spec ${id}`); continue; }
  let t = readFileSync(`specs/${f}`, 'utf8');
  const version = (t.match(/^version: (.*)$/m) ?? [])[1] ?? '0.1';
  t = t.replace(/^estado: .*$/m, `estado: ${estado}`).trimEnd() + `\n| ${hoy} | ${version} | Estado → ${estado} |\n`;
  writeFileSync(`specs/${f}`, t);
  console.log(`${id} → ${estado}`);
}
