// Prudencia ante un desconocido (spec 043 v0.7, R-024 a R-026): la familiaridad que el visitante tiene para la persona,
// el nivel de intimidad que se abre y la cautela que resta. Puro y sin azar; no lee el temperamento.
import type { ChatParams, StrangerParams } from './params.ts';
import { STRANGER_DEFAULTS } from './params.ts';
import { visitorValue } from './tone.ts';
import type { ConversationState } from './types.ts';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Nivel de intimidad que se puede contar: 0 público, 1 personal, 2 íntimo (R-026). */
export type DisclosureLevel = 0 | 1 | 2;

export const strangerParams = (p: ChatParams): StrangerParams => p.stranger ?? STRANGER_DEFAULTS;

/**
 * R-024: `min(1, turnos_previos × F_PREV_TURNO + turnos_cálidos × F_TURNO + max(0, valor_del_visitante) × F_VALOR)`.
 * Los turnos previos son los ensayos de la función del visitante en el almacén (se acumulan con cada charla `in_world`
 * consolidada); un turno de esta sesión es cálido si el valor de su tono es ≥ 0. Con 0 es un desconocido.
 */
export function familiarity(s: ConversationState, params: ChatParams): number {
  const sp = strangerParams(params);
  const previous = s.baseTrials ?? 0;
  // Solo cuentan los turnos que la persona ya contestó: el que está en curso aún no ha generado confianza.
  const warm = s.turns.filter((t) => t.stance !== undefined && t.toneValue >= 0).length;
  return clamp01(previous * sp.fPrevTurn + warm * sp.fTurn + Math.max(0, visitorValue(s)) * sp.fValue);
}

/** R-025: la cautela, de 1 (desconocido) a 0 (conocido). */
export const caution = (s: ConversationState, params: ChatParams): number => 1 - familiarity(s, params);

/** R-026: qué se puede contar con esta familiaridad y este valor del visitante. */
export function disclosureLevel(f: number, visitorVal: number, params: ChatParams): DisclosureLevel {
  const sp = strangerParams(params);
  if (f < sp.discloseL1) return 0;
  return f >= sp.discloseL2 && visitorVal > sp.discloseValue ? 2 : 1;
}

/** El nivel de la charla en este momento (con lo que ya pasó en ella). */
export const disclosureOf = (s: ConversationState, params: ChatParams): DisclosureLevel => disclosureLevel(familiarity(s, params), visitorValue(s), params);
