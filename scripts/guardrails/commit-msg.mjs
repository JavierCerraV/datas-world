#!/usr/bin/env node
// Verifica el formato del mensaje de commit: tipo(ámbito): descripción [NNN ...]
import { readFileSync } from 'node:fs';
const msg = readFileSync(process.argv[2], 'utf8').split('\n')[0];
const ok = /^(feat|fix|refactor|perf|test)(\([a-z0-9-]+\))?: .+ \[\d{3}[^\]]*\]$/.test(msg)
  || /^(docs|spec|chore|ci|build|style)(\([a-z0-9-]+\))?: .+/.test(msg)
  || /^(Merge|Revert) /.test(msg);
if (!ok) {
  console.error(`Mensaje de commit no válido: "${msg}"
Formato: feat(engine): reloj global [002 CA-001..CA-004]
Los commits de código (feat/fix/refactor/perf/test) deben citar la spec entre corchetes.
Los de documentación usan docs:, spec:, chore:, ci:.`);
  process.exit(1);
}
