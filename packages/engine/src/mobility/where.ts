// Dónde se hace cada actividad de la rutina (011 R-001 con 016): la casa, el trabajo, el colegio o el lugar
// público de cada obligación. Hasta el motor de decisiones (017, bloque E), el tiempo libre se pasa en casa.
import type { ActivityKind } from '../activity.ts';
import { formatId, idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import type { WorldView } from '../simulation/system.ts';
import { homeOf } from './columns.ts';
import { firstOfKind } from './network.ts';

const AT_HOME: ReadonlySet<ActivityKind> = new Set(['sleep', 'wash', 'chores', 'care', 'sick', 'idle', 'leisure', 'socialize']);

/** Lugar del trabajo formal de la persona: el primero de su organización. */
export function workplaceOf(view: WorldView, row: number): number {
  const occ = view.citizens.get(formatId('CIT', row))?.occupation;
  if (occ?.kind !== 'formal') return 0;
  const org = view.organizations.get(occ.orgId as EntityId);
  return org?.placeIds[0] ? idNumber(org.placeIds[0]) : 0;
}

/** Colegio según la edad: la sede primaria (033) hasta los 10 años si existe; si no, el colegio. */
export function schoolOf(view: WorldView, row: number): number {
  const age = (view.now - (view.components.i32['demo.birthMinute']?.[row] ?? 0)) / (365.25 * 1440);
  const primary = age < 11 ? firstOfKind(view, 'educacion.escuela') : 0;
  return primary || firstOfKind(view, 'educacion.colegio') || firstOfKind(view, 'educacion.escuela');
}

/**
 * Lugar donde se hace una actividad; 0 = donde esté (comer, comprar, hacer ejercicio: los lugares de esas
 * actividades los elige el motor de decisiones). Si el lugar de la obligación no existe, la casa.
 */
export function placeFor(view: WorldView, row: number, activity: ActivityKind): number {
  const home = homeOf(view, row);
  if (AT_HOME.has(activity)) return home;
  switch (activity) {
    case 'work': {
      const occ = view.citizens.get(formatId('CIT', row))?.occupation;
      if (occ?.kind === 'formal') return workplaceOf(view, row) || home;
      // El trabajo informal es sobre todo en la calle y la plaza; el independiente, en casa (taller, oficio).
      return occ?.kind === 'informal' ? firstOfKind(view, 'espacio_publico.plaza') || home : home;
    }
    case 'study':
      return schoolOf(view, row) || home;
    case 'job_search':
      return firstOfKind(view, 'gobierno.alcaldia') || home; // atención al ciudadano y servicio de empleo
    case 'errands':
      return firstOfKind(view, 'finanzas.corresponsal') || firstOfKind(view, 'gobierno.alcaldia') || home;
    default:
      return 0;
  }
}
