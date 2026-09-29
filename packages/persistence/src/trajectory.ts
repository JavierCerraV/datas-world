// Trayectoria diaria de cada persona (spec 020 R-001): ánimo, estrés, dinero y deuda de sueño, escritos con la
// instantánea diaria. Se deriva del estado; no es parte del mundo ni del stateHash (020 INV-003).
import { MINUTES_PER_DAY } from '@datas-world/engine';
import type { World } from '@datas-world/engine';
import type { Db } from './db.ts';

export interface DayPoint {
  day: number;
  mood: number;
  stress: number;
  money: number;
  sleepDebt: number;
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** Una fila por persona viva (sin antepasados fuera del mundo) para el día en curso. Idempotente. */
export function saveTrajectory(db: Db, world: World): void {
  const day = Math.floor(world.now / MINUTES_PER_DAY);
  const f = world.components.f32;
  const i = world.components.i32;
  const put = db.prepare('INSERT OR REPLACE INTO trajectory (citizen_id, day, mood, stress, money, sleep_debt) VALUES (?, ?, ?, ?, ?, ?)');
  for (const c of world.citizens.values()) {
    if (c.status !== 'active' || c.ancestor) continue;
    const row = Number(c.id.slice(4));
    put.run(row, day, round(f['state.mood']?.[row] ?? 0.5), round(f['state.stress']?.[row] ?? 0), i.money?.[row] ?? 0, i['state.sleepDebt']?.[row] ?? 0);
  }
}

/** La trayectoria de una persona, por día. */
export function trajectoryOf(db: Db, citizenId: string): DayPoint[] {
  // Una base de solo lectura anterior a la migración 003 no tiene la tabla: sin trayectoria.
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'trajectory'").get()) return [];
  const rows = db.prepare('SELECT day, mood, stress, money, sleep_debt FROM trajectory WHERE citizen_id = ? ORDER BY day').all(Number(citizenId.slice(4))) as
    { day: number; mood: number; stress: number; money: number; sleep_debt: number }[];
  return rows.map((r) => ({ day: r.day, mood: r.mood, stress: r.stress, money: r.money, sleepDebt: r.sleep_debt }));
}

/** Bytes aproximados de la trayectoria guardada (filas × 20 B). */
export const trajectoryRows = (db: Db): number => (db.prepare('SELECT COUNT(*) AS n FROM trajectory').get() as { n: number }).n;
