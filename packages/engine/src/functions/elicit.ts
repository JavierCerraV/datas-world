// Respuesta emocional elicitada por un evento (036 R-001 con 010 R-005; bloque MF2.5): sustituye la modulación
// por neuroticismo y extraversión del adaptador. La intensidad depende de la activación basal (temperamento,
// `respondent.elicitation_gain`) y de lo que ese estímulo ya significa para la persona (su historia).
import type { EventType } from '../events.ts';
import { formatId } from '../ids.ts';
import { functionalValue } from '../relations/derive.ts';
import type { RelationalNetwork } from '../relations/types.ts';
import type { WorldView } from '../simulation/system.ts';
import { EVENT_LEARNING } from './rules.ts';
import { sensitivityOf } from './sensitivity.ts';

/**
 * Multiplicador de las emociones de un evento para una persona [M]: `arousal × (0,75 + 0,5·|v|)`, con `v` el valor
 * funcional del estímulo principal del evento: el aprendido o, si es mayor, el derivado por la red relacional
 * (037 R-006). Consulta rápida para los sistemas que emiten el evento: sin generalización, contexto ni primarios (no
 * tienen la ontología). Sin historia, `arousal × 0,75`… `arousal × 1,25` según lo aprendido.
 */
export function elicitationGain(view: WorldView, row: number, type: EventType): number {
  const sens = sensitivityOf(view, row);
  const main = EVENT_LEARNING[type]?.main;
  if (!main) return sens.arousal * 0.75;
  const person = view.citizens.get(formatId('CIT', row));
  const directOf = (s: string) => person?.functions?.f.find((f) => f.s === s)?.v ?? 0;
  const v = functionalValue(person?.network as RelationalNetwork | undefined, directOf, main).value;
  return sens.arousal * (0.75 + 0.5 * Math.abs(v));
}
