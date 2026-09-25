// Historia generada (spec 030): antepasados fuera del mundo, genealogía y fechas de fundación.
// Validan y aplican los cambios (CLAUDE.md regla 4); el generador decide qué y cuándo.
import type { WorldMinute } from './calendar.ts';
import { idKind, idNumber } from './ids.ts';
import type { EntityId } from './ids.ts';
import { addCitizen } from './world.ts';
import type { World } from './world.ts';

export interface NewAncestor {
  name: { given: string; family: [string, string] };
  sex: 'F' | 'M';
  birthplace: string;
}

/**
 * Antepasado (spec 030 §3): una persona que no vive en el municipio y no se simula. Tiene fila de componentes
 * (para su nacimiento, muerte y generación) pero `active = 0` y `status: 'inactive'`; no pertenece a ningún hogar.
 */
export function addAncestor(world: World, data: NewAncestor): EntityId {
  if (!data.name.given.trim() || data.name.family.some((f) => !f.trim())) throw new Error('Nombre incompleto');
  if (data.sex !== 'F' && data.sex !== 'M') throw new Error(`Sexo inválido: ${String(data.sex)}`);
  const id = addCitizen(world);
  world.components.u8.active![idNumber(id)] = 0;
  world.citizens.set(id, { id, status: 'inactive', ...structuredClone(data), backstory: [], ancestor: true });
  return id;
}

/** Fija la madre y el padre de una persona (030 R-004). La madre es F y el padre M, ambos existentes y distintos del hijo. */
export function setParents(world: World, childId: EntityId, motherId?: EntityId, fatherId?: EntityId): void {
  const child = world.citizens.get(childId);
  if (!child) throw new Error(`No existe el ciudadano ${childId}`);
  const check = (id: EntityId | undefined, sex: 'F' | 'M', role: string) => {
    if (id === undefined) return;
    const p = world.citizens.get(id);
    if (!p || id === childId) throw new Error(`${role} inválido para ${childId}: ${id}`);
    if (p.sex !== sex) throw new Error(`${role} de ${childId} debe ser ${sex}`);
  };
  check(motherId, 'F', 'Madre');
  check(fatherId, 'M', 'Padre');
  if (motherId !== undefined) child.motherId = motherId;
  if (fatherId !== undefined) child.fatherId = fatherId;
}

/** Fecha de fundación de un lugar u organización (030 §3), siempre anterior al presente del mundo. */
export function setFoundedAt(world: World, id: EntityId, at: WorldMinute): void {
  if (!Number.isSafeInteger(at) || at >= world.now) throw new RangeError(`Fecha de fundación inválida: ${at}`);
  const kind = idKind(id);
  const entity = kind === 'PLC' ? world.places.get(id) : kind === 'ORG' ? world.organizations.get(id) : undefined;
  if (!entity) throw new Error(`Solo lugares y organizaciones tienen fundación: ${id}`);
  entity.foundedAt = at;
}
