// Órdenes de control y cerrojo del escritor (spec 027 R-001; tabla control_commands).
// En M0 solo la CLI encola órdenes (decisión del usuario, bloque E); la API lo revisará en M5.
import type { Db } from './db.ts';

export const CONTROL_COMMANDS = ['pause', 'resume', 'speed', 'step', 'stop'] as const;
export type ControlCommandName = (typeof CONTROL_COMMANDS)[number];

export interface ControlCommand {
  id: number;
  cmd: string;
  arg: string | null;
  createdAt: string;
}

/** `done`: 0 pendiente, 1 aplicada, -1 rechazada. */
export function enqueueCommand(db: Db, cmd: ControlCommandName, arg: string | null, createdAt: string): number {
  const r = db
    .prepare('INSERT INTO control_commands (cmd, arg, created_at, done) VALUES (?, ?, ?, 0)')
    .run(cmd, arg, createdAt);
  return Number(r.lastInsertRowid);
}

export function pendingCommands(db: Db): ControlCommand[] {
  const rows = db.prepare('SELECT id, cmd, arg, created_at FROM control_commands WHERE done = 0 ORDER BY id').all() as {
    id: number;
    cmd: string;
    arg: string | null;
    created_at: string;
  }[];
  return rows.map((r) => ({ id: r.id, cmd: r.cmd, arg: r.arg, createdAt: r.created_at }));
}

export function finishCommand(db: Db, id: number, ok: boolean): void {
  db.prepare('UPDATE control_commands SET done = ? WHERE id = ?').run(ok ? 1 : -1, id);
}

/** PID del proceso que tiene el cerrojo de escritor, o null. */
export function writerLock(db: Db): number | null {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'writer_pid'").get() as { value: string } | undefined;
  return row ? Number(row.value) : null;
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
};

/**
 * R-001: un solo escritor por mundo. Toma el cerrojo si está libre o si su dueño ya no existe
 * (un proceso que murió en seco no lo libera). Lanza si otro proceso vivo lo tiene.
 */
export function acquireWriterLock(db: Db, pid = process.pid): void {
  db.transaction(() => {
    const holder = writerLock(db);
    if (holder !== null && holder !== pid && alive(holder)) {
      throw new Error(`Otro proceso (PID ${holder}) está escribiendo en este mundo`);
    }
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('writer_pid', ?)").run(String(pid));
  }).immediate();
}

export function releaseWriterLock(db: Db, pid = process.pid): void {
  db.prepare("DELETE FROM meta WHERE key = 'writer_pid' AND value = ?").run(String(pid));
}
