// Perfil de país: cifras y reglas con fuente y vigencia (spec 029, ADR-006).
// El motor solo lo consulta; cargarlo y validarlo en el borde es cosa de los generadores.
import { parseDate } from './calendar.ts';

export type ProfileScope = 'nacional' | '13ciudades' | 'cabecera' | 'rural' | 'rural_disperso';
export type ProfileStatus = 'oficial' | 'estimado' | 'por_confirmar';
export type ProfileValue = number | string | number[] | Record<string, number>;

export interface ProfileEntry {
  key: string;
  value: ProfileValue;
  validFrom: string; // "AAAA-MM-DD": fecha del mundo desde la que rige
  source: string;
  status: ProfileStatus;
  scope?: ProfileScope;
}

export interface CountryProfile {
  id: string; // 'CO-2026.09'
  country: string; // 'CO'
  currency: { code: string; minorUnit: number };
  entries: ProfileEntry[];
}

/** INV-001 e INV-002 de la 029. Devuelve el primer problema encontrado, o null. */
export function checkProfile(p: CountryProfile): string | null {
  const seen = new Set<string>();
  for (const e of p.entries) {
    if (!e.key) return 'entrada sin clave';
    if (!e.source.trim()) return `${e.key}: sin fuente`;
    try {
      parseDate(e.validFrom);
    } catch {
      return `${e.key}: validFrom inválido (${e.validFrom})`;
    }
    const id = `${e.key}|${e.scope ?? 'nacional'}|${e.validFrom}`;
    if (seen.has(id)) return `${e.key}: dos entradas con la misma vigencia y alcance`;
    seen.add(id);
  }
  return null;
}

/**
 * Entrada vigente de `key` en la fecha del mundo `date` ("AAAA-MM-DD"): la de `validFrom` más reciente
 * que no la supere. Busca primero el alcance pedido y, si no hay, `nacional` (entradas sin alcance).
 * Devuelve undefined si la clave no rige todavía en esa fecha.
 */
export function profileEntry(
  p: CountryProfile,
  key: string,
  date: string,
  scope?: ProfileScope,
): ProfileEntry | undefined {
  parseDate(date);
  const pick = (s: ProfileScope | undefined) => {
    let best: ProfileEntry | undefined;
    for (const e of p.entries) {
      if (e.key !== key || (e.scope ?? 'nacional') !== (s ?? 'nacional') || e.validFrom > date) continue;
      if (!best || e.validFrom > best.validFrom) best = e;
    }
    return best;
  };
  return (scope && scope !== 'nacional' ? pick(scope) : undefined) ?? pick(undefined);
}

/** Como `profileEntry`, pero lanza si no hay valor vigente (una spec pidió una cifra que el perfil no tiene). */
export function profileValue(p: CountryProfile, key: string, date: string, scope?: ProfileScope): ProfileValue {
  const e = profileEntry(p, key, date, scope);
  if (!e) throw new Error(`El perfil ${p.id} no tiene «${key}» vigente el ${date}${scope ? ` (${scope})` : ''}`);
  return e.value;
}

/** Atajo para valores numéricos. */
export function profileNumber(p: CountryProfile, key: string, date: string, scope?: ProfileScope): number {
  const v = profileValue(p, key, date, scope);
  if (typeof v !== 'number') throw new TypeError(`«${key}» no es un número en el perfil ${p.id}`);
  return v;
}
