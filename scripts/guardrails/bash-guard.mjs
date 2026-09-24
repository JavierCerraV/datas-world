#!/usr/bin/env node
// Hook PreToolUse para Bash: bloquea atajos que saltan los guardarraíles.
import { readFileSync } from 'node:fs';
let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
const cmd = input.tool_input?.command ?? '';
const rules = [
  [/--no-verify\b/, 'no se permite saltar los git hooks (--no-verify).'],
  [/git\s+push\s+.*(--force\b|-f\b)/, 'no se permite push forzado. Pide al usuario que lo haga si es necesario.'],
  [/git\s+(reset\s+--hard|clean\s+-[a-z]*f)/, 'operación destructiva de git: pide confirmación explícita al usuario y que la ejecute él.'],
  [/(>|tee\s+|sed\s+-i[^|]*\s)\s*[^|;&]*(docs\/vision\/|prototipo\/)/, 'no se modifica material de referencia (visión/prototipo) por la terminal.'],
  [/(>|tee\s+|sed\s+-i)[^|;&]*(packages|apps)\/[^ ]*\/src\//, 'no escribas código de módulos por la terminal; usa las herramientas de edición para que se apliquen los guardarraíles.'],
  [/rm\s+-rf?\s+[^|;&]*(specs|docs|\.claude|scripts\/guardrails)\b/, 'no se borran specs, docs ni guardarraíles.'],
];
for (const [re, msg] of rules) if (re.test(cmd)) { process.stderr.write(`GUARDARRAÍL: ${msg}\n`); process.exit(2); }
process.exit(0);
