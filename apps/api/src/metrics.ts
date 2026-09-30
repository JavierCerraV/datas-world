// Métricas del mundo y exportación (spec 022 R-010, R-011): por día, el ánimo y el estrés medios con su desviación y
// la mediana del dinero (de la trayectoria, 020 R-001), los eventos por tipo, y las alertas de degeneración; y los CSV
// de la trayectoria y del registro, en streaming, para analizar fuera. Solo lee.
import { Readable } from 'node:stream';
import { MINUTES_PER_DAY } from '@datas-world/engine';
import type { World } from '@datas-world/engine';
import type { FastifyInstance } from 'fastify';
import type { WorldReader } from './reader.ts';
import { dateOf } from './views.ts';

export interface DayMetrics { day: number; date: string; n: number; mood: number; moodSd: number; stress: number; stressSd: number; money: number; saturated: number }
export interface Alert { metric: string; kind: 'sin_variacion' | 'saturacion' | 'crecimiento'; note: string }
export interface Metrics { days: DayMetrics[]; events: Record<string, number[]>; alerts: Alert[] }

/** [M] Umbrales de las alertas (022 §8). */
export const ALERTS = Object.freeze({ flatSd: 0.01, saturated: 0.5, growthDays: 30 });

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const sd = (xs: readonly number[], m: number) => Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length));
const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : 0;
};

/** Una serie que sube todos los días de los últimos `n`. */
const growing = (xs: readonly number[], n: number) => xs.length > n && xs.slice(-n - 1).every((x, i, a) => i === 0 || x > a[i - 1]!);

/**
 * R-010: las métricas por día y sus alertas, desde las filas de la trayectoria y el recuento de eventos por día y tipo.
 * Pura, para probarla sin base.
 */
export function metricsFrom(
  rows: readonly { day: number; mood: number; stress: number; money: number }[], counts: readonly { day: number; type: string; n: number }[], dateOfDay: (day: number) => string,
): Metrics {
  const byDay = new Map<number, typeof rows[number][]>();
  for (const r of rows) (byDay.get(r.day) ?? byDay.set(r.day, []).get(r.day)!).push(r);
  const days = [...byDay.keys()].sort((a, b) => a - b).map((day): DayMetrics => {
    const xs = byDay.get(day)!;
    const mood = xs.reduce((s, x) => s + x.mood, 0) / xs.length;
    const stress = xs.reduce((s, x) => s + x.stress, 0) / xs.length;
    const saturated = xs.filter((x) => x.mood <= 0.01 || x.mood >= 0.99 || x.stress <= 0.01 || x.stress >= 0.99).length / xs.length;
    return {
      day, date: dateOfDay(day), n: xs.length, mood: r3(mood), moodSd: r3(sd(xs.map((x) => x.mood), mood)), stress: r3(stress),
      stressSd: r3(sd(xs.map((x) => x.stress), stress)), money: Math.round(median(xs.map((x) => x.money))), saturated: r3(saturated),
    };
  });
  const index = new Map(days.map((d, i) => [d.day, i]));
  const events: Record<string, number[]> = {};
  for (const c of counts) {
    const i = index.get(c.day);
    if (i === undefined) continue;
    (events[c.type] ??= new Array<number>(days.length).fill(0))[i] = c.n;
  }
  const alerts: Alert[] = [];
  const last = days.at(-1);
  if (last && last.n > 1) {
    if (last.moodSd < ALERTS.flatSd) alerts.push({ metric: 'animo', kind: 'sin_variacion', note: `Todos tienen casi el mismo ánimo (desviación ${last.moodSd}).` });
    if (last.stressSd < ALERTS.flatSd) alerts.push({ metric: 'estres', kind: 'sin_variacion', note: `Todos tienen casi el mismo estrés (desviación ${last.stressSd}).` });
    if (last.saturated > ALERTS.saturated) alerts.push({ metric: 'animo_estres', kind: 'saturacion', note: `${Math.round(last.saturated * 100)} % de las personas tiene el ánimo o el estrés pegado a 0 o a 1.` });
  }
  const series: [string, number[]][] = [['dinero', days.map((d) => d.money)], ...Object.entries(events).map(([t, xs]): [string, number[]] => [`eventos:${t}`, xs])];
  for (const [name, xs] of series) if (growing(xs, ALERTS.growthDays)) alerts.push({ metric: name, kind: 'crecimiento', note: `«${name}» lleva ${ALERTS.growthDays} días subiendo sin parar.` });
  return { days, events, alerts };
}

const csv = (v: unknown) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function registerMetricsRoutes(app: FastifyInstance, reader: WorldReader): void {
  const hasTrajectory = () => !!reader.db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'trajectory'").get();
  app.get('/api/metrics', async () => {
    const w: World = reader.world;
    const rows = hasTrajectory() ? (reader.db.prepare('SELECT day, mood, stress, money FROM trajectory ORDER BY day, citizen_id').all() as { day: number; mood: number; stress: number; money: number }[]) : [];
    // La fila de trayectoria del día d se guarda a las 00:00 del día d: es el cierre del día d − 1. Cada punto lleva la
    // fecha y los eventos de ese día cerrado (los del día d, recién empezado, estarían casi vacíos).
    const counts = reader.db.prepare('SELECT CAST(at / ? AS INTEGER) + 1 AS day, type, COUNT(*) AS n FROM events WHERE at >= 0 GROUP BY day, type ORDER BY day, type').all(MINUTES_PER_DAY) as { day: number; type: string; n: number }[];
    return metricsFrom(rows, counts, (d) => dateOf(w, Math.max(0, d - 1) * MINUTES_PER_DAY).slice(0, 10));
  });

  // R-011: CSV en streaming (el registro de un año puede tener cientos de miles de filas).
  app.get('/api/export/trajectory.csv', async (_req, reply) => {
    const it = hasTrajectory() ? reader.db.prepare('SELECT citizen_id, day, mood, stress, money, sleep_debt FROM trajectory ORDER BY day, citizen_id').iterate() : [][Symbol.iterator]();
    function* lines() {
      yield 'citizen_id,day,mood,stress,money,sleep_debt\n';
      for (const r of it as Iterable<{ citizen_id: number; day: number; mood: number; stress: number; money: number; sleep_debt: number }>)
        yield `CIT-${String(r.citizen_id).padStart(6, '0')},${r.day},${r.mood},${r.stress},${r.money},${r.sleep_debt}\n`;
    }
    return reply.type('text/csv; charset=utf-8').header('content-disposition', 'attachment; filename="trayectoria.csv"').send(Readable.from(lines()));
  });
  app.get('/api/export/events.csv', async (_req, reply) => {
    const events = reader.db.prepare('SELECT seq, id, type, at, payload, causes FROM events ORDER BY seq').iterate() as Iterable<{ seq: number; id: string; type: string; at: number; payload: string; causes: string }>;
    const parts = reader.db.prepare('SELECT entity_id FROM event_participants WHERE event_seq = ? ORDER BY entity_id');
    function* lines() {
      yield 'id,type,at,participants,payload,causes\n';
      for (const e of events) {
        const who = (parts.all(e.seq) as { entity_id: string }[]).map((p) => p.entity_id).join(' ');
        yield `${e.id},${e.type},${e.at},${csv(who)},${csv(e.payload)},${csv(e.causes)}\n`;
      }
    }
    return reply.type('text/csv; charset=utf-8').header('content-disposition', 'attachment; filename="eventos.csv"').send(Readable.from(lines()));
  });
}
