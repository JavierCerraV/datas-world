// Informe del piloto (spec 047 R-008, R-009, R-011, R-012): por persona, cada medida en cada toma (lo dicho, lo que
// decidió el motor, lo verdadero y lo verdadero en el brazo de espera), los mecanismos que el protocolo mueve, las
// sesiones con su dosis y su coste, la práctica y los episodios de rumia. Descriptivo: con tres personas no hay contrastes.
import { ACT_PNR_3, sessionDose, sessionOf } from '@datas-world/engine';
import type { SessionNumber } from '@datas-world/engine';
import { complacencyOf, therapistQuality } from '@datas-world/llm-gateway';
import { NO_SHOW, addUsage, usageTable, usdOf } from './study-core.ts';
import type { Saved, UsageByPurpose } from './study-core.ts';
import type { Measure } from './study-measure.ts';

/** Componentes con mecanismo propio (047 R-004): los ejercicios. */
const EXERCISES: ReadonlySet<string> = new Set(ACT_PNR_3.sessions.flatMap((s) => s.components.filter((c) => c.mechanism === 'yo' || c.mechanism === 'extincion' || c.mechanism === 'valores').map((c) => c.id)));

export const TREATED = 'protocolo';
export const WAITLIST = 'espera';

export interface Stop {
  take: number;
  label: string;
  day: number;
  phase: 'línea base' | 'tratamiento' | 'seguimiento';
  session?: number;
}

export interface PilotData {
  citizens: string[];
  instruments: string[];
  stops: Stop[];
  practiceUntilDay: number;
  sessions: Saved[];
  measures: Measure[];
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);
const f1 = (x: number) => (Number.isFinite(x) ? (Math.round(x * 10) / 10).toFixed(1) : '—');
const f2 = (x: number | undefined) => (x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(2));
const signed = (x: number) => (Number.isFinite(x) ? `${x > 0 ? '+' : ''}${f1(x)}` : '—');

/** Lo que el motor contó de una sesión: el mismo cálculo que hace al aplicarla (047 R-004). */
export function doseOf(s: Saved) {
  if (s.result.ended === NO_SHOW) return { dose: { yo: 0, extincion: 0, valores: 0 }, engagement: 0 };
  const exchanges = s.transcript.filter((t) => t.speaker === 'persona' && t.stance).map((t) => ({ component: t.section, stance: t.stance! }));
  return sessionDose(sessionOf(ACT_PNR_3, Number(s.meta.session) as SessionNumber), exchanges);
}

export const totalUsage = (d: PilotData): UsageByPurpose => addUsage([...d.sessions.map((s) => s.usage ?? {}), ...d.measures.map((m) => m.usage)]);

const LIMITS = [
  'Piloto con personas simuladas: muestra si el mundo responde en la dirección esperada, no si el protocolo funciona en humanos (047 R-011).',
  'El efecto verdadero sale de supuestos del modelo: cada intercambio de la sesión en que la persona estuvo presente es un ensayo de aprendizaje sobre el enmarque con «Yo», la evitación o sus valores. Los parámetros no se ajustaron para que saliera un efecto.',
  'El AAQ-II lee directamente esos mecanismos, así que su cambio verdadero está en parte garantizado por construcción. El DASS-21 y el SWLS solo cambian si cambia la vida de la persona (ánimo, estrés, episodios).',
  'Lo que no está garantizado y sí es resultado: cuánto se compromete cada persona (lo decide su postura), si practica, cómo terminan sus episodios de rumia después, y la brecha entre lo que dice y lo verdadero.',
  'Con tres personas el análisis es descriptivo. El brazo de espera son las mismas personas en una copia del mundo sin sesiones: tras la primera sesión las dos copias se separan también por azar, no solo por el protocolo.',
  'El terapeuta no conoce ninguna medida ni la postura de la persona; las medidas las toma una evaluadora aparte.',
];

export function csvOf(d: PilotData): string {
  const rows = ['persona,brazo,toma,etiqueta,dia,fecha,instrumento,dicho,decidido_motor,verdadero,modo,yo_enmarque,evitacion,valores,pnr_reciente,animo,estres,practicas'];
  for (const m of d.measures)
    for (const k of d.instruments) {
      const r = m.instruments[k];
      const x = m.mechanisms;
      rows.push([m.citizenId, m.arm, m.take, m.label, m.day, m.date, k, r?.said ?? '', r?.target ?? '', r?.truthful ?? '', m.mode, x?.selfFraming ?? '', x?.avoidance ?? '', x?.valueImportance ?? '', x?.pnrRecent ?? '', x?.mood ?? '', x?.stress ?? '', m.practices].join(','));
    }
  return `${rows.join('\n')}\n`;
}

export function summaryOf(d: PilotData): string {
  const at = (id: string, arm: string, take: number) => d.measures.find((m) => m.citizenId === id && m.arm === arm && m.take === take);
  const nameOf = (id: string) => String(d.sessions.find((s) => s.meta.citizen === id)?.meta.name ?? id);
  const lines = ['# Piloto del protocolo · resultados', '', '## Qué es y qué no', '', ...LIMITS.map((l) => `- ${l}`), ''];

  lines.push('## Calendario', '', '| Toma | Momento | Día | Fase | Sesión |', '|---|---|---|---|---|');
  for (const s of d.stops) lines.push(`| ${s.take + 1} | ${s.label} | ${s.day} | ${s.phase} | ${s.session ?? '—'} |`);
  lines.push('', `Práctica diaria con audios hasta el día ${d.practiceUntilDay}. Cada toma del día de una sesión se hace antes de la sesión.`, '');

  lines.push('## Sesiones', '', '| Persona | Sesión | Fecha | Final | Turnos | Fidelidad | Compromiso | Ensayos «Yo» / evitación / valores | Tokens entrada | Tokens salida | Coste (USD) |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const s of d.sessions) {
    const { dose, engagement } = doseOf(s);
    const u = Object.values(s.usage ?? {});
    const inTok = u.reduce((a, m) => a + m.inputTokens + m.cachedTokens + m.cacheWriteTokens, 0), outTok = u.reduce((a, m) => a + m.outputTokens, 0);
    lines.push(`| ${s.meta.name} | ${s.meta.session} | ${s.meta.date} | ${s.result.ended} | ${s.result.therapistTurns} | ${Math.round(s.result.fidelity * 100)} % | ${f2(engagement)} | ${dose.yo} / ${dose.extincion} / ${dose.valores} | ${inTok} | ${outTok} | ${usdOf(s.usage ?? {}).toFixed(4)} |`);
  }
  lines.push('', 'Compromiso: media de cuánto estuvo presente la persona según la postura que el motor le eligió en cada turno (abrirse 1; responder breve 0,5; aplacar 0,25; evadir, callar, contraatacar o poner límite 0). Los ensayos son la dosis que el motor aplicó.', '');

  // R-008: la complacencia, por tres caminos. El de las pruebas solo es posible porque el mundo conoce lo verdadero.
  const pct = (a: number, b: number) => (b === 0 ? '—' : `${Math.round((100 * a) / b)} %`);
  lines.push('## Complacencia en las sesiones', '', '| Persona | Sesión | Turnos | Aplacar (lo decidió el motor) | El texto acepta, promete o elogia | Con postura cerrada | De esas, el texto complace igual | Respuestas largas con postura de callar |', '|---|---|---|---|---|---|---|---|');
  for (const s of d.sessions.filter((x) => x.result.ended !== NO_SHOW)) {
    const c = complacencyOf(s.transcript);
    lines.push(`| ${s.meta.name} | ${s.meta.session} | ${c.turns} | ${c.placating} (${pct(c.placating, c.turns)}) | ${c.agreeing} (${pct(c.agreeing, c.turns)}) | ${c.closed} | ${c.agreeingWhileClosed} (${pct(c.agreeingWhileClosed, c.closed)}) | ${c.talkativeSilence} |`);
  }
  lines.push('', 'Reglas léxicas, burdas: sirven para comparar sesiones, no para juzgar un turno. «Postura cerrada» es evadir, callar, contraatacar, poner un límite o irse. Las dos últimas columnas muestran dónde el texto del LLM fue más dócil o más hablador que la persona que el motor había decidido.', '');

  // R-005f: lo que el piloto mostró que el terapeuta hacía mal, contado igual en cada corrida para poder comparar.
  lines.push('## Calidad del terapeuta', '', '| Persona | Sesión | Turnos | Tutea | Dos preguntas en un turno | Repite una pregunta | Elogia con fórmula | Turnos de ejercicio | El verificador: el texto de la persona no siguió su postura | Silencios acortados |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const s of d.sessions.filter((x) => x.result.ended !== NO_SHOW)) {
    const q = therapistQuality(s.transcript);
    const exercises = s.transcript.filter((t) => t.speaker === 'terapeuta' && EXERCISES.has(t.section)).length;
    const checked = s.patient.filter((p) => p.stanceCheck !== 'unchecked');
    lines.push(`| ${s.meta.name} | ${s.meta.session} | ${q.turns} | ${q.informal} | ${q.doubleQuestions} | ${q.repeats} | ${q.praise} | ${exercises} (${pct(exercises, q.turns)}) | ${checked.length ? `${checked.filter((p) => p.stanceCheck === 'mismatch').length} de ${checked.length}` : 'sin verificar'} | ${s.patient.filter((p) => p.trimmed).length} |`);
  }
  lines.push('', 'Reglas léxicas. «Turnos de ejercicio» son los que trabajaron un componente con mecanismo propio (tomar distancia, dejar de empujar, valores): de ellos sale la dosis.', '');

  lines.push('## Brecha de informe (lo dicho menos lo verdadero)', '', '| Prueba | Línea base | Tratamiento | Seguimiento | Lo dicho menos lo decidido por el motor (todas las tomas) |', '|---|---|---|---|---|');
  for (const k of d.instruments) {
    const gaps = (p: Stop['phase'], f: (r: { said: number; target: number; truthful: number }) => number) =>
      mean(d.stops.filter((s) => s.phase === p).flatMap((s) => d.citizens.flatMap((id) => { const r = at(id, TREATED, s.take)?.instruments[k]; return r ? [f(r)] : []; })));
    const drift = mean(d.stops.flatMap((s) => d.citizens.flatMap((id) => { const r = at(id, TREATED, s.take)?.instruments[k]; return r ? [r.said - r.target] : []; })));
    const g = (p: Stop['phase']) => signed(gaps(p, (r) => r.said - r.truthful));
    lines.push(`| ${k} | ${g('línea base')} | ${g('tratamiento')} | ${g('seguimiento')} | ${signed(drift)} |`);
  }
  lines.push('', 'Media de las personas del brazo con protocolo. La última columna es lo que el LLM se apartó de lo que el motor había decidido que la persona diría (puede moverse un punto por ítem): si crece tras el tratamiento, es el modelo y no la persona quien «mejora».', '');

  for (const id of d.citizens) {
    lines.push(`## ${nameOf(id)} (${id})`, '');
    for (const k of d.instruments) {
      lines.push(`### ${k}`, '', '| Toma | Momento | Fase | Dicho | Decidido por el motor | Verdadero | Verdadero en espera | Brecha (dicho − verdadero) |', '|---|---|---|---|---|---|---|---|');
      for (const s of d.stops) {
        const t = at(id, TREATED, s.take)?.instruments[k], w = at(id, WAITLIST, s.take)?.instruments[k];
        lines.push(`| ${s.take + 1} | ${s.label} | ${s.phase} | ${t?.said ?? '—'} | ${t?.target ?? '—'} | ${t?.truthful ?? '—'} | ${w?.truthful ?? '—'} | ${t ? signed(t.said - t.truthful) : '—'} |`);
      }
      const phase = (p: Stop['phase'], arm: string, field: 'said' | 'truthful') => mean(d.stops.filter((s) => s.phase === p).flatMap((s) => at(id, arm, s.take)?.instruments[k]?.[field] ?? []));
      const change = (arm: string, field: 'said' | 'truthful') => phase('seguimiento', arm, field) - phase('línea base', arm, field);
      lines.push('', `Media de línea base → seguimiento: dicho ${f1(phase('línea base', TREATED, 'said'))} → ${f1(phase('seguimiento', TREATED, 'said'))} (${signed(change(TREATED, 'said'))}); verdadero ${f1(phase('línea base', TREATED, 'truthful'))} → ${f1(phase('seguimiento', TREATED, 'truthful'))} (${signed(change(TREATED, 'truthful'))}); verdadero en espera ${signed(change(WAITLIST, 'truthful'))}.`, '');
    }
    lines.push('### Mecanismos del motor', '', '| Toma | Momento | «Yo» (protocolo / espera) | Evitación | Valores | Rumia reciente | Ánimo | Estrés | Prácticas hechas |', '|---|---|---|---|---|---|---|---|---|');
    for (const s of d.stops) {
      const t = at(id, TREATED, s.take), w = at(id, WAITLIST, s.take);
      const pair = (k: 'selfFraming' | 'avoidance' | 'valueImportance' | 'pnrRecent' | 'mood' | 'stress') => `${f2(t?.mechanisms?.[k])} / ${f2(w?.mechanisms?.[k])}`;
      lines.push(`| ${s.take + 1} | ${s.label} | ${pair('selfFraming')} | ${pair('avoidance')} | ${pair('valueImportance')} | ${pair('pnrRecent')} | ${pair('mood')} | ${pair('stress')} | ${t?.practices ?? '—'} |`);
    }
    // Las pruebas en el mundo (R-012): sus episodios de rumia desde la primera toma, por fase y cómo terminaron.
    const first = d.stops[0], s1 = d.stops.find((s) => s.session === 1), last = d.stops.at(-1);
    lines.push('', '### Episodios de rumia en su vida', '', '| Brazo | Fase | Episodios | Terminó tomando distancia («yo») | Evitando | Se le pasó | Tope | Minutos en total |', '|---|---|---|---|---|---|---|---|');
    for (const arm of [TREATED, WAITLIST]) {
      const end = last ? at(id, arm, last.take) : undefined;
      const t0 = first ? at(id, arm, first.take)?.minute : undefined, t1 = s1 ? at(id, arm, s1.take)?.minute : undefined;
      if (!end || t0 === undefined || t1 === undefined) continue;
      for (const [label, from, to] of [['línea base', t0, t1], ['desde la sesión 1', t1, end.minute + 1]] as const) {
        const eps = end.episodes.filter((e) => e.at >= from && e.at < to);
        const n = (how: string) => eps.filter((e) => e.ended === how).length;
        lines.push(`| ${arm} | ${label} | ${eps.length} | ${n('yo')} | ${n('evitacion')} | ${n('bajo')} | ${n('tope')} | ${eps.reduce((a, e) => a + e.minutes, 0)} |`);
      }
    }
    lines.push('');
  }

  lines.push('## Uso del LLM y coste', '', ...usageTable(totalUsage(d)), '', 'Suma de todas las sesiones y tomas guardadas, también las de ejecuciones anteriores reanudadas.', '');
  return lines.join('\n');
}
