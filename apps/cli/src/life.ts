// `citizen:life CIT-…` (spec 020 R-007): el informe de vida en texto: etapas vividas y recordadas lado a lado, sus
// diferencias, los hechos que cambiaron su vida con su «¿por qué?» y el perfil que sale de su historia. Solo lee.
import { parseArgs } from 'node:util';
import { lifeReport, whyLines } from '@datas-world/engine';
import type { EntityId, LifeReport, ProfileKey, World, WorldEvent } from '@datas-world/engine';
import { WorldRepository, eventsById, openReadonly, queryEvents, trajectoryOf } from '@datas-world/persistence';
import type { Db } from '@datas-world/persistence';
import { DEFAULT_DB, UsageError, dayOf, nameOf, withDb, withNames } from './common.ts';
import type { Io } from './common.ts';

/** Los hechos de la persona y las muertes (de ellas, la familia la elige el informe), en orden de id. */
export function reportFor(world: World, db: Db, id: EntityId): LifeReport {
  const mine = queryEvents(db, { participant: id, limit: 1_000_000 });
  const deaths = queryEvents(db, { types: ['CITIZEN_DIED'], limit: 1_000_000 });
  const events: WorldEvent[] = [...new Map([...mine, ...deaths].map((e) => [e.id as string, e])).values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  const byId = new Map(events.map((e) => [e.id as string, e]));
  return lifeReport({
    view: world, id, events, trajectory: trajectoryOf(db, id), now: world.now,
    get: (x) => byId.get(x) ?? eventsById(db, [x as EntityId])[0], names: (s) => withNames(world, s),
  });
}

const THEME: Readonly<Record<string, string>> = {
  infancia: 'Infancia', adolescencia: 'Adolescencia', juventud: 'Juventud', vida_adulta: 'Vida adulta', trabajo: 'Trabajo', desempleo: 'Desempleo',
  jubilacion: 'Jubilación', pareja: 'En pareja', ruptura: 'Después de una ruptura', crianza: 'Criando hijos', duelo: 'Duelo', migracion: 'Migración',
};
const PROFILE: Readonly<Record<ProfileKey, string>> = {
  jobStability: 'Estabilidad laboral', relationshipStability: 'Estabilidad en sus relaciones', socialNetwork: 'Red social',
  stressorExposure: 'Golpes recibidos el último año', economicTrajectory: 'Rumbo económico', resilience: 'Resiliencia (recuperación del ánimo)',
};
const tone = (x: number) => (x <= -0.3 ? 'muy difícil' : x < -0.1 ? 'difícil' : x >= 0.3 ? 'muy buena' : x > 0.1 ? 'buena' : 'mezclada');
const pct = (x: number) => `${Math.round(x * 100)} %`;

export function lifeLines(world: World, r: LifeReport): string[] {
  const epoch = world.config.epoch;
  const out = [`Informe de vida de ${nameOf(world, r.citizenId as EntityId)} (${r.citizenId})`, '', 'Etapas: lo que pasó · cómo lo recuerda'];
  r.chapters.forEach((c, i) => {
    const mem = r.remembered.find((m) => Math.min(c.to ?? world.now, m.to ?? world.now) > Math.max(c.from, m.from));
    const cites = c.openedBy ?? c.events[0];
    out.push(`  ${i + 1}. ${dayOf(c.from, epoch)} ${THEME[c.theme] ?? c.theme}: ${tone(c.tone)} · ${mem ? `${THEME[mem.theme] ?? mem.theme}, ${tone(mem.tone)}` : 'no la cuenta'}${cites ? ` [${cites}]` : ''}`);
  });
  out.push('', 'Diferencias entre lo vivido y lo recordado');
  for (const d of r.divergences) out.push(`  ${d.chapter >= 0 ? `${d.chapter + 1}. ` : ''}${d.note}`);
  if (!r.divergences.length) out.push('  (ninguna)');
  out.push('', 'Lo que cambió su vida');
  for (const t of r.turningPoints) {
    const extra = [`${t.consequences} consecuencias`, ...(t.moodDelta !== undefined ? [`ánimo ${t.moodDelta > 0 ? '+' : ''}${Math.round(t.moodDelta * 100)} en 30 días`] : [])];
    out.push(`  [${t.event}] (${extra.join(', ')})`);
    for (const l of whyLines(t.why, (at) => dayOf(at, epoch))) out.push(`    ${l}`);
  }
  out.push('', 'Perfil que sale de su historia');
  for (const k of Object.keys(PROFILE) as ProfileKey[]) {
    const v = r.profile.values[k];
    out.push(`  ${PROFILE[k]}: ${v === null ? 'sin datos' : pct(v)}${r.profile.basis[k].length ? ` (por ${r.profile.basis[k].length} hechos: ${r.profile.basis[k].slice(-3).join(', ')})` : ''}`);
  }
  const t = r.trajectory;
  if (t.length >= 2) {
    const moods = t.map((p) => p.mood);
    out.push('', `Trayectoria: ${t.length} días · ánimo de ${pct(t[0]!.mood)} a ${pct(t.at(-1)!.mood)} (mínimo ${pct(Math.min(...moods))}) · dinero de ${t[0]!.money} a ${t.at(-1)!.money}`);
  }
  return out;
}

export function citizenLife(args: string[], io: Io): void {
  const { values: v, positionals } = parseArgs({ args, allowPositionals: true, options: { db: { type: 'string', default: DEFAULT_DB } } });
  const id = positionals[0] as EntityId | undefined;
  if (!id || !/^CIT-\d+$/.test(id)) throw new UsageError('Uso: citizen:life CIT-000123');
  withDb(openReadonly(v.db), (db) => {
    const world = new WorldRepository(db).loadWorld();
    if (!world.citizens.get(id)) throw new UsageError(`No existe ${id}`);
    for (const l of lifeLines(world, reportFor(world, db, id))) io.out(l);
  });
}
