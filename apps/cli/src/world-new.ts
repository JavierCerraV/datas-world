// world:new — genera un mundo de M1 completo (o uno vacío de M0 con --empty) y lo guarda (spec 001, 027, 030).
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { ENGINE_VERSION, createWorld, stateHash } from '@datas-world/engine';
import type { World, WorldConfig, WorldEvent } from '@datas-world/engine';
import { DEFAULT_EPOCH, DEFAULT_PROFILE, generateWorld } from '@datas-world/generators';
import { WorldRepository, openWorldDb } from '@datas-world/persistence';
import { DEFAULT_DB, UsageError, toInt, withDb } from './common.ts';
import type { Io } from './common.ts';

/** Mundo vacío de M0: solo el reloj, sin mapa ni población. Lo usan `bench` y las pruebas del tiempo. */
export function emptyWorld(seed: number, name: string, epoch: string, tickMinutes: number): ReturnType<typeof createWorld> {
  const config: WorldConfig = {
    name,
    seed,
    epoch,
    tickMinutes,
    currency: { code: 'COP', minorUnit: 1 },
    population: { target: 0 },
    engineVersion: ENGINE_VERSION,
    params: {},
    initialCapabilities: ['clock'],
    holidays: [],
  };
  return createWorld(config); // valida la configuración antes de tocar el disco
}

/** Guarda un mundo recién creado: estado, eventos de la creación e instantánea inicial. No pisa otro mundo. */
export function saveNewWorld(path: string, world: World, events: readonly WorldEvent[]): void {
  mkdirSync(dirname(path), { recursive: true });
  withDb(openWorldDb(path), (db) => {
    const repo = new WorldRepository(db);
    if (repo.hasWorld()) throw new UsageError(`${path} ya contiene un mundo; usa otra --db`);
    repo.flush({ world, events });
    repo.saveSnapshot(world);
  });
}

export function worldNew(args: string[], io: Io): void {
  const { values: v } = parseArgs({
    args,
    options: {
      seed: { type: 'string' },
      profile: { type: 'string', default: DEFAULT_PROFILE },
      population: { type: 'string' },
      name: { type: 'string', default: "Data's World" },
      epoch: { type: 'string', default: DEFAULT_EPOCH },
      tick: { type: 'string', default: '5' },
      empty: { type: 'boolean', default: false },
      db: { type: 'string', default: DEFAULT_DB },
    },
  });
  const seed = toInt('seed', v.seed);
  const tickMinutes = toInt('tick', v.tick, 1);
  if (v.empty) {
    const { world, events } = emptyWorld(seed, v.name, v.epoch, tickMinutes);
    saveNewWorld(v.db, world, events);
    io.out(`Mundo vacío ${world.id} «${v.name}» creado en ${v.db} (semilla ${seed}, hash ${stateHash(world)})`);
    return;
  }
  const g = generateWorld({
    seed,
    profileId: v.profile,
    name: v.name,
    epoch: v.epoch,
    tickMinutes,
    ...(v.population !== undefined ? { population: toInt('population', v.population, 1) } : {}),
  });
  saveNewWorld(v.db, g.world, g.events);
  io.out(
    `Mundo ${g.world.id} «${v.name}» creado en ${v.db}: perfil ${v.profile}, semilla ${seed}, ` +
      `${g.pop.citizenIds.length} personas en ${g.pop.householdIds.length} hogares, ` +
      `${g.hist.ancestorIds.length} antepasados, ${g.events.length} eventos, hash ${stateHash(g.world)}`,
  );
}
