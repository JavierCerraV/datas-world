// Historia generada de Data's World, de 1900 al presente (spec 030). Se ejecuta al final de `world:new`,
// cuando ya existen el territorio, los lugares, las organizaciones, la población y el empleo (R-002).
import type { EntityId, Rng, World, WorldEvent } from '@datas-world/engine';
import type { Catalogs } from '../catalogs/load.ts';
import type { Territory } from '../geography/generate.ts';
import { worldDate } from '../organizations/generate.ts';
import type { PlacesResult } from '../places/generate.ts';
import { contextEvents, generateFoundation } from './foundation.ts';
import { generateGenealogy } from './genealogy.ts';
import { generateLives } from './lives.ts';
import { Clock, historicalEvents, historyParams } from './params.ts';

export interface HistoryResult {
  /** Antepasados creados (fuera del mundo, no se simulan), en orden de id. */
  ancestorIds: EntityId[];
  /** Eventos históricos (at < 0), en orden de creación. */
  events: WorldEvent[];
}

type HistoryCatalogs = Pick<Catalogs, 'birthplaces' | 'family_names' | 'given_names' | 'historical_events'>;

/**
 * 030 R-001: contexto histórico → fundación (municipio, barrios, lugares, organizaciones) → genealogía →
 * uniones, nacimientos, migraciones y muertes. `priorEvents` son los eventos ya generados (trayectorias y
 * empleo): la fundación de cada organización queda antes de su primera contratación (INV-003).
 */
export function generateHistory(
  world: World,
  territory: Territory,
  places: PlacesResult,
  orgIds: readonly EntityId[],
  livingIds: readonly EntityId[],
  priorEvents: readonly WorldEvent[],
  catalogs: HistoryCatalogs,
  rng: Rng,
): HistoryResult {
  const profile = world.config.profile;
  if (!profile) throw new Error('El mundo no tiene perfil de país (spec 029)');
  const P = historyParams(profile, worldDate(world));
  const clock = new Clock(world.config.epoch);
  const history = historicalEvents(catalogs.historical_events);
  const context = contextEvents(world, history, P, clock);
  const foundation = generateFoundation(world, territory, places, orgIds, priorEvents, history, context, P, clock, rng);
  const ancestorIds = generateGenealogy(world, livingIds, catalogs, P, clock, territory.municipalityId, rng);
  const lives = generateLives({
    world,
    livingIds,
    ancestorIds,
    birthplaces: catalogs.birthplaces,
    history,
    context,
    P,
    clock,
    municipalityId: territory.municipalityId,
    townAt: foundation.townEvent.at,
    rng,
  });
  return { ancestorIds, events: [...context.values(), ...foundation.events, ...lives] };
}
