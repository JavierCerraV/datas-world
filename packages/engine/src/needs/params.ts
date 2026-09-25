// Parámetros de la spec 010, leídos del perfil de país (029). Todos por hora de mundo.
import { profileNumber, profileValue } from '../profile.ts';
import type { CountryProfile } from '../profile.ts';
import type { DeepReadonly } from '../simulation/system.ts';

type Rec = Record<string, number>;

export interface NeedsParams {
  rates: Rec;
  stress: Rec;
  mood: Rec;
  acuteDailyP: number;
  acuteWeights: Rec;
  acuteDays: Rec;
}

const memo = new WeakMap<object, Map<string, NeedsParams>>();

/**
 * Acepta el perfil de la vista de solo lectura (021): la consulta no lo modifica. Se memoriza por perfil y
 * fecha: los sistemas la piden en cada tick y el perfil de un mundo no cambia (029, congelado en la configuración).
 */
export function needsParams(profile: CountryProfile | DeepReadonly<CountryProfile>, date: string): NeedsParams {
  const byDate = memo.get(profile) ?? new Map<string, NeedsParams>();
  memo.set(profile, byDate);
  const hit = byDate.get(date);
  if (hit) return hit;
  const params = readParams(profile as CountryProfile, date);
  byDate.set(date, params);
  return params;
}

function readParams(p: CountryProfile, date: string): NeedsParams {
  const rec = (k: string) => profileValue(p, k, date) as Rec;
  return {
    rates: rec('needs.rates'),
    stress: rec('needs.stress'),
    mood: rec('needs.mood'),
    acuteDailyP: profileNumber(p, 'health.acute.dailyP', date),
    acuteWeights: rec('health.acute.weights'),
    acuteDays: rec('health.acute.days'),
  };
}

/** Enfermedades agudas en orden canónico (por clave); el código en `health.acute` es la posición + 1. */
export const acuteKeys = (P: NeedsParams): string[] => Object.keys(P.acuteWeights).sort();
