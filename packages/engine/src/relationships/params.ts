// Parámetros de las relaciones (spec 012 §8, v0.2). Todos [M]; calibración en PA-142 a PA-145.

export interface RelationshipParams {
  /** R-001 (PA-142): probabilidad por tick de que una persona inicie un encuentro, × fuerza de acercarse. */
  pInitiate: number;
  /** R-001: tope de encuentros por persona y hora. */
  maxEncountersHour: number;
  /** R-003 (PA-143): ganancia de familiaridad por encuentro y decaimiento diario sin contacto. */
  familiarityGain: number;
  familiarityDecayDay: number;
  /** R-003: cambio de confianza cuando el otro se abre o aplaca (+) o contraataca (−). */
  trustStep: number;
  /** R-004 (PA-144): umbrales de amistad para entrar y para salir (histéresis). */
  friendFam: number;
  friendFn: number;
  friendFamOut: number;
  friendFnOut: number;
  /** R-004: función mínima en ambos lados y familiaridad para formar pareja (adultos sin pareja, P3). */
  partnerFn: number;
  partnerFam: number;
  /** R-005: tensión previa para que un choque sea discusión, y días entre discusiones del mismo par. */
  argumentTension: number;
  argumentCooldownDays: number;
  /** R-005: cuánto sube la tensión un choque (tope `maxTensionDelta` de la 044). */
  clashTension: number;
  /** R-003: fracción de la tensión viva que repara un encuentro sin choque en que alguno se abre o aplaca. */
  repair: number;
  /** R-006 (PA-145): ruptura con función baja y tensión alta durante un tiempo. */
  breakupFn: number;
  breakupTension: number;
  breakupDays: number;
  /** R-008: familiaridad para olvidar a un conocido, y tope de vínculos por persona (P2). */
  forgetFam: number;
  maxBonds: number;
  /** Fuerza de partida de acercarse (`social.acercarse`) sin historia. */
  approachW0: number;
}

export const RELATIONSHIP_DEFAULTS: RelationshipParams = Object.freeze({
  pInitiate: 0.02,
  maxEncountersHour: 3,
  familiarityGain: 0.05,
  familiarityDecayDay: 0.005,
  trustStep: 0.02,
  friendFam: 0.4,
  // Escala medida en M3 (PA-144): con la mezcla real de posturas, el afecto de equilibrio ronda 0,1–0,2.
  friendFn: 0.15,
  friendFamOut: 0.3,
  friendFnOut: 0.08,
  partnerFn: 0.2,
  partnerFam: 0.5,
  argumentTension: 0.3,
  argumentCooldownDays: 2,
  clashTension: 0.1,
  repair: 0.2,
  breakupFn: -0.2,
  breakupTension: 0.6,
  breakupDays: 30,
  forgetFam: 0.02,
  maxBonds: 40,
  approachW0: 0.5,
});

/** Estímulo de una persona en el almacén de otra (012 §3). */
export const personStimulus = (id: string): string => `cit.${id}`;
/** Respuesta de acercarse a alguien (036 R-002). */
export const APPROACH = 'social.acercarse';

/**
 * R-002 [M]: cómo recibe el otro cada postura, como un tono de la charla (043 §3). Abrirse y aplacar llegan como
 * amabilidad; responder breve, callar y evadir, como algo neutro o frío; poner un límite y terminar, como algo
 * desagradable; contraatacar, como grosería.
 */
export const TONE_OF_STANCE: Readonly<Record<string, string>> = Object.freeze({
  abrirse: 'amable', aplacar: 'amable', responder_breve: 'neutro', callar: 'neutro', evadir: 'neutro',
  poner_limite: 'desagradable', terminar: 'desagradable', contraatacar: 'grosero',
});
/** Posturas que chocan (R-005). */
export const CLASH: ReadonlySet<string> = new Set(['contraatacar', 'poner_limite']);
