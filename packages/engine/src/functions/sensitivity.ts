// Sensibilidades del temperamento para los mecanismos de la 036 (009 R-004): `0,5 + tmp`, 1 sin la columna.
// Es uno de los pocos archivos que pueden leer `tmp.*` (mecanismos registrados, 035 §5; 009 R-006).
import type { Ontology, Sensitivity, StimulusClass } from './types.ts';

type Readable = { components: { f32: Readonly<Record<string, ArrayLike<number> | undefined>> } };

export function sensitivityOf(view: Readable, row: number): Sensitivity {
  const f = view.components.f32;
  const m = (col: string) => 0.5 + (f[col]?.[row] ?? 0.5);
  return {
    appetitive: m('tmp.appetitiveSensitivity'), // respondent.appetitive_update, operant.reinforcement_update
    aversive: m('tmp.aversiveSensitivity'), // respondent.aversive_update, operant.punishment_update
    arousal: m('tmp.arousalBaseline'), // respondent.elicitation_gain
    habituation: m('tmp.habituationRate'), // respondent.habituation
    social: m('tmp.socialSalience'), // respondent.social_salience
  };
}

/** Ontología a partir de sus clases (orden por clave). Todas deben tener la misma dimensión de rasgos. */
export function createOntology(classes: readonly StimulusClass[]): Ontology {
  const dims = classes[0]?.features.length ?? 0;
  for (const c of classes) if (c.features.length !== dims) throw new Error(`${c.key}: ${c.features.length} rasgos, se esperaban ${dims}`);
  const sorted = [...classes].sort((a, b) => (a.key < b.key ? -1 : 1));
  return { classes: new Map(sorted.map((c) => [c.key, c])), dims };
}
