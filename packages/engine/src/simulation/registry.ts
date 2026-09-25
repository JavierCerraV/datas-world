// Registro de sistemas (spec 021 R-005, INV-003): lista estática, validada y en orden canónico.
import { isCapability } from '../capabilities.ts';
import type { Capability } from '../capabilities.ts';
import { PHASES } from './system.ts';
import type { Phase, System } from './system.ts';

export interface SystemRegistry {
  /** Sistemas en orden de ejecución: fase, luego `order`, luego `id`. */
  readonly systems: readonly System[];
}

/**
 * Crea el registro. Falla al arrancar si hay ids repetidos, fases o capacidades desconocidas o cadencias
 * inválidas (R-005). El orden es función pura de la lista (INV-003).
 */
export function createRegistry(systems: readonly System[]): SystemRegistry {
  const ids = new Set<string>();
  for (const s of systems) {
    if (!/^[a-z][a-z0-9_.]*$/.test(s.id)) throw new Error(`Id de sistema inválido: ${s.id}`);
    if (ids.has(s.id)) throw new Error(`021 R-005: sistema registrado dos veces: ${s.id}`);
    ids.add(s.id);
    if (!(PHASES as readonly string[]).includes(s.phase)) throw new Error(`${s.id}: fase desconocida ${s.phase}`);
    if (!isCapability(s.capability)) throw new Error(`${s.id}: capacidad desconocida ${String(s.capability)}`);
    if (!['tick', 'hour', 'day'].includes(s.cadence)) throw new Error(`${s.id}: cadencia inválida ${String(s.cadence)}`);
    if (!Number.isInteger(s.order)) throw new Error(`${s.id}: el orden debe ser entero`);
  }
  const phase = (p: Phase) => PHASES.indexOf(p);
  const sorted = [...systems].sort(
    (a, b) => phase(a.phase) - phase(b.phase) || a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return Object.freeze({ systems: Object.freeze(sorted) });
}

/** Los sistemas que corren con estas capacidades (R-005), en su orden. */
export const activeSystems = (registry: SystemRegistry, capabilities: readonly Capability[]): System[] =>
  registry.systems.filter((s) => capabilities.includes(s.capability));

export const EMPTY_REGISTRY: SystemRegistry = createRegistry([]);
