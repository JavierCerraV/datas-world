// Informe de la batería psicométrica (spec 045 R-007, R-010): estadísticos, correlaciones y libro de Excel.
import { INSTRUMENTS, INSTRUMENT_IDS } from '@datas-world/engine';
import type { Disposition, Indicators, InstrumentId, Score } from '@datas-world/engine';
import { buildXlsx } from './xlsx.ts';
import type { Cell, Sheet } from './xlsx.ts';

export interface ItemRecord {
  n: number;
  truthful: number;
  p: number;
  disposition: Disposition;
  target: number;
  reported: number;
  reply: string;
  source: 'llm' | 'corregida' | 'plantilla';
}

export interface InstrumentRecord {
  items: ItemRecord[];
  reported: Score;
  truthful: Score;
}

export interface TakeRecord {
  citizenId: string;
  toma: 0 | 1 | 2;
  alive: boolean;
  indicators?: Indicators;
  instruments?: Record<InstrumentId, InstrumentRecord>;
}

export interface ParticipantRow {
  id: string;
  name: string;
  sex: string;
  age: number;
  stratum: string;
  occupation: string;
}

export interface TomaInfo {
  toma: 0 | 1 | 2;
  minute: number;
  date: string;
  hash: string;
}

export interface EventCount {
  citizenId: string;
  interval: string;
  type: string;
  count: number;
}

export interface Battery {
  meta: { world: string; seed: number; provider: string; nSample: number; generatedFor: string };
  participants: ParticipantRow[];
  tomas: TomaInfo[];
  takes: TakeRecord[];
  events: EventCount[];
}

const r2 = (x: number) => Math.round(x * 100) / 100;
export const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);
export const sd = (xs: readonly number[]) => {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};
export function corr(a: readonly number[], b: readonly number[]): number {
  const ma = mean(a), mb = mean(b);
  let sab = 0, saa = 0, sbb = 0;
  a.forEach((x, i) => {
    sab += (x - ma) * (b[i]! - mb);
    saa += (x - ma) ** 2;
    sbb += (b[i]! - mb) ** 2;
  });
  return saa === 0 || sbb === 0 ? NaN : sab / Math.sqrt(saa * sbb);
}

/** Medidas con su nombre: totales de cada instrumento y las tres subescalas del DASS-21. */
export const MEASURES: readonly { key: string; label: string; of: (s: Score) => number; over: (v: number) => boolean; overLabel: string }[] = [
  { key: 'AAQ-II', label: 'AAQ-II', of: (s) => s.total, over: (v) => v > 29, overLabel: '> 29 (clínico)' },
  { key: 'GHQ-12', label: 'GHQ-12', of: (s) => s.total, over: (v) => v >= 12, overLabel: '≥ 12 (posible trastorno)' },
  { key: 'GPQ-9', label: 'GPQ-9', of: (s) => s.total, over: (v) => v > 27, overLabel: '> 27 (clínico)' },
  { key: 'GTQ', label: 'GTQ', of: (s) => s.total, over: (v) => v <= 52, overLabel: '≤ 52 (más cerca del promedio clínico)' },
  { key: 'DASS-21', label: 'DASS-21 total', of: (s) => s.total, over: () => false, overLabel: '—' },
  { key: 'DASS-21', label: 'DASS-21 depresión', of: (s) => s.subscales?.depresion ?? NaN, over: (v) => v >= 5, overLabel: '≥ 5 (leve o más)' },
  { key: 'DASS-21', label: 'DASS-21 ansiedad', of: (s) => s.subscales?.ansiedad ?? NaN, over: (v) => v >= 4, overLabel: '≥ 4 (leve o más)' },
  { key: 'DASS-21', label: 'DASS-21 estrés', of: (s) => s.subscales?.estres ?? NaN, over: (v) => v >= 8, overLabel: '≥ 8 (leve o más)' },
  { key: 'SWLS', label: 'SWLS', of: (s) => s.total, over: (v) => v <= 14, overLabel: '≤ 14 (insatisfecho)' },
];

const valuesOf = (b: Battery, toma: number, m: (typeof MEASURES)[number], which: 'reported' | 'truthful') =>
  b.takes.filter((t) => t.toma === toma && t.instruments).map((t) => m.of(t.instruments![m.key as InstrumentId][which]));

/** R-010: signo esperado de las correlaciones entre instrumentos (+1 / −1), por pares de totales. */
const EXPECTED: readonly [string, string, 1 | -1][] = [
  ['AAQ-II', 'GHQ-12', 1], ['AAQ-II', 'DASS-21 total', 1], ['GHQ-12', 'DASS-21 total', 1], ['AAQ-II', 'GPQ-9', 1], ['GHQ-12', 'GPQ-9', 1], ['DASS-21 total', 'GPQ-9', 1],
  ['SWLS', 'AAQ-II', -1], ['SWLS', 'GHQ-12', -1], ['SWLS', 'DASS-21 total', -1],
];

export function sanity(b: Battery): { toma: number; a: string; b: string; r: number; expected: string; ok: boolean }[] {
  const out: ReturnType<typeof sanity> = [];
  for (const toma of [0, 1, 2]) {
    for (const [a, c, sign] of EXPECTED) {
      const ma = MEASURES.find((m) => m.label === a)!, mc = MEASURES.find((m) => m.label === c)!;
      const r = corr(valuesOf(b, toma, ma, 'reported'), valuesOf(b, toma, mc, 'reported'));
      out.push({ toma, a, b: c, r, expected: sign > 0 ? 'positiva' : 'negativa', ok: Number.isFinite(r) && r * sign > 0 });
    }
  }
  return out;
}

const date = (b: Battery, toma: number) => b.tomas.find((t) => t.toma === toma)?.date ?? '';
const nameOf = (b: Battery, id: string) => b.participants.find((p) => p.id === id)?.name ?? id;
const TOMA_LABEL = ['Toma 0 (hoy)', 'Toma 1 (+30 días)', 'Toma 2 (+1 año)'];

function sheetMethod(b: Battery): Sheet {
  const llm = b.takes.flatMap((t) => (t.instruments ? INSTRUMENT_IDS.flatMap((i) => t.instruments![i].items) : []));
  const count = (s: ItemRecord['source']) => llm.filter((x) => x.source === s).length;
  const disp = (d: Disposition) => llm.filter((x) => x.disposition === d).length;
  const rows: Cell[][] = [
    ['Tema', 'Detalle'],
    ['Qué es', "Batería psicométrica aplicada a personas simuladas de Data's World (spec 045). Instrumentos del ClinikLab de la Universidad Konrad Lorenz: AAQ-II, GHQ-12, GPQ-9, GTQ, DASS-21 y SWLS."],
    ['Mundo', `${b.meta.world} · semilla ${b.meta.seed}. Se trabajó sobre una copia de la base: el mundo en marcha no se tocó.`],
    ['Muestra', `${b.meta.nSample} personas de 18 años o más y vivas en la toma 0, estratificadas por sexo y grupo de edad (18–29, 30–44, 45–59, 60 o más), con asignación proporcional y una persona como mínimo por estrato. Son las mismas en las tres tomas.`],
    ...b.tomas.map((t) => [TOMA_LABEL[t.toma]!, `${t.date} (minuto ${t.minute}) · hash del estado ${t.hash}`] as Cell[]),
    ['Cómo responde cada persona', 'El motor calcula la respuesta VERDADERA de cada ítem desde su estado actual, su historia (informe de vida y trayectoria de 30 días), su aprendizaje (evitación, episodios de pensamiento negativo repetitivo, enmarque con «Yo», reglas pliance/tracking, flexibilidad) y sus valores (importancia frente a contacto). No usa el temperamento.'],
    ['Lo verdadero y lo que dice', 'Según su historia de aprendizaje, la persona puede decir su estado tal cual (fiel), decir menos malestar (minimiza), más (exagera), algo muy alejado (miente) o no tactarlo bien (impreciso). El motor decide cuánto se desvía de lo verdadero; las probabilidades salen de la vergüenza, el valor de la aprobación, la evitación, el pliance, la carga aversiva, la soledad, la flexibilidad y la confianza en quien pregunta (un extraño).'],
    ['Quién escribe la respuesta', `El LLM (${b.meta.provider}) interpreta cada ítem como en una charla y elige la opción dentro de ±1 punto de lo que el motor decidió; si se sale del rango, el motor usa la decidida. Ítems: ${llm.length}. Con LLM: ${count('llm')}. Corregidos por el motor: ${count('corregida')}. Con plantilla (sin LLM): ${count('plantilla')}.`],
    ['Disposiciones (ítems)', `fiel ${disp('fiel')} · minimiza ${disp('minimiza')} · exagera ${disp('exagera')} · miente ${disp('miente')} · impreciso ${disp('impreciso')}`],
    ['LÍMITES (leer antes de usar)', 'Estas puntuaciones NO son datos humanos. Son la salida de un modelo [M] de cómo el estado de una persona simulada se refleja en cada escala. Los pesos de los indicadores y las probabilidades de distorsión son supuestos sin validar con poblaciones reales (PA-155). Sirven para ver si el mundo produce perfiles coherentes y cómo cambian entre tomas, no para validar el modelo ni para inferir sobre personas reales.'],
    ['Corte de las fichas', 'Los cortes son los de la ficha de cada prueba. En el GTQ la ficha solo da dos promedios (clínicos 48, no clínicos 58): el corte 52/53 es el punto medio, no un corte de la ficha. En el DASS-21 se usan las sumas crudas por subescala con los cortes de la ficha.'],
    ['Toma 2', 'Un año después de la toma 1 (13 meses desde hoy).'],
    ['Para repetir', 'pnpm cli psychometrics --provider config  (usa config/llm.json y ANTHROPIC_API_KEY; con --provider mock es determinista y sin red).'],
  ];
  return { name: 'Método y límites', rows, widths: [28, 140] };
}

function sheetScores(b: Battery): Sheet {
  const head = ['ID', 'Nombre', 'Toma', 'Fecha', ...MEASURES.map((m) => m.label), 'AAQ-II banda', 'GHQ-12 banda', 'GPQ-9 banda', 'GTQ banda', 'DASS depresión', 'DASS ansiedad', 'DASS estrés', 'SWLS banda'];
  const rows: Cell[][] = [head];
  for (const t of b.takes) {
    if (!t.instruments) continue;
    const I = t.instruments;
    rows.push([
      t.citizenId, nameOf(b, t.citizenId), TOMA_LABEL[t.toma], date(b, t.toma), ...MEASURES.map((m) => m.of(I[m.key as InstrumentId].reported)),
      I['AAQ-II'].reported.band, I['GHQ-12'].reported.band, I['GPQ-9'].reported.band, I.GTQ.reported.band,
      I['DASS-21'].reported.bands?.depresion, I['DASS-21'].reported.bands?.ansiedad, I['DASS-21'].reported.bands?.estres, I.SWLS.reported.band,
    ]);
  }
  return { name: 'Puntajes', rows, widths: [12, 28, 18, 12, ...MEASURES.map(() => 12), 30, 30, 30, 34, 26, 26, 26, 28] };
}

function sheetSaidVsTrue(b: Battery): Sheet {
  const rows: Cell[][] = [['ID', 'Nombre', 'Toma', 'Instrumento', 'Total dicho', 'Total verdadero', 'Diferencia', 'Ítems no fieles', 'Minimiza', 'Exagera', 'Miente', 'Impreciso']];
  for (const t of b.takes) {
    if (!t.instruments) continue;
    for (const id of INSTRUMENT_IDS) {
      const r = t.instruments[id];
      const n = (d: Disposition) => r.items.filter((x) => x.disposition === d).length;
      rows.push([t.citizenId, nameOf(b, t.citizenId), TOMA_LABEL[t.toma], id, r.reported.total, r.truthful.total, r.reported.total - r.truthful.total, r.items.length - n('fiel'), n('minimiza'), n('exagera'), n('miente'), n('impreciso')]);
    }
  }
  return { name: 'Dicho vs verdadero', rows, widths: [12, 28, 18, 12, 12, 14, 12, 14, 10, 10, 10, 10] };
}

function sheetChanges(b: Battery): Sheet {
  const rows: Cell[][] = [['ID', 'Nombre', 'Medida', 'Toma 0', 'Toma 1', 'Toma 2', 'Δ 1 − 0', 'Δ 2 − 1', 'Δ 2 − 0']];
  for (const p of b.participants) {
    for (const m of MEASURES) {
      const v = [0, 1, 2].map((toma) => {
        const t = b.takes.find((x) => x.citizenId === p.id && x.toma === toma);
        return t?.instruments ? m.of(t.instruments[m.key as InstrumentId].reported) : null;
      });
      const d = (a: number | null, c: number | null) => (a === null || c === null ? null : c - a);
      rows.push([p.id, p.name, m.label, v[0], v[1], v[2], d(v[0]!, v[1]!), d(v[1]!, v[2]!), d(v[0]!, v[2]!)]);
    }
  }
  return { name: 'Cambios', rows, widths: [12, 28, 20, 10, 10, 10, 10, 10, 10] };
}

function sheetStats(b: Battery): Sheet {
  const rows: Cell[][] = [['Medida', 'Toma', 'n', 'Media', 'DE', 'Mínimo', 'Máximo', 'Corte', '% sobre el corte', 'Media si dijeran lo verdadero']];
  for (const m of MEASURES) {
    for (const toma of [0, 1, 2]) {
      const xs = valuesOf(b, toma, m, 'reported');
      const tr = valuesOf(b, toma, m, 'truthful');
      rows.push([m.label, TOMA_LABEL[toma], xs.length, r2(mean(xs)), r2(sd(xs)), Math.min(...xs), Math.max(...xs), m.overLabel, m.overLabel === '—' ? null : r2((xs.filter(m.over).length / (xs.length || 1)) * 100), r2(mean(tr))]);
    }
  }
  return { name: 'Estadísticos', rows, widths: [22, 18, 6, 10, 10, 10, 10, 34, 16, 26] };
}

function sheetSanity(b: Battery): Sheet {
  const rows: Cell[][] = [['Toma', 'Medida A', 'Medida B', 'r (Pearson)', 'Signo esperado', '¿Coincide?']];
  for (const s of sanity(b)) rows.push([TOMA_LABEL[s.toma], s.a, s.b, Number.isFinite(s.r) ? r2(s.r) : null, s.expected, s.ok ? 'sí' : 'REVISAR']);
  return { name: 'Cordura (correlaciones)', rows, widths: [18, 18, 18, 12, 16, 12] };
}

function sheetItems(b: Battery): Sheet {
  const rows: Cell[][] = [['ID', 'Nombre', 'Toma', 'Instrumento', 'Ítem', 'Afirmación', 'Verdadero', 'Dicho', 'Disposición', 'Quién lo escribió', 'Lo que dijo']];
  for (const t of b.takes) {
    if (!t.instruments) continue;
    for (const id of INSTRUMENT_IDS) {
      const ins = INSTRUMENTS[id];
      for (const it of t.instruments[id].items) rows.push([t.citizenId, nameOf(b, t.citizenId), TOMA_LABEL[t.toma], id, it.n, ins.items[it.n - 1]!.text, it.truthful, it.reported, it.disposition, it.source, it.reply]);
    }
  }
  return { name: 'Respuestas', rows, widths: [12, 26, 16, 10, 6, 60, 10, 8, 12, 12, 80] };
}

function sheetIndicators(b: Battery): Sheet {
  const keys = Object.keys(b.takes.find((t) => t.indicators)!.indicators!) as (keyof Indicators)[];
  const rows: Cell[][] = [['ID', 'Nombre', 'Toma', ...keys]];
  for (const t of b.takes) if (t.indicators) rows.push([t.citizenId, nameOf(b, t.citizenId), TOMA_LABEL[t.toma], ...keys.map((k) => r2(t.indicators![k]))]);
  return { name: 'Indicadores', rows, widths: [12, 26, 16, ...keys.map(() => 12)] };
}

function sheetEvents(b: Battery): Sheet {
  const rows: Cell[][] = [['ID', 'Nombre', 'Intervalo', 'Evento', 'Cantidad']];
  for (const e of b.events) rows.push([e.citizenId, nameOf(b, e.citizenId), e.interval, e.type, e.count]);
  return { name: 'Eventos entre tomas', rows, widths: [12, 26, 18, 30, 10] };
}

function sheetParticipants(b: Battery): Sheet {
  const alive = (id: string, toma: number) => (b.takes.find((t) => t.citizenId === id && t.toma === toma)?.alive ? 'sí' : 'no');
  const rows: Cell[][] = [['ID', 'Nombre', 'Sexo', 'Edad (toma 0)', 'Estrato', 'Ocupación', 'Viva toma 1', 'Viva toma 2']];
  for (const p of b.participants) rows.push([p.id, p.name, p.sex, p.age, p.stratum, p.occupation, alive(p.id, 1), alive(p.id, 2)]);
  return { name: 'Participantes', rows, widths: [12, 28, 6, 12, 14, 36, 12, 12] };
}

export const workbookOf = (b: Battery): Buffer =>
  buildXlsx([sheetMethod(b), sheetParticipants(b), sheetScores(b), sheetStats(b), sheetChanges(b), sheetSaidVsTrue(b), sheetSanity(b), sheetItems(b), sheetIndicators(b), sheetEvents(b)]);
