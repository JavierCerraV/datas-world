// `pnpm cli study:session` (spec 047): UNA sesión del protocolo con una persona, para leer el diálogo antes de correr el
// estudio. El terapeuta y la persona van en llamadas separadas; el mundo de origen se lee y no se toca (INV-003). Con
// `--previous`, la semana entre sesiones pasa en una copia de trabajo, con la charla y la dosis de la sesión anterior ya aplicadas por el motor (R-004).
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { MAX_TURNS_SESSION } from '@datas-world/llm-gateway';
import { MINUTES_PER_DAY } from '@datas-world/engine';
import type { DisclosureLevel } from '@datas-world/engine';
import { DEFAULT_DB, UsageError, nameOf, toInt } from './common.ts';
import type { Io } from './common.ts';
import { copyWorld } from './psychometrics.ts';
import { advanceWorld, gatewayFor, holdSession, inputsOf, loadWorld, readSaved, saveSession, stampOf, usdOf, withPnr } from './study-core.ts';
import type { Saved } from './study-core.ts';

/** Deja la copia de trabajo `gapDays` días después de la sesión anterior y devuelve su ruta. */
function weekLater(src: string, work: string, prev: Saved, gapDays: number, io: Io): string {
  if (!existsSync(work)) {
    if (stampOf(src).hash !== prev.meta.hashBefore) throw new UsageError(`${src} no es el mundo en que se hizo la sesión ${prev.meta.session}: use la misma --db, o --work con la copia de esa sesión`);
    io.err(`Copiando ${src} → ${work}`);
    copyWorld(src, work);
  } else if (stampOf(work).date !== prev.meta.date) {
    throw new UsageError(`${work} está en ${stampOf(work).date} y la sesión ${prev.meta.session} fue en ${prev.meta.date}: borre la copia o indique otra con --work`);
  }
  io.err(`Pasan ${gapDays} días…`);
  // La sesión anterior entra al mundo antes de que pase la semana: la charla (043) y la dosis del protocolo (047 R-004).
  advanceWorld(work, gapDays * MINUTES_PER_DAY, { atStart: inputsOf(prev) });
  return work;
}

export const minLevelOf = (v: string | undefined): DisclosureLevel => {
  if (v !== '1' && v !== '2') throw new UsageError('--min-level debe ser 1 (conocido) o 2 (de confianza)');
  return Number(v) as DisclosureLevel;
};

export async function studySession(args: string[], io: Io): Promise<void> {
  const { values: v } = parseArgs({
    args,
    options: {
      db: { type: 'string', default: DEFAULT_DB }, citizen: { type: 'string' }, session: { type: 'string' }, previous: { type: 'string' },
      provider: { type: 'string', default: 'mock' }, 'llm-config': { type: 'string', default: 'config/llm.json' },
      'max-turns': { type: 'string', default: String(MAX_TURNS_SESSION) }, out: { type: 'string', default: 'data/estudio/sesion' },
      work: { type: 'string', default: 'data/estudio/mundo.db' }, 'gap-days': { type: 'string', default: '7' }, 'min-level': { type: 'string', default: '1' },
    },
  });
  const gateway = gatewayFor(v.provider!, v['llm-config']!, io);
  const maxTurns = toInt('max-turns', v['max-turns'], 1);
  const minLevel = minLevelOf(v['min-level']);
  // La sesión anterior da la persona, la memoria del terapeuta y el número de esta.
  const prev = v.previous ? readSaved(v.previous) : undefined;
  const n = v.session ? toInt('session', v.session, 1) : prev ? Number(prev.meta.session) + 1 : 1;

  // Con sesión anterior, el mundo sigue: la charla se consolida en la persona y pasa la semana, en una copia de trabajo.
  const loaded = loadWorld(prev ? weekLater(v.db!, v.work!, prev, toInt('gap-days', v['gap-days'], 0), io) : v.db!);
  // Sin persona indicada: la primera que tuvo un episodio de PNR (047 R-001b).
  const citizenId = v.citizen ?? (prev ? String(prev.meta.citizen) : withPnr(loaded.events)[0]);
  if (!citizenId) throw new UsageError('ninguna persona tuvo episodios de PNR en este mundo: indique --citizen CIT-…');

  io.err(`Sesión ${n} con ${nameOf(loaded.world, citizenId)} (${citizenId}), hasta ${maxTurns} turnos…`);
  const saved = await holdSession(loaded, {
    gateway, provider: v.provider!, citizenId, session: n, maxTurns, minLevel, ...(prev ? { prev } : {}),
    onTurn: (turn, stance) => io.err(`  turno ${turn + 1}: ${stance ?? 'se fue'}`),
  });
  saveSession(saved, v.out!);

  const r = saved.result;
  const templates = saved.patient.filter((p) => p.expression === 'template').length;
  io.out(`Sesión ${n}: ${r.ended}${r.detail ? ` (${r.detail})` : ''} · ${r.therapistTurns} turnos · fidelidad ${Math.round(r.fidelity * 100)} % · coste ${usdOf(saved.usage).toFixed(4)} USD`);
  if (templates > 0) io.out(`AVISO: en ${templates} de ${saved.patient.length} turnos el LLM de la persona no respondió y habló la plantilla de la postura.`);
  io.out(`Transcripción: ${v.out}.md · datos: ${v.out}.json`);
  if (r.ended === 'sin_llm') throw new Error(`el LLM del terapeuta no respondió (${r.detail ?? 'sin detalle'})`);
}
