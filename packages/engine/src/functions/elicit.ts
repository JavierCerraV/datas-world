// Respuesta emocional elicitada por un evento (036 R-001 con 010 R-005; bloque MF2.5): sustituye la modulación
// por neuroticismo y extraversión del adaptador. La intensidad depende de la activación basal (temperamento,
// `respondent.elicitation_gain`) y de lo que ese estímulo ya significa para la persona (su historia).
import type { EventType } from '../events.ts';
import { formatId } from '../ids.ts';
import type { WorldView } from '../simulation/system.ts';
import { EVENT_LEARNING } from './rules.ts';
import { sensitivityOf } from './sensitivity.ts';

/**
 * Multiplicador de las emociones de un evento para una persona [M]: `arousal × (0,75 + 0,5·|v|)`, con `v` el valor
 * aprendido del estímulo principal del evento (sin generalización ni contexto: una consulta rápida para los
 * sistemas que emiten el evento). Sin historia, `arousal × 0,75`… `arousal × 1,25` según lo aprendido.
 */
export function elicitationGain(view: WorldView, row: number, type: EventType): number {
  const sens = sensitivityOf(view, row);
  const main = EVENT_LEARNING[type]?.main;
  const learned = main ? (view.citizens.get(formatId('CIT', row))?.functions?.f.find((f) => f.s === main)?.v ?? 0) : 0;
  return sens.arousal * (0.75 + 0.5 * Math.abs(learned));
}
