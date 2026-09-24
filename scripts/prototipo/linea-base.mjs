#!/usr/bin/env node
// Ejecuta el motor del prototipo (prototipo/index.html) sin navegador y produce
// la LÍNEA BASE de comportamiento que el motor TypeScript debe igualar o superar.
// Uso: node scripts/prototipo/linea-base.mjs [--seeds 100-109] [--days 365] [--out docs/validaciones/linea-base-prototipo.json]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]); return acc; }, []));
const [s0, s1] = (args.seeds ?? '100-109').split('-').map(Number);
const days = Number(args.days ?? 365);
const out = args.out ?? 'docs/validaciones/linea-base-prototipo.json';

const html = readFileSync(resolve('prototipo/index.html'), 'utf8');
const m = html.match(/\/\*ENGINE-START\*\/([\s\S]*?)\/\*ENGINE-END\*\//);
if (!m) { console.error('No se encontraron los marcadores ENGINE en prototipo/index.html'); process.exit(1); }

function loadEngine() {
  const ctx = { module: { exports: {} }, console, Math, Map, Set, Object, Array, String, Number, JSON };
  vm.createContext(ctx);
  vm.runInContext(m[1] + '\nmodule.exports={W,genWorld,tick};', ctx);
  return ctx.module.exports;
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const sd = (xs) => { const u = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - u) ** 2))); };
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };

const runs = [];
const t0 = Date.now();
for (let seed = s0; seed <= s1; seed++) {
  const E = loadEngine(); const { W } = E;
  E.genWorld(seed);
  const end = W.t + days * 1440;
  let nan = 0;
  while (W.t < end) E.tick();
  const adults = W.agents.filter((a) => a.age >= 18);
  for (const a of W.agents) for (const v of [a.st.animo, a.st.estres, ...Object.values(a.needs)]) if (!Number.isFinite(v)) nan++;
  const rels = W.agents.map((a) => Object.values(a.rels).filter((r) => r.c > 0.3).length);
  runs.push({
    seed, population: W.agents.length, nan,
    mood: { mean: mean(W.agents.map((a) => a.st.animo)), sd: sd(W.agents.map((a) => a.st.animo)) },
    stress: { mean: mean(W.agents.map((a) => a.st.estres)), sd: sd(W.agents.map((a) => a.st.estres)) },
    moneyAdults: { p10: q(adults.map((a) => a.money), 0.1), p50: q(adults.map((a) => a.money), 0.5), p90: q(adults.map((a) => a.money), 0.9) },
    employedAdultsPct: adults.filter((a) => a.job).length / (adults.length || 1),
    closeRelationsPerPerson: mean(rels),
    memoriesPerPerson: mean(W.agents.map((a) => a.mems.length)),
    eventsByType: { ...W.counts },
  });
}
const result = {
  generatedWith: 'scripts/prototipo/linea-base.mjs', seeds: [s0, s1], days,
  seconds: (Date.now() - t0) / 1000,
  note: 'Línea base del prototipo. El motor TS no tiene que ser idéntico, pero cada métrica debe caer dentro de la tolerancia definida en docs/prototipo-referencia.md o justificarse en la spec.',
  runs,
};
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(resolve(out), JSON.stringify(result, null, 2));
console.log(`Línea base: ${runs.length} semillas × ${days} días en ${result.seconds}s → ${out}`);
console.log(`Ánimo medio ${mean(runs.map((r) => r.mood.mean)).toFixed(3)} · estrés medio ${mean(runs.map((r) => r.stress.mean)).toFixed(3)} · NaN ${runs.reduce((a, r) => a + r.nan, 0)}`);
