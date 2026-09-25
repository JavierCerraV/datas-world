// Registro de mecanismos de aprendizaje (spec 035 §5). Los ids son estables: el catálogo `temperament_params`
// solo puede citar estos en `modula` (009 INV-003), y la prueba de arquitectura (009 R-006) solo permite leer
// el temperamento a los archivos que implementan un mecanismo registrado.

export const MECHANISMS = Object.freeze({
  'respondent.appetitive_update': '036 R-001',
  'respondent.aversive_update': '036 R-001',
  'respondent.elicitation_gain': '036 R-001',
  'respondent.habituation': '036 R-006',
  'respondent.social_salience': '036 R-001',
  'operant.reinforcement_update': '036 R-002',
  'operant.punishment_update': '036 R-002',
  'operant.novel_initial_value': '036 R-002',
  'operant.variability_initial': '036 R-012',
  'extinction.context': '036 R-003',
  'generalization.gradient': '036 R-004',
  'generalization.novel_prior': '036 R-004',
  'discrimination.differential': '036 R-005',
  'discounting.initial_k': '036 R-009',
  'discounting.k_plasticity': '036 R-009',
  'relational.mutual_entailment': '037 R-001',
  'relational.combinatorial_entailment': '037 R-002',
  'relational.transformation': '037 R-003',
  'rules.following_update': '038 R-004',
  'values.hierarchy_transfer': '038 R-006',
  'private.derivation_step': '039 R-002',
  'private.avoidance_update': '039 R-004',
  'private.hierarchical_framing': '039 R-006',
  'motivation.arousal_baseline': '036 R-010',
} as const);
export type MechanismId = keyof typeof MECHANISMS;

export const isMechanism = (id: string): id is MechanismId => Object.hasOwn(MECHANISMS, id);

/**
 * Términos de conducta o patrón clínico que ningún parámetro de temperamento puede nombrar (009 CA-A):
 * el temperamento parametriza el aprendizaje, no describe conductas (documento rector §12).
 */
export const FORBIDDEN_TERMS = Object.freeze([
  'evitación', 'evitativ', 'avoid', 'rumia', 'rumination', 'aprobación', 'approval', 'impulsiv', 'resilien',
  'afrontamiento', 'coping', 'ansiedad', 'anxiety', 'depresi', 'honest', 'mentir', 'agresiv', 'aislamiento',
  'perseveran', 'cooperac',
]);
