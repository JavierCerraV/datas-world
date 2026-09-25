// ADAPTADOR TEMPORAL (@deprecated). Spec 035 §9 e informe `docs/investigacion/impacto-motor-funcional.md` §4.1.
//
// Los sistemas de M2 (necesidades, rutinas, decisiones) se escribieron con la personalidad a utilidad de la
// 009 v0.3. Hasta que las capas 2–6 del motor funcional los sustituyan, leen los rasgos SOLO por aquí:
// - los descriptores Big Five tal cual;
// - los rasgos eliminados, traducidos desde el temperamento (impulsividad ← tmp.discount0; resiliencia ←
//   1 − tmp.aversiveSensitivity).
// Cada uso tiene fecha de caducidad (el bloque del plan MF que lo retira), y la prueba de arquitectura falla si
// sigue después. El adaptador entero se elimina en MF7.
import type { WorldView } from '../simulation/system.ts';

type Readable = Pick<WorldView, 'components'>;

/** @deprecated Rasgos de la 009 v0.3 para los sistemas de M2. Se retira por bloques (MF2, MF3, MF6) y del todo en MF7. */
export interface LegacyTraits {
  neuroticism: number;
  extraversion: number;
  conscientiousness: number;
  openness: number;
  agreeableness: number;
  /** Traducida desde `tmp.discount0` (la pendiente inicial del descuento). */
  impulsivity: number;
  /** Traducida desde `1 − tmp.aversiveSensitivity`. */
  resilience: number;
}

/** @deprecated Ver `LegacyTraits`. Sin la columna, 0,5 (mundos antiguos o de prueba). */
export function legacyTraits(view: Readable, row: number): LegacyTraits {
  const f = view.components.f32;
  const get = (col: string) => f[col]?.[row] ?? 0.5;
  return {
    neuroticism: get('pers.neuroticism'),
    extraversion: get('pers.extraversion'),
    conscientiousness: get('pers.conscientiousness'),
    openness: get('pers.openness'),
    agreeableness: get('pers.agreeableness'),
    impulsivity: get('tmp.discount0'),
    resilience: 1 - get('tmp.aversiveSensitivity'),
  };
}

/** @deprecated Un rasgo suelto (para bucles por persona que solo necesitan uno). */
export function legacyTrait(view: Readable, row: number, trait: keyof LegacyTraits): number {
  return legacyTraits(view, row)[trait];
}
