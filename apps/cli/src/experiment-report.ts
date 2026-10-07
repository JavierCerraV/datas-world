// Informe de un experimento (spec 028 R-008, R-009, R-011): contrastes pareados, CSV en formato largo y libro de Excel.
import { BOOTSTRAP_N, createRng, pairedContrast } from '@datas-world/engine';
import type { Contrast, EntityId, Experiment, MetricId } from '@datas-world/engine';
import type { InterventionLog, Observation } from '@datas-world/generators';
import { buildXlsx } from './xlsx.ts';
import type { Cell, Sheet } from './xlsx.ts';

export interface ArmRun {
  arm: string;
  seed: number;
  branchHash: string;
  endHash: string;
}

export interface ExperimentResult {
  def: Experiment;
  meta: { engine: string; baseHash: string; branchAt: number; branchDate: string; world: string; subjects: EntityId[] };
  runs: ArmRun[];
  observations: Observation[];
  interventions: InterventionLog[];
}

export interface ContrastRow extends Contrast {
  arm: string;
  metric: MetricId;
  day: number;
  /** Personas con la intervención rechazada, que no entran en este contraste. */
  excluded: number;
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** R-008: brazo − control por (semilla, persona) para cada métrica y día medido; excluye a quien tuvo la intervención rechazada. */
export function contrasts(res: ExperimentResult): ContrastRow[] {
  const control = res.def.arms[0]!.name;
  const rejected = new Set(res.interventions.filter((i) => !i.ok && i.citizenId).map((i) => `${i.arm}|${i.seed}|${i.citizenId}`));
  const key = (o: Observation) => `${o.seed}|${o.citizenId}|${o.metric}|${o.day}`;
  const ctl = new Map(res.observations.filter((o) => o.arm === control).map((o) => [key(o), o.value]));
  const root = createRng(res.def.seeds[0]!).fork('experiment:bootstrap');
  const out: ContrastRow[] = [];
  for (const arm of res.def.arms.slice(1)) {
    const mine = res.observations.filter((o) => o.arm === arm.name);
    const groups = new Map<string, { control: number; arm: number }[]>();
    const excluded = [...rejected].filter((r) => r.startsWith(`${arm.name}|`)).length;
    for (const o of mine) {
      if (rejected.has(`${arm.name}|${o.seed}|${o.citizenId}`)) continue;
      const c = ctl.get(key(o));
      if (c === undefined) continue;
      const g = `${o.metric}|${o.day}`;
      (groups.get(g) ?? groups.set(g, []).get(g)!).push({ control: c, arm: o.value });
    }
    for (const [g, pairs] of [...groups].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const [metric, day] = g.split('|') as [MetricId, string];
      const c = pairedContrast(pairs, root.fork(`${arm.name}:${g}`));
      if (c) out.push({ arm: arm.name, metric, day: Number(day), ...c, excluded });
    }
  }
  return out;
}

const sortedObs = (obs: readonly Observation[]) =>
  [...obs].sort((a, b) => a.seed - b.seed || (a.arm < b.arm ? -1 : a.arm > b.arm ? 1 : 0) || (a.citizenId < b.citizenId ? -1 : 1) || a.day - b.day || (a.metric < b.metric ? -1 : 1));

/** R-009: formato largo para R o Python. */
export function csvOf(obs: readonly Observation[]): string {
  return ['seed,arm,citizen,day,metric,value', ...sortedObs(obs).map((o) => `${o.seed},"${o.arm.replace(/"/g, '""')}",${o.citizenId},${o.day},${o.metric},${r3(o.value)}`)].join('\n') + '\n';
}

export function workbookOf(res: ExperimentResult, rows: readonly ContrastRow[]): Buffer {
  const d = res.def;
  const applied = res.interventions.filter((i) => i.ok).length;
  const method: Cell[][] = [
    ['Tema', 'Detalle'],
    ['Experimento', `${d.id} · mundo ${res.meta.world} · rama en el minuto ${res.meta.branchAt} (${res.meta.branchDate}) · motor ${res.meta.engine}`],
    ['Qué es', 'Brazos de un mismo mundo que difieren solo en una intervención o en una capacidad, con el mismo azar por semilla (spec 028). La diferencia es brazo − control, pareada por (semilla, persona), con intervalo del 95 % por bootstrap.'],
    ['Brazos', d.arms.map((a, i) => `${i === 0 ? '[control] ' : ''}${a.name}`).join(' · ')],
    ['Semillas', d.seeds.join(', ')],
    ['Personas medidas', `${res.meta.subjects.length} (${'sample' in d.subjects ? `muestra estratificada de ${d.subjects.sample} adultos` : 'indicadas en la definición'})`],
    ['Duración y medición', `${d.durationDays} días, medidas cada ${d.sampleEveryDays} días y al final. Ánimo y estrés: media de 7 días.`],
    ['Intervenciones', `${applied} aplicadas y ${res.interventions.length - applied} rechazadas (hoja «Intervenciones»). Las personas con una intervención rechazada no entran en el contraste de ese brazo.`],
    ['Hash de la rama', [...new Set(res.runs.map((r) => r.branchHash))].length === 1 ? `${res.runs[0]!.branchHash} (el mismo en todos los brazos y semillas)` : 'DISTINTO entre brazos: revisar'],
    ['Bootstrap', `${BOOTSTRAP_N} remuestreos por contraste, flujo experiment:bootstrap.`],
    ['LÍMITES (leer antes de usar)', 'Esto es lo que predice el MODELO sobre personas simuladas, no lo que ocurriría a personas reales: depende de las reglas y parámetros [M] del motor (028 R-011). Con pocas semillas los intervalos son anchos y no son evidencia de efecto. Las observaciones de una misma semilla comparten mundo y azar, y las de una misma persona se repiten en el tiempo: el intervalo supone que son independientes y es optimista.'],
  ];
  const contrastSheet: Cell[][] = [['Brazo', 'Métrica', 'Día', 'n', 'Media brazo − control', 'DE', 'IC95 inferior', 'IC95 superior', 'dz', 'Personas excluidas']];
  for (const r of rows) contrastSheet.push([r.arm, r.metric, r.day, r.n, r3(r.meanDiff), r3(r.sd), r3(r.ci95[0]), r3(r.ci95[1]), r.dz === null ? null : r3(r.dz), r.excluded]);
  const armSheet: Cell[][] = [['Brazo', 'Semilla', 'Hash de la rama', 'Hash al final']];
  for (const r of res.runs) armSheet.push([r.arm, r.seed, r.branchHash, r.endHash]);
  const ivSheet: Cell[][] = [['Brazo', 'Semilla', 'Día', 'Tipo', 'Persona', '¿Aplicada?', 'Motivo']];
  for (const i of res.interventions) ivSheet.push([i.arm, i.seed, i.afterDays, i.kind, i.citizenId, i.ok ? 'sí' : 'no', i.reason]);
  const obsSheet: Cell[][] = [['Semilla', 'Brazo', 'Persona', 'Día', 'Métrica', 'Valor'], ...sortedObs(res.observations).map((o): Cell[] => [o.seed, o.arm, o.citizenId, o.day, o.metric, r3(o.value)])];
  const sheets: Sheet[] = [
    { name: 'Método y límites', rows: method, widths: [28, 140] },
    { name: 'Contrastes', rows: contrastSheet, widths: [24, 22, 6, 8, 20, 10, 14, 14, 8, 18] },
    { name: 'Brazos y semillas', rows: armSheet, widths: [24, 8, 20, 20] },
    { name: 'Intervenciones', rows: ivSheet, widths: [24, 8, 6, 20, 14, 12, 60] },
    { name: 'Observaciones', rows: obsSheet, widths: [8, 24, 12, 6, 22, 14] },
  ];
  return buildXlsx(sheets);
}
