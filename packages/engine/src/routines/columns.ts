// Horarios personales de sueño (spec 011 R-001; prototipo `setRoutine`), fijados al crear el mundo.
import { defineColumn } from '../components.ts';
import { formatId } from '../ids.ts';
import type { Rng } from '../rng.ts';
import type { WorldView } from '../simulation/system.ts';
import type { World } from '../world.ts';

/**
 * Minutos del día: `wakeW` (día de trabajo o estudio), `wakeE` (día libre), `bed` (hora de acostarse). Minutos del
 * mundo: `wakeAt` (despertar real) y `plannedWake` (previsto). `oversleptEvt`: número del último `OVERSLEPT`.
 */
export const ROUTINE_COLUMNS = [
  'routine.wakeW',
  'routine.wakeE',
  'routine.bed',
  'routine.wakeAt',
  'routine.plannedWake',
  'routine.oversleptEvt',
] as const;

export function defineRoutineColumns(world: World): void {
  for (const name of ROUTINE_COLUMNS) if (!(name in world.components.i32)) defineColumn(world.components, 'i32', name, 0);
}

/** Inicio del turno de una persona con empleo formal (006), o `undefined`. */
export function shiftOf(world: Pick<WorldView, 'citizens' | 'organizations'>, row: number) {
  const occ = world.citizens.get(formatId('CIT', row))?.occupation;
  if (occ?.kind !== 'formal') return undefined;
  return world.organizations.get(occ.orgId)?.positions.find((p) => p.id === occ.positionId)?.shift;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Prototipo `setRoutine` (flujo `init:routines/<fila>`):
 * - hora de levantarse en días de trabajo o estudio: 85 min antes del turno; 5:35 si estudia; si no, ≈ 7:00 ± 30;
 * - en días libres, 60–110 min más tarde;
 * - horas de sueño: las de la ficha de salud (031) o, sin ficha, las del prototipo por personalidad; 10 h en menores de 12;
 * - todos empiezan el mundo dormidos, hasta su hora de hoy.
 */
export function initRoutines(world: World, rng: Rng): void {
  defineRoutineColumns(world);
  const c = world.components;
  const i = c.i32;
  const active = c.u8.active!;
  for (let row = 1; row <= world.counters.CIT; row++) {
    if (active[row] !== 1) continue;
    const r = rng.fork('init:routines').fork(row);
    const age = (world.now - (i['demo.birthMinute']?.[row] ?? 0)) / (365.25 * 1440);
    const shift = shiftOf(world, row);
    const student = (c.u8['demo.student']?.[row] ?? 0) === 1;
    const wakeW = shift ? shift.start - 85 : student ? 335 : clamp(420 + Math.round(r.normal(0, 30)), 330, 540);
    const wakeE = wakeW + r.int(60, 110);
    const fromProfile = c.u8['health.sleepHours']?.[row] ?? 0;
    // Sin ficha de salud (mundos de prueba y perfil prototipo): la media que daban los rasgos del prototipo con
    // valores medios (6,95 h), sin rasgos (MF7.3, 041 R-008).
    const sleepH = age < 12 ? 10 : fromProfile > 0 ? fromProfile : clamp(6.95 + r.normal(0, 0.4), 5.5, 9);
    i['routine.wakeW']![row] = wakeW;
    i['routine.wakeE']![row] = wakeE;
    const bed = (((wakeW - Math.round(sleepH * 60)) % 1440) + 1440) % 1440;
    i['routine.bed']![row] = bed;
    i['routine.wakeAt']![row] = world.now + wakeW; // el mundo empieza a medianoche: hoy se levantan a su hora
    i['routine.plannedWake']![row] = world.now + wakeW;
    // El cierre de sueño del primer tick (medianoche, 010 R-004) cuenta el día anterior al mundo: se da por dormido
    // completo; si no, todos empezarían con una noche entera de deuda.
    if (i['state.sleptToday']) i['state.sleptToday'][row] = Math.round(sleepH * 60);
  }
}
