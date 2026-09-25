// Utilidades para las pruebas de los generadores. No se exportan desde index.ts.
// Montan un mundo de M1 completo con `generateWorld`, con los catálogos cargados una sola vez.
import { ageInYears, idNumber } from '@datas-world/engine';
import type { EntityId, World } from '@datas-world/engine';
import { loadCatalogs } from './catalogs/load.ts';
import { loadProfile } from './country/profile.ts';
import { generateWorld } from './generate.ts';

export const catalogs = loadCatalogs();

export function buildWorld(profileId: string, seed: number) {
  const g = generateWorld({ seed, profileId, catalogs });
  // `events` sin WORLD_CREATED: las pruebas de los generadores miran solo el pasado (at < 0).
  const events = g.events.filter((e) => e.type !== 'WORLD_CREATED');
  return { ...g, events, profile: loadProfile(profileId) };
}

export const ageOf = (w: World, id: EntityId): number =>
  ageInYears(w.components.i32['demo.birthMinute']![idNumber(id)]!, w.now, w.config.epoch);
