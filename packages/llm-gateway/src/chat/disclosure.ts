// Revelación gradual (spec 043 v0.7, R-026): la vista que recibe el LLM se filtra ANTES del prompt según la
// familiaridad del visitante. Lo que no está en la vista no se puede contar. Un hecho sin nivel declarado es íntimo.
import type { DisclosureLevel } from '@datas-world/engine';
import type { PersonView } from './view.ts';

/** Hechos que se pueden contar a alguien que apenas se conoce (nivel 1, personal); el resto es íntimo (nivel 2). */
const PERSONAL_EVENTS: ReadonlySet<string> = new Set([
  'CITIZEN_BORN', 'MIGRATED', 'STUDIES_COMPLETED', 'JOB_HIRED', 'INFORMAL_WORK_STARTED', 'HOUSEHOLD_FORMED', 'LEISURE_TAKEN_UP', 'RETIRED',
]);

/** Nivel de intimidad de un hecho por el tipo del evento que lo origina: 1 personal, 2 íntimo (también si no se sabe). */
export const factLevel = (eventType?: string): 1 | 2 => (eventType && PERSONAL_EVENTS.has(eventType) ? 1 : 2);

const given = (name: string) => name.split(' ')[0] ?? name;
/** «empleo formal en Droguería La Salud» → «empleo formal»: el lugar concreto es del nivel personal. */
const generalOccupation = (o: string) => o.replace(/ en .*$/, '');

/**
 * La vista que se abre en este nivel (R-026):
 * - 0, desconocido: nombre de pila, edad aproximada, ocupación en general y lo que hace ahora; sin familia, gustos,
 *   historia, dinero ni emociones;
 * - 1, conocido: nombre completo, familia, gustos, lo personal de su historia y su ocupación concreta; sin lo íntimo,
 *   el dinero ni las emociones;
 * - 2, de confianza: todo.
 */
export function discloseView(pv: PersonView, level: DisclosureLevel): PersonView {
  if (level >= 2) return pv;
  const base: PersonView = { ...pv, state: { ...pv.state, emotions: {} }, situation: { ...pv.situation, money: null } };
  if (level === 1) return { ...base, facts: pv.facts.filter((f) => f.level <= 1) };
  return {
    ...base,
    name: given(pv.name),
    age: pv.age === null ? null : Math.round(pv.age / 5) * 5,
    birthplace: null,
    occupation: generalOccupation(pv.occupation),
    family: [],
    likes: [],
    facts: [],
  };
}
