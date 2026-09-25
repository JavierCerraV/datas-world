// Utilidades compartidas por los comandos de la CLI.
import { formatDate, toCalendar } from '@datas-world/engine';
import type { EntityId, World } from '@datas-world/engine';
import { closeDb } from '@datas-world/persistence';
import type { Db } from '@datas-world/persistence';

export interface Io {
  out(line: string): void;
  err(line: string): void;
  /** Marca de tiempo real para `control_commands.created_at` (fuera del motor). */
  now(): string;
}

export const DEFAULT_DB = 'data/world.db';

export class UsageError extends Error {}

export const toInt = (name: string, v: string | undefined, min = 0): number => {
  const n = Number(v);
  if (v === undefined || !Number.isSafeInteger(n) || n < min)
    throw new UsageError(`--${name} debe ser un entero ≥ ${min}`);
  return n;
};

export function withDb<T>(db: Db, fn: (db: Db) => T): T {
  try {
    return fn(db);
  } finally {
    closeDb(db);
  }
}

/** "AAAA-MM-DD hh:mm" de un minuto del mundo. */
export const dateOf = (minute: number, epoch: string): string => {
  const c = toCalendar(minute, epoch);
  return `${formatDate(c)} ${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`;
};

/** "AAAA-MM-DD" de un minuto del mundo. */
export const dayOf = (minute: number, epoch: string): string => formatDate(toCalendar(minute, epoch));

/** Nombre legible de una entidad del mundo, o su id si no tiene. */
export function nameOf(world: World, id: string): string {
  const c = world.citizens.get(id as EntityId);
  if (c?.name) return `${c.name.given} ${c.name.family.join(' ')}`;
  return world.places.get(id as EntityId)?.name ?? world.organizations.get(id as EntityId)?.name ?? id;
}

/** Sustituye los ids de un texto (`CIT-000123`, `PLC-0040`, `ORG-0012`) por nombres. */
export const withNames = (world: World, text: string): string =>
  text.replace(/\b(CIT|PLC|ORG)-\d+\b/g, (id) => nameOf(world, id));
