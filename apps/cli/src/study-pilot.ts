// `pnpm cli study:pilot` (spec 047 R-001b): el protocolo completo con unas pocas personas, para afinar al terapeuta y leer
// los diálogos antes del estudio. Todas tienen la sesión el mismo día del mundo; entre una sesión y la siguiente pasa una
// semana en una copia de trabajo. El mundo de origen no se toca (INV-003). Todavía sin dosis del protocolo (R-004).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ACT_PNR_3, MINUTES_PER_DAY } from '@datas-world/engine';
import { MAX_TURNS_SESSION } from '@datas-world/llm-gateway';
import { DEFAULT_DB, UsageError, nameOf, toInt } from './common.ts';
import type { Io } from './common.ts';
import { copyWorld } from './psychometrics.ts';
import { advanceWorld, costOf, gatewayFor, holdSession, loadWorld, readSaved, saveSession } from './study-core.ts';
import type { Saved } from './study-core.ts';
import { minLevelOf } from './study-session.ts';

/** Dónde va la copia de trabajo: en la fecha de qué sesión está. */
interface State {
  at: number;
}

const share = (xs: readonly string[]): string => {
  const n = new Map<string, number>();
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k, c]) => `${k} ${c}`).join(', ');
};

function summaryOf(sessions: readonly Saved[], usage: Record<string, { calls: number; usage: unknown; costMicros: number }>, cost: number): string {
  const lines = [
    '# Piloto del protocolo · resumen',
    '',
    '> Sesiones con personas simuladas, todavía sin efecto del protocolo en el mundo. Sirve para leer los diálogos y afinar al terapeuta; no dice nada sobre personas reales.',
    '',
    '| Persona | Sesión | Fecha | Final | Turnos | Fidelidad | Faltó | Posturas de la persona | Nivel máx. | Plantillas |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const s of sessions)
    lines.push(`| ${s.meta.name} (${s.meta.citizen}) | ${s.meta.session} | ${s.meta.date} | ${s.result.ended} | ${s.result.therapistTurns} | ${Math.round(s.result.fidelity * 100)} % | ${s.result.missing.join(', ') || '—'} | ${share(s.patient.map((p) => p.stance))} | ${Math.max(0, ...s.patient.map((p) => p.level))} | ${s.patient.filter((p) => p.expression === 'template').length} |`);
  lines.push('', '## Uso del LLM en esta ejecución', '', '| Propósito | Llamadas | Coste (USD) |', '|---|---|---|');
  for (const [p, m] of Object.entries(usage)) lines.push(`| ${p} | ${m.calls} | ${(m.costMicros / 1e6).toFixed(4)} |`);
  lines.push(`| **total** | ${Object.values(usage).reduce((a, m) => a + m.calls, 0)} | **${cost.toFixed(4)}** |`, '');
  return lines.join('\n');
}

export async function studyPilot(args: string[], io: Io): Promise<void> {
  const { values: v } = parseArgs({
    args,
    options: {
      db: { type: 'string', default: DEFAULT_DB }, citizens: { type: 'string' }, sessions: { type: 'string', default: String(ACT_PNR_3.sessions.length) },
      provider: { type: 'string', default: 'mock' }, 'llm-config': { type: 'string', default: 'config/llm.json' },
      'max-turns': { type: 'string', default: String(MAX_TURNS_SESSION) }, 'gap-days': { type: 'string', default: '7' }, 'min-level': { type: 'string', default: '2' }, hour: { type: 'string', default: '10' },
      work: { type: 'string', default: 'data/estudio/piloto.db' }, out: { type: 'string', default: 'data/estudio/piloto' }, resume: { type: 'boolean', default: false },
    },
  });
  const ids = (v.citizens ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) throw new UsageError('indique las personas: --citizens CIT-000013,CIT-000107,…');
  const nSessions = toInt('sessions', v.sessions, 1);
  if (nSessions > ACT_PNR_3.sessions.length) throw new UsageError(`el protocolo tiene ${ACT_PNR_3.sessions.length} sesiones`);
  const maxTurns = toInt('max-turns', v['max-turns'], 1), gapDays = toInt('gap-days', v['gap-days'], 0);
  const minLevel = minLevelOf(v['min-level']);
  const hour = toInt('hour', v.hour, 0);
  if (hour > 23) throw new UsageError('--hour debe estar entre 0 y 23');
  const gateway = gatewayFor(v.provider!, v['llm-config']!, io);
  const out = v.out!;
  const file = (id: string, n: number) => join(out, `${id}-s${n}`);
  const statePath = join(out, 'estado.json');
  mkdirSync(out, { recursive: true });

  let state: State = { at: 1 };
  if (v.resume && existsSync(statePath) && existsSync(v.work!)) {
    state = JSON.parse(readFileSync(statePath, 'utf8')) as State;
    io.err(`Reanudando: la copia está en la fecha de la sesión ${state.at}`);
  } else {
    const w = loadWorld(v.db!).world;
    for (const id of ids) if (!w.citizens.has(id as never)) throw new UsageError(`no existe ${id}`);
    io.err(`Copiando ${v.db} → ${v.work}`);
    copyWorld(v.db!, v.work!);
    // La consulta es a una hora de consulta: la copia avanza hasta la próxima `--hour` (y las siguientes caen a la misma).
    const wait = (hour * 60 - (w.now % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    if (wait > 0) advanceWorld(v.work!, [], wait);
  }
  const saveState = () => writeFileSync(statePath, `${JSON.stringify(state)}\n`);
  saveState();

  const done: Saved[] = [];
  const prevOf = (id: string, n: number): Saved | undefined => (n > 1 ? done.find((s) => s.meta.citizen === id && s.meta.session === n - 1) : undefined);
  for (let n = 1; n <= nSessions; n++) {
    // Lo ya hecho en una ejecución anterior no se repite (ni se vuelve a pagar).
    const kept = v.resume ? ids.filter((id) => existsSync(`${file(id, n)}.json`) && readSaved(`${file(id, n)}.json`).result.ended !== 'sin_llm') : [];
    if (n > state.at) {
      io.err(`Pasan ${gapDays} días…`);
      advanceWorld(v.work!, ids.flatMap((id) => prevOf(id, n) ?? []), gapDays * MINUTES_PER_DAY);
      state = { at: n };
      saveState();
    }
    const todo = ids.filter((id) => !kept.includes(id));
    for (const id of kept) done.push(readSaved(`${file(id, n)}.json`));
    if (todo.length === 0) continue;
    const loaded = loadWorld(v.work!);
    io.err(`Sesión ${n}: ${todo.map((id) => nameOf(loaded.world, id)).join(', ')}`);
    const held = await Promise.all(todo.map(async (id) => {
      const prev = prevOf(id, n);
      const s = await holdSession(loaded, {
        gateway, provider: v.provider!, citizenId: id, session: n, maxTurns, minLevel, ...(prev ? { prev } : {}),
        onTurn: (turn, stance) => io.err(`  ${id} s${n} turno ${turn + 1}: ${stance ?? 'se fue'}`),
      });
      saveSession(s, file(id, n));
      return s;
    }));
    done.push(...held);
    const failed = held.find((s) => s.result.ended === 'sin_llm');
    if (failed) throw new Error(`el LLM del terapeuta no respondió con ${failed.meta.citizen} en la sesión ${n} (${failed.result.detail ?? 'sin detalle'}); corrija la causa y repita con --resume`);
  }

  const order = (s: Saved) => `${s.meta.citizen}-${s.meta.session}`;
  done.sort((a, b) => (order(a) < order(b) ? -1 : 1));
  const usage = Object.fromEntries(Object.entries(gateway.metrics()).sort(([a], [b]) => (a < b ? -1 : 1)).map(([p, m]) => [p, { calls: m.calls, usage: m.usage, costMicros: m.costMicros }]));
  const cost = costOf(gateway);
  writeFileSync(join(out, 'resumen.md'), summaryOf(done, usage, cost));
  writeFileSync(join(out, 'resumen.json'), `${JSON.stringify({ citizens: ids, sessions: nSessions, maxTurns, gapDays, minLevel, usage, results: done.map((s) => ({ ...s.meta, ...s.result })) }, null, 2)}\n`);
  io.out(`Piloto: ${done.length} sesiones de ${ids.length} personas · coste ${cost.toFixed(4)} USD`);
  io.out(`Resumen: ${join(out, 'resumen.md')} · transcripciones: ${out}`);
}
