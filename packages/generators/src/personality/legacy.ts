// ADAPTADOR TEMPORAL (@deprecated) de los generadores: spec 035 §9, informe de impacto §4.1–§4.2.
// Los hábitos de salud (031) y la ficha de esparcimiento (032) todavía se eligen con rasgos y valores de la
// 009 v0.3. Hasta que salgan del desarrollo (041, bloque MF7.3), los leen solo por aquí:
// - los descriptores Big Five tal cual; la impulsividad, desde `tmp.discount0` (adaptador del motor);
// - los valores `val.*` ya no existen (son redes de 038): devuelven 0,5, neutro, así que no modulan nada.
import { legacyTraits } from '@datas-world/engine';
import type { World } from '@datas-world/engine';

const TRAIT_OF: Readonly<Record<string, 'neuroticism' | 'extraversion' | 'conscientiousness' | 'openness' | 'agreeableness' | 'impulsivity' | 'resilience'>> = {
  'pers.neuroticism': 'neuroticism',
  'pers.extraversion': 'extraversion',
  'pers.conscientiousness': 'conscientiousness',
  'pers.openness': 'openness',
  'pers.agreeableness': 'agreeableness',
  'pers.impulsivity': 'impulsivity',
  'pers.resilience': 'resilience',
};

/**
 * @deprecated Valor de una columna de la 009 v0.3 tal como la nombran los catálogos de 031 y 032: un rasgo
 * (vía el adaptador del motor) o un valor (`val.*`, neutro). Una columna desconocida también da 0,5.
 */
export function legacyColumn(world: World, row: number, column: string): number {
  const trait = TRAIT_OF[column];
  return trait ? legacyTraits(world, row)[trait] : 0.5;
}

/** @deprecated Rasgos de la 009 v0.3 por nombre (para los hábitos de 031). */
export const legacyTraitsOf = (world: World, row: number) => legacyTraits(world, row);

/** @deprecated Un valor escalar de la 009 v0.3 (`health`, `family`…): ya no existe; siempre 0,5 (neutro). */
export const legacyValue = (_world: World, _row: number, _domain: string): number => 0.5;
