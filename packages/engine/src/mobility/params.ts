// Parámetros de la spec 016, leídos del perfil de país (029) y memorizados por perfil y fecha.
import { profileValue } from '../profile.ts';
import type { CountryProfile } from '../profile.ts';
import type { DeepReadonly } from '../simulation/system.ts';

type Rec = Record<string, number>;

export interface MobilityParams {
  /** km/h por modo dentro del pueblo (`walk`, `bike`, `moto`, `car`) y ruido relativo del tiempo (`noise`). */
  speeds: Rec;
  /** Pesos por km en moto y carro (`moto`, `car`). */
  fuelPerKm: Rec;
  /** Bus intermunicipal: `headway` (min entre salidas), `first` y `last` (minuto del día de la primera y la última). */
  bus: Rec;
  /** Viaje propio a La Capital: `km` y `privateFactor` (fracción del tiempo del bus). */
  intercity: Rec;
  /** Margen con que se sale hacia una obligación (`margin`, min) y distancia desde la que se usa la bicicleta (`bikeMinMeters`). */
  habits: Rec;
}

const memo = new WeakMap<object, Map<string, MobilityParams>>();

export function mobilityParams(profile: CountryProfile | DeepReadonly<CountryProfile>, date: string): MobilityParams {
  const byDate = memo.get(profile) ?? new Map<string, MobilityParams>();
  memo.set(profile, byDate);
  const hit = byDate.get(date);
  if (hit) return hit;
  const rec = (k: string) => profileValue(profile as CountryProfile, k, date) as Rec;
  const params: MobilityParams = {
    speeds: rec('mobility.speeds'),
    fuelPerKm: rec('mobility.fuelPerKm'),
    bus: rec('mobility.bus'),
    intercity: rec('mobility.intercity'),
    habits: rec('mobility.habits'),
  };
  byDate.set(date, params);
  return params;
}
