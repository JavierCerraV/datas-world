#!/usr/bin/env node
// Hook PreToolUse de Claude Code (Edit|Write|MultiEdit|NotebookEdit).
// Salida 2 = bloquear la edición y explicar el motivo a Claude por stderr.
import { readFileSync } from 'node:fs';
import { rel, exists, isModuleCode, moduleDocFor, unapprovedSpecsFor } from './lib.mjs';

let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
if (!target) process.exit(0);
const f = rel(target);
const block = (msg) => { process.stderr.write(`GUARDARRAÍL: ${msg}\n`); process.exit(2); };

// 1. Referencias de solo lectura.
if ((/^docs\/vision\//.test(f) || /^prototipo\//.test(f)) && !exists('.guardrails/permitir-referencia')) {
  block(`${f} es material de referencia de solo lectura (visión original y prototipo). Si el usuario pide expresamente modificarlo, dile que cree el archivo .guardrails/permitir-referencia y lo borre después.`);
}
// 2. Secretos.
if (/(^|\/)\.env(\.|$)/.test(f)) block('no se editan archivos .env desde Claude Code. Pide al usuario que lo haga.');

// 3. Código de módulo: requiere MODULE.md y specs aprobadas.
if (isModuleCode(f)) {
  const doc = moduleDocFor(f);
  const { missingDoc, bad } = unapprovedSpecsFor(doc);
  if (missingDoc) block(`antes de escribir código en ${f} debe existir ${doc}. Créalo desde docs/modulos/_plantilla-MODULE.md indicando las specs que implementa.`);
  if (bad.length) block(`${doc} implementa specs que no están aprobadas: ${bad.join(', ')}. Regla de oro 1: sin spec aprobada no hay código. Propón cambios en la spec y pide aprobación al usuario.`);
}
process.exit(0);
