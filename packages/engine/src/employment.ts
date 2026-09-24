// Ocupación de las personas (spec 006): contratación en un puesto formal y ocupaciones no formales.
// Es la única vía para cambiar `Citizen.occupation` y `Position.holderId` (CLAUDE.md regla 4).
import type { EntityId } from './ids.ts';
import type { Occupation, World } from './world.ts';

/** Ocupa un puesto libre de una organización (006 INV-002: un puesto, un titular; una persona, un puesto). */
export function hire(world: World, citizenId: EntityId, orgId: EntityId, positionId: string): void {
  const c = world.citizens.get(citizenId);
  if (!c) throw new Error(`No existe el ciudadano ${citizenId}`);
  const org = world.organizations.get(orgId);
  if (!org) throw new Error(`No existe la organización ${orgId}`);
  const pos = org.positions.find((p) => p.id === positionId);
  if (!pos) throw new Error(`${orgId} no tiene el puesto ${positionId}`);
  if (pos.holderId !== undefined) throw new Error(`El puesto ${positionId} ya lo ocupa ${pos.holderId}`);
  if (c.occupation?.kind === 'formal') throw new Error(`${citizenId} ya ocupa ${c.occupation.positionId}`);
  pos.holderId = citizenId;
  c.occupation = { kind: 'formal', orgId, positionId };
}

/** Ocupación informal, independiente o ninguna. Para un puesto formal, usar `hire`. */
export function setOccupation(
  world: World,
  citizenId: EntityId,
  occupation: Exclude<Occupation, { kind: 'formal' }>,
): void {
  const c = world.citizens.get(citizenId);
  if (!c) throw new Error(`No existe el ciudadano ${citizenId}`);
  if (c.occupation?.kind === 'formal') throw new Error(`${citizenId} ocupa un puesto formal: primero debe dejarlo`);
  if ((occupation.kind === 'informal' || occupation.kind === 'independent') && !occupation.trade.trim()) {
    throw new Error('Una ocupación informal o independiente necesita oficio');
  }
  c.occupation = structuredClone(occupation);
}
