// Lo que pasa en el mundo entre dos paradas del estudio (spec 047 R-003, R-004, R-006) y la sensibilidad a la dosis
// (R-009): las mismas sesiones ya guardadas, aplicadas con otra escala de dosis sobre copias nuevas del mundo. No llama
// al LLM: el diálogo ya ocurrió; lo que cambia es cuánto pesa cada ensayo en el motor.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ACT_PNR_3, MINUTES_PER_DAY } from '@datas-world/engine';
import type { Dose, InstrumentId } from '@datas-world/engine';
import { DEFAULT_DB, UsageError, toInt } from './common.ts';
import type { Io } from './common.ts';
import { copyWorld } from './psychometrics.ts';
import { advanceWorld, inputsOf, loadWorld, readSaved } from './study-core.ts';
import type { AdvanceOptions, Saved, StudyInput } from './study-core.ts';
import { takeMeasures } from './study-measure.ts';
import type { Measure } from './study-measure.ts';
import { doseOf } from './study-report.ts';
import type { PilotData, Stop } from './study-report.ts';

const DOSE_KEYS = ['yo', 'extincion', 'valores'] as const;

/** Ensayos de una práctica: uno por cada mecanismo que sus sesiones ya trabajaron con ella presente (R-004). */
function practiceTrials(sessions: readonly Saved[], id: string): Dose {
  const t: Dose = { yo: 0, extincion: 0, valores: 0 };
  for (const s of sessions) if (s.meta.citizen === id) for (const k of DOSE_KEYS) if (doseOf(s).dose[k] > 0) t[k] = 1;
  return t;
}

/**
 * El tramo que lleva a la parada `i`: al empezar entran las sesiones de la parada anterior (charla y dosis); cada día
 * del periodo de práctica, la práctica de quien ya tiene algo que practicar; y el último día de práctica, el cierre.
 * `sessions` son las sesiones hechas hasta la parada anterior. `scale` multiplica la dosis de las sesiones.
 */
export function segmentOf(stops: readonly Stop[], i: number, sessions: readonly Saved[], ids: readonly string[], practiceUntilDay: number, scale = 1): { minutes: number; options: AdvanceOptions } {
  const prev = stops[i - 1]!, stop = stops[i]!;
  const held = prev.session ? sessions.filter((s) => s.meta.session === prev.session) : [];
  const daily = (k: number): StudyInput[] => {
    const day = prev.day + k;
    const todo: StudyInput[] = [];
    if (scale > 0 && day >= 1 && day <= practiceUntilDay && !stops.some((s) => s.session && s.day === day))
      for (const id of ids) {
        const trials = practiceTrials(sessions, id);
        if (trials.yo + trials.extincion + trials.valores > 0) todo.push({ kind: 'protocol_practice', payload: { citizenId: id, trials } });
      }
    if (day === practiceUntilDay) for (const id of ids) todo.push({ kind: 'protocol_end', payload: { citizenId: id, reason: 'completo' } });
    return todo;
  };
  return { minutes: (stop.day - prev.day) * MINUTES_PER_DAY, options: { atStart: held.flatMap((s) => inputsOf(s, scale)), daily } };
}

const f2 = (x: number | undefined) => (x === undefined ? '—' : x.toFixed(2));

/**
 * `pnpm cli study:sensitivity --out CARPETA --db BASE [--scales 0,0.5,1,2]`: repite el piloto de esa carpeta con otras
 * escalas de dosis. Escala 0 deja solo la charla (la persona fue y habló, pero ningún ejercicio cuenta): sirve de
 * control de atención. Mide lo verdadero en cada parada, sin LLM.
 */
export async function studySensitivity(args: string[], io: Io): Promise<void> {
  const { values: v } = parseArgs({
    args,
    options: { db: { type: 'string', default: DEFAULT_DB }, out: { type: 'string', default: 'data/estudio/piloto' }, scales: { type: 'string', default: '0,0.5,1,2' }, work: { type: 'string', default: 'data/estudio/sensibilidad.db' } },
  });
  const out = v.out!;
  if (!existsSync(join(out, 'resultados.json'))) throw new UsageError(`no hay un piloto terminado en ${out} (falta resultados.json)`);
  const pilot = JSON.parse(readFileSync(join(out, 'resultados.json'), 'utf8')) as Pick<PilotData, 'citizens' | 'instruments' | 'stops' | 'practiceUntilDay' | 'measures'>;
  const scales = v.scales!.split(/[\s,]+/).filter(Boolean).map(Number);
  if (scales.length === 0 || scales.some((s) => !Number.isFinite(s) || s < 0 || s > 4)) throw new UsageError('--scales debe ser una lista de números entre 0 y 4, como 0,0.5,1,2');
  const { citizens: ids, stops, practiceUntilDay } = pilot;
  const sessions = ids.flatMap((id) => ACT_PNR_3.sessions.flatMap((s) => (existsSync(join(out, `${id}-s${s.n}.json`)) ? [readSaved(join(out, `${id}-s${s.n}.json`))] : [])));
  if (sessions.length === 0) throw new UsageError(`no hay sesiones guardadas en ${out}`);
  // La misma hora de consulta del piloto, para que el mundo de partida sea el mismo.
  const first = pilot.measures.find((m) => m.take === 0);
  const hour = first ? toInt('hora', first.date.slice(11, 13), 0) : 10;
  const world = loadWorld(v.db!).world;
  if (first && world.id !== undefined && sessions[0]!.meta.world !== world.id) throw new UsageError(`${v.db} no es el mundo del piloto de ${out}`);
  const wait = (hour * 60 - (world.now % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

  const runs: { scale: number; measures: Measure[] }[] = [];
  for (const scale of scales) {
    io.err(`Escala de dosis ${scale}: copiando el mundo…`);
    copyWorld(v.db!, v.work!);
    if (wait > 0) advanceWorld(v.work!, wait);
    const measures: Measure[] = [];
    for (const [i, stop] of stops.entries()) {
      if (i > 0) {
        const done = sessions.filter((s) => Number(s.meta.session) <= Math.max(0, ...stops.slice(0, i).map((x) => x.session ?? 0)));
        const seg = segmentOf(stops, i, done, ids, practiceUntilDay, scale);
        advanceWorld(v.work!, seg.minutes, seg.options);
      }
      measures.push(...(await takeMeasures({ db: v.work!, ids, arm: `dosis×${scale}`, take: stop.take, label: stop.label, day: stop.day, instruments: pilot.instruments as InstrumentId[] })));
      io.err(`  escala ${scale}: toma ${i + 1} de ${stops.length}`);
    }
    runs.push({ scale, measures });
  }

  const last = stops.at(-1)!.take;
  const name = (id: string) => String(sessions.find((s) => s.meta.citizen === id)?.meta.name ?? id);
  const lines = [
    '# Sensibilidad a la dosis', '',
    '> Las mismas sesiones del piloto, con cada ensayo de sesión contando más o menos en el motor. Escala 0: la persona fue y habló, pero ningún ejercicio cuenta (control de atención). Todo es lo verdadero, sin LLM. Con personas simuladas: dice cuánto depende el resultado de un supuesto del modelo, no del protocolo.', '',
    `Mundo: ${v.db}. Toma comparada: ${stops.at(-1)!.label} (día ${stops.at(-1)!.day}). La práctica diaria no se escala: es medio ensayo por día en todas las columnas salvo la de escala 0, donde no hay nada que practicar.`, '',
  ];
  for (const id of ids) {
    lines.push(`## ${name(id)} (${id})`, '', `| Medida | Línea base | ${scales.map((s) => `Dosis ×${s}`).join(' | ')} |`, `|---|---|${scales.map(() => '---').join('|')}|`);
    const at = (run: { measures: Measure[] }, take: number) => run.measures.find((m) => m.citizenId === id && m.take === take);
    const base = at(runs[0]!, 0);
    const row = (label: string, pick: (m: Measure | undefined) => string) => lines.push(`| ${label} | ${pick(base)} | ${runs.map((r) => pick(at(r, last))).join(' | ')} |`);
    row('Tomar distancia («Yo»)', (m) => f2(m?.mechanisms?.selfFraming));
    row('Evitación', (m) => f2(m?.mechanisms?.avoidance));
    row('Valores', (m) => f2(m?.mechanisms?.valueImportance));
    for (const k of pilot.instruments) row(`${k} verdadero`, (m) => String(m?.instruments[k]?.truthful ?? '—'));
    row('Días de práctica', (m) => String(m?.practices ?? '—'));
    lines.push('');
  }
  writeFileSync(join(out, 'sensibilidad.md'), lines.join('\n'));
  writeFileSync(join(out, 'sensibilidad.json'), `${JSON.stringify({ scales, runs }, null, 2)}\n`);
  io.out(`Sensibilidad: ${scales.length} escalas × ${ids.length} personas → ${join(out, 'sensibilidad.md')}`);
}
