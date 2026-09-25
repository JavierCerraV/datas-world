// Archivos de ejemplo para la prueba de la regla (009 CA-B). No son código del motor: son textos.

/** Un módulo de selección que lee el temperamento para elegir: debe fallar. */
export const SELECTION_READS_TEMPERAMENT = {
  path: 'packages/engine/src/selection/choose.ts',
  text: [
    "import { MECHANISMS } from '../temperament/mechanisms.ts';",
    'export const temperatureOf = (f: Record<string, Float32Array>, row: number) =>',
    "  0.3 * (0.6 + 0.8 * f['tmp.variability0']![row]!);",
  ].join('\n'),
};

/** Un sistema cualquiera que lee un rasgo sin pasar por el temperamento: debe fallar. */
export const SYSTEM_READS_TRAIT = {
  path: 'packages/engine/src/economy/system.ts',
  text: "const n = view.components.f32['pers.neuroticism']![row]!;",
};

/** Un mecanismo de aprendizaje del temperamento: permitido. */
export const MECHANISM_READS_TEMPERAMENT = {
  path: 'packages/engine/src/temperament/sensitivity.ts',
  text: "export const beta = (f: Record<string, Float32Array>, row: number) => 0.5 + f['tmp.aversiveSensitivity']![row]!;",
};
