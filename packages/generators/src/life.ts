// La vida diaria de M2 montada en un solo sitio (bloque H): el registro de sistemas y las opciones del bucle que
// usan la CLI, el worker, el bench y las validaciones. Vive en los generadores porque necesita los catálogos (la
// tabla de esparcimiento del motor de decisiones, 017) y el motor no hace E/S.
import {
  NEEDS_SYSTEMS,
  Runner,
  WORK_SYSTEMS,
  createActionValidator,
  createDecisionSystem,
  createLearningSystem,
  createRegistry,
  createRng,
  economySystem,
  mobilitySystem,
  routinesSystem,
} from '@datas-world/engine';
import type { Capability, LoopOptions, SystemRegistry, World } from '@datas-world/engine';
import { loadCatalogs } from './catalogs/load.ts';
import type { Catalogs } from './catalogs/load.ts';
import { leisureTable } from './leisure/params.ts';
import { buildOntology } from './stimuli/ontology.ts';

/** Capacidades de la vida diaria (peldaño 1, ADR-005): las que activa `generateWorld` por defecto. */
export const LIFE_CAPABILITIES: readonly Capability[] = Object.freeze(['clock', 'needs', 'routines', 'mobility', 'economy', 'learning']);

/**
 * Sistemas en orden de fase (021): necesidades, enfermedad y sueño (010), rutina (011), decisiones (017),
 * movilidad (016), economía (015), trabajo (006) y aprendizaje directo (036, fase de memoria), con el validador de
 * acciones. Un mundo solo ejecuta los de sus capacidades: un mundo de M1 (solo `clock`) no cambia.
 */
export function lifeSystems(world: World, catalogs: Catalogs = loadCatalogs()): { systems: SystemRegistry; loop: LoopOptions } {
  const profile = world.config.profile;
  const table = profile ? leisureTable(catalogs.leisure_activities, profile, world.config.epoch.slice(0, 10)) : {};
  const learning = createLearningSystem(buildOntology(catalogs));
  return {
    systems: createRegistry([...NEEDS_SYSTEMS, routinesSystem, createDecisionSystem(table), mobilitySystem, economySystem, ...WORK_SYSTEMS, learning]),
    loop: { validate: createActionValidator(table) },
  };
}

/** Runner con la vida diaria y el azar de la semilla del mundo (023). */
export function lifeRunner(world: World, catalogs?: Catalogs, loop: LoopOptions = {}): Runner {
  const life = lifeSystems(world, catalogs);
  return new Runner(world, createRng(world.config.seed), {}, { systems: life.systems, loop: { ...life.loop, ...loop } });
}
