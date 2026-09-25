// Planear un viaje (016 R-001 a R-003): modo según los vehículos, la salud y el dinero; tiempo por calle con
// ruido; bus intermunicipal desde el paradero con espera y pasaje; combustible en moto y carro.
import { formatId } from '../ids.ts';
import type { Rng } from '../rng.ts';
import type { WorldView } from '../simulation/system.ts';
import type { Mode } from './columns.ts';
import { firstOfKind, metersBetween, travelTo } from './network.ts';
import type { MobilityParams } from './params.ts';

const DAY = 1440;
/** Bit de `health.disability` para caminar (031 §3). */
const WALK_IMPAIRED = 4;
/** Minutos de un desplazamiento dentro de la ciudad de referencia (fuera del mapa). */
const INSIDE_CITY_MINUTES = 15;

export interface TripPlan {
  mode: Mode;
  minutes: number;
  cost: number;
  /** Paradero por el que pasa (bus intermunicipal), o 0. */
  via: number;
  /** Sale del municipio o vuelve a él (033). */
  intercity: boolean;
}

/** Tipos de vehículo de la persona o de su hogar (005): bicicleta, moto, carro. */
export function vehiclesOf(view: WorldView, row: number): Set<string> {
  const id = formatId('CIT', row);
  const household = view.citizens.get(id)?.householdId;
  const out = new Set<string>();
  for (const o of view.objects.values())
    if (o.status === 'active' && o.fate === 'owned' && o.kind.startsWith('transporte.') && (o.ownerId === id || o.ownerId === household))
      out.add(o.kind);
  return out;
}

/** Factor de ruido uniforme en [1 − noise, 1 + noise]; sin azar (`null`), 1: la estimación para decidir cuándo salir. */
const jitter = (noise: number, rng: Rng | null) => (rng ? 1 + noise * (2 * rng.next() - 1) : 1);

/** Minutos para recorrer `meters` a `kmh`, con ruido uniforme de ±`noise` (R-001). Al menos 1. */
export function travelMinutes(meters: number, kmh: number, noise: number, rng: Rng | null): number {
  return Math.max(1, Math.round((meters / 1000 / kmh) * 60 * jitter(noise, rng)));
}

/** Espera hasta la próxima salida del bus desde el minuto `at` (salidas cada `headway` entre `first` y `last`). */
export function busWait(at: number, bus: Record<string, number>): number {
  const minute = ((at % DAY) + DAY) % DAY;
  if (minute <= bus.first!) return bus.first! - minute;
  const next = bus.first! + Math.ceil((minute - bus.first!) / bus.headway!) * bus.headway!;
  return next <= bus.last! ? next - minute : DAY - minute + bus.first!;
}

const ageOf = (view: WorldView, row: number) => (view.now - (view.components.i32['demo.birthMinute']?.[row] ?? 0)) / (365.25 * DAY);

/**
 * Viaje de `from` a `to` (números de lugar) que sale en `now`, o `undefined` si no se puede (sin camino, sin
 * paradero o sin dinero para el pasaje). El azar es el de la persona en este tick; con `null`, la estimación sin ruido.
 */
export function planTrip(view: WorldView, row: number, from: number, to: number, now: number, rng: Rng | null, P: MobilityParams): TripPlan | undefined {
  const S = P.speeds;
  const own = vehiclesOf(view, row);
  const adult = ageOf(view, row) >= 18;
  const impaired = ((view.components.u8['health.disability']?.[row] ?? 0) & WALK_IMPAIRED) !== 0;
  const money = view.components.i32.money?.[row];
  const fuel = (mode: 'moto' | 'car', km: number) => Math.round(P.fuelPerKm[mode]! * km);
  const outside = travelTo(view, to);
  const back = travelTo(view, from);

  if (!outside && !back) {
    const meters = metersBetween(view, from, to);
    if (meters === undefined) return undefined;
    // Dentro del pueblo, casi siempre a pie (R-002): carro solo si caminar es difícil; bicicleta en trayectos largos.
    if (impaired && adult && own.has('transporte.carro'))
      return { mode: 'car', minutes: travelMinutes(meters, S.car!, S.noise!, rng), cost: fuel('car', meters / 1000), via: 0, intercity: false };
    if (!impaired && own.has('transporte.bicicleta') && meters >= P.habits.bikeMinMeters!)
      return { mode: 'bike', minutes: travelMinutes(meters, S.bike!, S.noise!, rng), cost: 0, via: 0, intercity: false };
    return { mode: 'walk', minutes: travelMinutes(meters, S.walk! * (impaired ? 0.5 : 1), S.noise!, rng), cost: 0, via: 0, intercity: false };
  }
  if (outside && back) return { mode: 'walk', minutes: INSIDE_CITY_MINUTES, cost: 0, via: 0, intercity: false };

  // Viaje a La Capital o de vuelta (033): en vehículo propio si hay y alcanza el combustible; si no, en bus.
  const t = (outside ?? back)!;
  const km = P.intercity.km!;
  const privateMode = adult ? (own.has('transporte.carro') ? 'car' : own.has('transporte.moto') ? 'moto' : undefined) : undefined;
  if (privateMode && (money === undefined || money >= fuel(privateMode, km))) {
    const minutes = Math.max(1, Math.round(t.minutes * P.intercity.privateFactor! * jitter(S.noise!, rng)));
    return { mode: privateMode, minutes, cost: fuel(privateMode, km), via: 0, intercity: true };
  }
  const stop = firstOfKind(view, 'transporte.paradero');
  if (!stop || (money !== undefined && money < t.cost)) return undefined;
  const town = outside ? from : to;
  const meters = metersBetween(view, town, stop) ?? 0;
  const walk = meters > 0 ? travelMinutes(meters, S.walk!, S.noise!, rng) : 0;
  const minutes = outside ? walk + busWait(now + walk, P.bus) + t.minutes : busWait(now, P.bus) + t.minutes + walk;
  return { mode: 'bus', minutes, cost: t.cost, via: stop, intercity: true };
}
