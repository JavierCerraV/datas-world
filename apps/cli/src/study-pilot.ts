// `pnpm cli study:pilot` (spec 047 R-001, R-001b, R-003): el piloto de punta a punta con unas pocas personas. Tomas de
// línea base semanales, una sesión por semana con su toma antes, práctica diaria y una toma de seguimiento; en dos copias
// del mundo, una con el protocolo y otra de espera (las mismas personas, sin sesiones ni LLM). El mundo de origen no se
// toca (INV-003). Lo que cambia a la persona lo decide el motor (INV-001).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ACT_PNR_3, INSTRUMENT_IDS, MINUTES_PER_DAY, attendProbability, createRng, visitorStimulus } from '@datas-world/engine';
import type { Dose, EntityId, FunctionStore, InstrumentId } from '@datas-world/engine';
import { MAX_TURNS_SESSION } from '@datas-world/llm-gateway';
import { DEFAULT_DB, UsageError, nameOf, toInt } from './common.ts';
import type { Io } from './common.ts';
import { copyWorld } from './psychometrics.ts';
import { LlmUnavailable, NO_SHOW, VISITOR, advanceWorld, gatewayFor, holdSession, inputsOf, loadWorld, noShow, readSaved, saveSession, usdOf } from './study-core.ts';
import type { LoadedWorld, Saved, StudyInput } from './study-core.ts';
import { STUDY_INSTRUMENTS, takeMeasures } from './study-measure.ts';
import type { Measure } from './study-measure.ts';
import { TREATED, WAITLIST, csvOf, doseOf, summaryOf, totalUsage } from './study-report.ts';
import type { PilotData, Stop } from './study-report.ts';
import { minLevelOf } from './study-session.ts';

/** Dónde van las dos copias: en qué parada están, y si un avance quedó a medias (entonces no son fiables). */
interface State {
  at: number;
  advancing?: boolean;
}

/** Las paradas del calendario (R-003): línea base semanal, las sesiones y el seguimiento. Día 0 = sesión 1. */
export function stopsOf(baselineWeeks: number, followUpWeeks: number): Stop[] {
  const stops: Stop[] = [];
  for (let w = baselineWeeks; w >= 1; w--) stops.push({ take: stops.length, label: `línea base ${baselineWeeks - w + 1}`, day: -7 * w, phase: 'línea base' });
  for (const s of ACT_PNR_3.sessions) stops.push({ take: stops.length, label: `antes de la sesión ${s.n}`, day: 7 * (s.n - 1), phase: 'tratamiento', session: s.n });
  stops.push({ take: stops.length, label: `seguimiento (${followUpWeeks} semanas)`, day: 7 * (ACT_PNR_3.sessions.length - 1) + 7 * followUpWeeks, phase: 'seguimiento' });
  return stops;
}

/** Hasta `n` a la vez; al primer fallo no empieza más y, cuando terminan las que iban, lo lanza. */
async function pool<T, R>(items: readonly T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  let failed: unknown;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length && failed === undefined) {
      const k = next++;
      try {
        out[k] = await fn(items[k]!);
      } catch (e) {
        failed ??= e;
      }
    }
  }));
  if (failed !== undefined) throw failed;
  return out;
}

const DOSE_KEYS = ['yo', 'extincion', 'valores'] as const;

/** Ensayos de una práctica: uno por cada mecanismo que sus sesiones ya trabajaron con ella presente (R-004). */
function practiceTrials(sessions: readonly Saved[], id: string): Dose {
  const t: Dose = { yo: 0, extincion: 0, valores: 0 };
  for (const s of sessions) if (s.meta.citizen === id) for (const k of DOSE_KEYS) if (doseOf(s).dose[k] > 0) t[k] = 1;
  return t;
}

/** R-013: si la persona vuelve a la sesión, según lo que el terapeuta vale ya para ella. La primera la aceptó. */
function attendance({ world }: LoadedWorld, id: string, session: number): { p: number; attends: boolean } {
  if (session === 1) return { p: 1, attends: true };
  const store = world.citizens.get(id as EntityId)?.functions as FunctionStore | undefined;
  const p = attendProbability(store?.f.find((f) => f.s === visitorStimulus(VISITOR) && f.c === '')?.v ?? 0);
  return { p, attends: createRng(world.config.seed).fork(`protocol:attend:${id}:${session}`).chance(p) };
}

export async function studyPilot(args: string[], io: Io): Promise<void> {
  const { values: v } = parseArgs({
    args,
    options: {
      db: { type: 'string', default: DEFAULT_DB }, citizens: { type: 'string' }, provider: { type: 'string', default: 'mock' }, 'llm-config': { type: 'string', default: 'config/llm.json' },
      'max-turns': { type: 'string', default: String(MAX_TURNS_SESSION) }, 'min-level': { type: 'string', default: '2' }, hour: { type: 'string', default: '10' },
      'baseline-weeks': { type: 'string', default: '3' }, 'followup-weeks': { type: 'string', default: '5' }, 'practice-until-day': { type: 'string', default: '42' },
      instruments: { type: 'string', default: STUDY_INSTRUMENTS.join(',') }, 'measures-without-llm': { type: 'boolean', default: false },
      concurrency: { type: 'string', default: '3' }, work: { type: 'string', default: 'data/estudio/piloto.db' }, out: { type: 'string', default: 'data/estudio/piloto' }, resume: { type: 'boolean', default: false },
    },
  });
  // Comas o espacios: PowerShell convierte `a,b,c` sin comillas en una lista y la pasa separada por espacios.
  const list = (s: string | undefined) => (s ?? '').split(/[\s,]+/).filter(Boolean);
  const ids = list(v.citizens);
  if (ids.length === 0) throw new UsageError('indique las personas: --citizens CIT-000013,CIT-000107,…');
  const instruments = list(v.instruments) as InstrumentId[];
  for (const k of instruments) if (!INSTRUMENT_IDS.includes(k)) throw new UsageError(`instrumento desconocido: ${k} (hay ${INSTRUMENT_IDS.join(', ')})`);
  const maxTurns = toInt('max-turns', v['max-turns'], 1), hour = toInt('hour', v.hour, 0), practiceUntilDay = toInt('practice-until-day', v['practice-until-day'], 0);
  if (hour > 23) throw new UsageError('--hour debe estar entre 0 y 23');
  const minLevel = minLevelOf(v['min-level']);
  const stops = stopsOf(toInt('baseline-weeks', v['baseline-weeks'], 0), toInt('followup-weeks', v['followup-weeks'], 1));
  const concurrency = toInt('concurrency', v.concurrency, 1);
  const real = v.provider === 'config';
  const out = v.out!, work = v.work!, twin = work.replace(/(\.db)?$/, '-espera.db');
  const statePath = join(out, 'estado.json');
  const sessionFile = (id: string, n: number) => join(out, `${id}-s${n}`);
  const takeFile = (i: number) => join(out, `toma-${i + 1}.json`);
  mkdirSync(out, { recursive: true });
  // Cada respuesta del LLM queda en disco en cuanto llega: una sesión cortada se retoma en el turno en que iba, y un
  // piloto que hay que rehacer desde las copias no vuelve a pedir (ni a pagar) lo que ya se respondió.
  const gateway = gatewayFor(v.provider!, v['llm-config']!, io, join(out, 'llm-registro.jsonl'));

  let state: State = { at: 0 };
  const saveState = () => writeFileSync(statePath, `${JSON.stringify(state)}\n`);
  const saved: State | undefined = v.resume && existsSync(statePath) && existsSync(work) && existsSync(twin) ? (JSON.parse(readFileSync(statePath, 'utf8')) as State) : undefined;
  if (saved?.advancing) io.err('La ejecución anterior se cortó mientras avanzaba el mundo: se rehacen las copias. Las tomas, las sesiones y las respuestas guardadas se reutilizan.');
  if (saved && !saved.advancing) {
    state = saved;
    io.err(`Reanudando en la parada ${state.at + 1} de ${stops.length}`);
  } else {
    const w = loadWorld(v.db!).world;
    for (const id of ids) if (!w.citizens.has(id as EntityId)) throw new UsageError(`no existe ${id}`);
    io.err(`Copiando ${v.db} → ${work} y ${twin}`);
    copyWorld(v.db!, work);
    // La consulta es a una hora de consulta: las copias avanzan hasta la próxima `--hour` y todas las paradas caen ahí.
    const wait = (hour * 60 - (w.now % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    if (wait > 0) advanceWorld(work, wait);
    copyWorld(work, twin); // INV-002: los dos brazos arrancan del mismo estado
    saveState();
  }

  const sessions: Saved[] = [];
  const measures: Measure[] = [];
  try {
  for (const [i, stop] of stops.entries()) {
    if (i > state.at) {
      const prevStop = stops[i - 1]!;
      const held = prevStop.session ? sessions.filter((s) => s.meta.session === prevStop.session) : [];
      const daily = (k: number): StudyInput[] => {
        const day = prevStop.day + k;
        const todo: StudyInput[] = [];
        if (day >= 1 && day <= practiceUntilDay && !stops.some((s) => s.session && s.day === day))
          for (const id of ids) {
            const trials = practiceTrials(sessions, id);
            if (trials.yo + trials.extincion + trials.valores > 0) todo.push({ kind: 'protocol_practice', payload: { citizenId: id, trials } });
          }
        if (day === practiceUntilDay) for (const id of ids) todo.push({ kind: 'protocol_end', payload: { citizenId: id, reason: 'completo' } });
        return todo;
      };
      io.err(`Pasan ${stop.day - prevStop.day} días (hasta el día ${stop.day})…`);
      state = { at: state.at, advancing: true };
      saveState();
      const minutes = (stop.day - prevStop.day) * MINUTES_PER_DAY;
      advanceWorld(work, minutes, { atStart: held.flatMap(inputsOf), daily });
      advanceWorld(twin, minutes);
      state = { at: i };
      saveState();
    }

    let loaded: LoadedWorld | undefined;
    const world = () => (loaded ??= loadWorld(work));
    // Toma: con el LLM en el brazo del protocolo; en el de espera, lo que decide el motor (sin coste).
    if (v.resume && existsSync(takeFile(i))) measures.push(...(JSON.parse(readFileSync(takeFile(i), 'utf8')) as Measure[]));
    else {
      io.err(`Toma ${i + 1} de ${stops.length}: ${stop.label}`);
      const common = { ids, take: stop.take, label: stop.label, day: stop.day, instruments };
      const taken = [
        ...(await takeMeasures({ ...common, db: work, arm: TREATED, loaded: world(), ...(v['measures-without-llm'] ? {} : { gateway, strict: v.provider === 'config' }) })),
        ...(await takeMeasures({ ...common, db: twin, arm: WAITLIST })),
      ];
      writeFileSync(takeFile(i), `${JSON.stringify(taken)}\n`);
      measures.push(...taken);
    }

    if (!stop.session) continue;
    const n = stop.session;
    const kept = v.resume ? ids.filter((id) => existsSync(`${sessionFile(id, n)}.json`) && readSaved(`${sessionFile(id, n)}.json`).result.ended !== 'sin_llm') : [];
    for (const id of kept) sessions.push(readSaved(`${sessionFile(id, n)}.json`));
    const todo = ids.filter((id) => !kept.includes(id));
    if (todo.length === 0) continue;
    io.err(`Sesión ${n}: ${todo.map((id) => nameOf(world().world, id)).join(', ')}`);
    const held = await pool(todo, concurrency, async (id) => {
      const prev = sessions.filter((s) => s.meta.citizen === id).sort((a, b) => Number(b.meta.session) - Number(a.meta.session))[0];
      const base = { provider: v.provider!, citizenId: id, session: n, minLevel, ...(prev ? { prev } : {}) };
      const a = attendance(world(), id, n);
      const s = a.attends
        ? await holdSession(world(), { ...base, gateway, maxTurns, strict: real, onTurn: (turn, stance) => io.err(`  ${id} s${n} turno ${turn + 1}: ${stance ?? 'se fue'}`) })
        : noShow(world(), base, a.p);
      if (!a.attends) io.err(`  ${id} no fue a la sesión ${n} (probabilidad de asistir ${a.p.toFixed(2)})`);
      // Una sesión que el terapeuta no pudo terminar no se guarda: sus respuestas están en el registro y se retoma ahí.
      if (s.result.ended === 'sin_llm') throw new LlmUnavailable(`el LLM del terapeuta no respondió con ${id} en la sesión ${n} (${s.result.detail ?? 'sin detalle'})`);
      saveSession(s, sessionFile(id, n));
      return s;
    });
    sessions.push(...held);
  }
  } catch (e) {
    if (e instanceof UsageError) throw e;
    throw new Error(`${(e as Error).message}. Lo hecho quedó guardado: repita el mismo comando con --resume (puede cambiar las claves antes)`, { cause: e });
  }

  const order = (s: Saved) => `${s.meta.citizen}-${s.meta.session}`;
  sessions.sort((a, b) => (order(a) < order(b) ? -1 : 1));
  const data: PilotData = { citizens: ids, instruments, stops, practiceUntilDay, sessions, measures };
  writeFileSync(join(out, 'resumen.md'), summaryOf(data));
  writeFileSync(join(out, 'medidas.csv'), csvOf(data));
  writeFileSync(join(out, 'resultados.json'), `${JSON.stringify({ ...data, sessions: sessions.map((s) => ({ ...s.meta, ...s.result, ...doseOf(s), usage: s.usage })), usage: totalUsage(data) }, null, 2)}\n`);
  const noShows = sessions.filter((s) => s.result.ended === NO_SHOW).length;
  io.out(`Piloto: ${ids.length} personas · ${stops.length} tomas · ${sessions.length - noShows} sesiones${noShows ? ` (${noShows} inasistencias)` : ''} · coste ${usdOf(totalUsage(data)).toFixed(4)} USD`);
  io.out(`Resultados: ${join(out, 'resumen.md')} · medidas: ${join(out, 'medidas.csv')} · transcripciones: ${out}`);
}
