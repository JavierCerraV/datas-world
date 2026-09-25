// Sistemas del trabajo (spec 006 R-005 a R-007; prototipo `arriveWork` y `fire`).
import { formatId, idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import type { Rng } from '../rng.ts';
import type { Patch, System, SystemOutput, TickCtx, WorldView } from '../simulation/system.ts';
import { JobChanges, workParams } from './jobs.ts';

const DAY = 1440;
/** Discapacidad para caminar o para el autocuidado (031): limita el trabajo (bits de `health.disability`). */
const LIMITS_WORK = 4 | 32;

/**
 * Retrasos y advertencias (R-005, R-006; CA-004). Cada `ARRIVED_LATE` a su trabajo que pasa la tolerancia es una
 * llamada de atención (`JOB_WARNING`) que lo cita como causa, salvo para el jefe (prototipo). Con `warnLimit`
 * retrasos en la ventana, despido (`JOB_LOST`) con todos ellos como causas.
 */
function lateStep(view: WorldView, ctx: TickCtx): SystemOutput {
  const i = view.components.i32;
  if (!i['work.lastLateEvt']) return {};
  const P = workParams(view.config.profile, view.config.epoch.slice(0, 10));
  const jobs = new JobChanges(view);
  const seen: Patch[] = [];
  for (const row of ctx.citizens) {
    const evt = i['work.lastLateEvt']![row]!;
    if (evt === 0 || evt === i['work.seenLateEvt']![row]) continue;
    seen.push({ op: 'set', type: 'i32', column: 'work.seenLateEvt', row, value: evt });
    const id = formatId('CIT', row);
    const c = view.citizens.get(id);
    const occ = c?.occupation;
    const minutes = i['work.lastLateMin']![row]!;
    if (occ?.kind !== 'formal' || minutes <= P.lateTolerance) continue;
    const pos = view.organizations.get(occ.orgId)?.positions.find((p) => p.id === occ.positionId);
    if (!pos || pos.level >= 1) continue; // el jefe no recibe llamadas de atención
    const eventId = formatId('EVT', evt);
    const lates = [...(c!.jobRecord?.lates ?? []).filter((l) => l.at > ctx.now - P.warnWindowDays * DAY).map((l) => ({ ...l })), { eventId, at: ctx.now, minutes }];
    jobs.events.push({
      type: 'JOB_WARNING',
      payload: { citizenId: id, orgId: occ.orgId, reason: 'retraso', count: lates.length },
      participants: [{ id, role: 'empleado' }, { id: occ.orgId, role: 'empleador' }],
      causes: [{ event: eventId, weight: 1 }],
    });
    if (lates.length >= P.warnLimit) jobs.fire(row, 'retrasos', lates.map((l) => ({ event: l.eventId, weight: Math.round((1 / lates.length) * 100) / 100 })));
    else jobs.patches.push({ op: 'entity', id, fields: { jobRecord: { lates } } });
  }
  return { patches: [...seen, ...jobs.finish()], events: jobs.events };
}

/**
 * Mercado de trabajo del día (R-006, R-007; CA-005, CA-006):
 * - crisis: con la caja en negativo `crisisDays` días seguidos, la organización despide a quien ocupa su último
 *   puesto no directivo, y vuelve a contar desde `crisisDays − crisisStepDays`;
 * - vacantes: una organización sin crisis y con caja no negativa cubre cada puesto libre con probabilidad
 *   `hireDailyP` al día, con un desempleado de 18 a 64 años sin discapacidad que limite el trabajo, al azar
 *   (los requisitos y la red de contactos, 012, llegan en M3).
 */
function marketStep(view: WorldView, ctx: TickCtx, rng: Rng): SystemOutput {
  const P = workParams(view.config.profile, view.config.epoch.slice(0, 10));
  const jobs = new JobChanges(view);
  const orgPatches: Patch[] = [];
  const active = new Set(ctx.citizens);
  const i32 = view.components.i32;
  const ageOf = (row: number) => (ctx.now - (i32['demo.birthMinute']?.[row] ?? 0)) / (365.25 * DAY);
  const pool = ctx.citizens.filter((row) => {
    const occ = view.citizens.get(formatId('CIT', row))?.occupation;
    const age = ageOf(row);
    return occ?.kind === 'none' && occ.reason === 'unemployed' && age >= 18 && age < 65 && ((view.components.u8['health.disability']?.[row] ?? 0) & LIMITS_WORK) === 0;
  });
  const taken = new Set<number>();
  for (const org of [...view.organizations.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (org.status !== 'active') continue;
    const cash = org.cash;
    // Crisis de caja (solo en los mundos con economía).
    let crisis = org.crisisDays ?? 0;
    if (cash !== undefined) {
      crisis = cash < 0 ? crisis + 1 : 0;
      if (crisis >= P.crisisDays) {
        const victim = [...jobs.positionsOf(org.id)].reverse().find((p) => p.holderId && p.level === 0 && active.has(idNumber(p.holderId)));
        if (victim) jobs.fire(idNumber(victim.holderId!), 'crisis de la organización', [{ state: 'caja_negativa', entity: org.id, value: cash, weight: 1 }]);
        crisis = P.crisisDays - P.crisisStepDays;
      }
      if (crisis !== (org.crisisDays ?? 0)) orgPatches.push({ op: 'entity', id: org.id, fields: { crisisDays: crisis } });
    }
    if (crisis > 0 || (cash !== undefined && cash < 0)) continue;
    for (const pos of jobs.positionsOf(org.id)) {
      if (pos.holderId) continue;
      const r = rng.fork(org.id).fork(pos.id);
      if (!r.chance(P.hireDailyP)) continue;
      const candidates = pool.filter((row) => !taken.has(row));
      if (candidates.length === 0) break;
      const row = candidates[r.int(0, candidates.length - 1)]!;
      taken.add(row);
      jobs.hire(row, org.id, pos.id, [
        { state: 'vacante', entity: org.id, weight: 0.6 },
        { state: 'busqueda_empleo', entity: formatId('CIT', row) as EntityId, weight: 0.4 },
      ]);
    }
  }
  // Los parches de caja van después de los de puestos: los dos son de la organización, en campos distintos.
  return { patches: [...jobs.finish(), ...orgPatches], events: jobs.events };
}

export const workLateSystem: System = {
  id: 'work.late',
  // Después de la movilidad (fase `actions`), que anota el retraso al llegar.
  phase: 'memory',
  order: 0,
  capability: 'mobility',
  cadence: 'tick',
  minLevel: 0,
  run: lateStep,
};

export const workMarketSystem: System = {
  id: 'work.market',
  // Después de la economía (orden 0 de la misma fase), con la caja del día ya movida.
  phase: 'economy',
  order: 1,
  capability: 'economy',
  cadence: 'day',
  minLevel: 0,
  run: marketStep,
};

export const WORK_SYSTEMS = Object.freeze([workLateSystem, workMarketSystem]);
