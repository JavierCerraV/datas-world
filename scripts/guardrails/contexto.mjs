#!/usr/bin/env node
// Hook SessionStart: lo que imprime se añade al contexto de Claude al abrir la sesión.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, read, exists, loadSpecs, git } from './lib.mjs';
import { moduleDocs } from './indice.mjs';

const specs = loadSpecs();
const byState = {};
for (const [id, s] of Object.entries(specs)) (byState[s.estado ?? '?'] ??= []).push(id);
let next = null;
if (exists('tasks')) {
  for (const f of readdirSync(join(ROOT, 'tasks')).filter((f) => f.endsWith('.md')).sort()) {
    const line = read(`tasks/${f}`).split('\n').find((l) => /^\s*- \[ \]/.test(l));
    if (line) { next = `${f}: ${line.replace(/^\s*- \[ \]\s*/, '')}`; break; }
  }
}
const branch = git('rev-parse --abbrev-ref HEAD');
const dirty = (git('status --porcelain') ?? '').split('\n').filter(Boolean).length;
console.log(`## Estado del proyecto (generado al iniciar la sesión)
- Rama: ${branch ?? 'sin git'} · archivos sin confirmar: ${dirty}
- Specs por estado: ${Object.entries(byState).map(([k, v]) => `${k}: ${v.sort().join(', ')}`).join(' | ')}
- Módulos documentados: ${moduleDocs().map((p) => p.replace('/MODULE.md', '')).join(', ') || 'ninguno'}
- Siguiente tarea pendiente: ${next ?? 'ninguna'}
Recuerda: solo specs aprobadas; al tocar un módulo actualiza su MODULE.md (API, diseño, bitácora); el prototipo es la referencia de comportamiento (docs/prototipo-referencia.md).`);
