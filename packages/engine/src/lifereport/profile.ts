// Perfil emergente (spec 020 R-006; visión §39): seis medidas calculadas desde la historia y la trayectoria, cada
// una con los hechos que la sustentan (CA-005). Sin base para calcularla, la medida queda en `null`, no en un valor
// inventado.
import type { WorldEvent } from '../events.ts';
import type { EntityId } from '../ids.ts';
import { DAY, YEAR, clamp01, lambdaOf, pointAt, r3 } from './types.ts';
import type { EmergentProfile, ProfileKey, ReportInput } from './types.ts';

const RECOVERY_DAYS = 60;
const AVERSIVE = -0.4;
const ids = (es: readonly WorldEvent[], n = 10) => es.map((e) => e.id).slice(-n);

export function emergentProfile(input: ReportInput): EmergentProfile {
  const { view, id, events, trajectory, now } = input;
  const me = view.citizens.get(id);
  const age = (now - (view.components.i32['demo.birthMinute']?.[Number(id.slice(4))] ?? 0)) / YEAR;
  const of = (...types: string[]) => events.filter((e) => types.includes(e.type) && e.participants.some((p) => p.id === id));
  const values = {} as Record<ProfileKey, number | null>;
  const basis = {} as Record<ProfileKey, EntityId[]>;
  const set = (k: ProfileKey, v: number | null, b: EntityId[]) => {
    values[k] = v !== null && b.length ? r3(clamp01(v)) : null;
    basis[k] = values[k] === null ? [] : b;
  };

  // Estabilidad laboral: despidos y cambios de empleo por año de vida laboral.
  const lost = of('JOB_LOST');
  const hired = of('JOB_HIRED', 'INFORMAL_WORK_STARTED');
  const workYears = Math.max(1, Math.min(age - 18, 40));
  set('jobStability', age >= 18 ? 1 - (lost.length + Math.max(0, hired.length - 1)) / (workYears * 0.5) : null, ids([...lost, ...hired].sort(byId)));

  // Estabilidad de sus relaciones: lo que se forma frente a lo que se rompe o choca.
  const pos = [...of('RELATIONSHIP_STARTED', 'UNION_FORMED'), ...events.filter((e) => e.type === 'FRIENDSHIP_FORMED' && (e.payload as { a: string }).a === id)];
  const breaks = of('BREAKUP');
  const clashes = of('ARGUMENT', 'CONFRONTATION');
  const neg = breaks.length + 0.3 * clashes.length;
  set('relationshipStability', pos.length + neg > 0 ? pos.length / (pos.length + neg) : null, ids([...pos, ...breaks, ...clashes].sort(byId)));

  // Red social: vínculos con trato, sobre 10; la base son los hechos de esos vínculos y, para la familia, su hogar.
  const close = (me?.bonds ?? []).filter((b) => (b.familiarity ?? 0) > 0.3);
  const bondEvents = close.flatMap((b) => (b.events ?? []).slice(-1) as EntityId[]);
  const home = close.some((b) => b.labels?.includes('familia')) ? of('HOUSEHOLD_FORMED').map((e) => e.id) : [];
  set('socialNetwork', close.length / 10, [...new Set([...bondEvents, ...home])].sort().slice(-10));

  // Exposición a estresores: lo aversivo del último año.
  const lastYear = events.filter((e) => e.at >= now - 365 * DAY && lambdaOf(e) < 0 && e.participants.some((p) => p.id === id));
  set('stressorExposure', lastYear.length ? lastYear.reduce((s, e) => s - lambdaOf(e), 0) / 5 : null, ids(lastYear));

  // Rumbo económico: el cambio de dinero en su trayectoria, menos deudas e impagos.
  const year = trajectory.filter((p) => p.day >= Math.floor(now / DAY) - 365);
  const money = of('DEBT_TAKEN', 'PAYMENT_MISSED', 'DEBT_REPAID', 'JOB_LOST', 'JOB_HIRED').filter((e) => e.at >= now - 365 * DAY);
  const moneyBasis = money.length ? money : of('SALARY_PAID').slice(-3);
  if (year.length >= 2) {
    const first = year[0]!;
    const last = year.at(-1)!;
    // [M] Saturaba en 0 o 1 con el cambio lineal: los salarios mueven mucho el dinero de un día a otro.
    const change = Math.tanh((last.money - first.money) / Math.max(Math.abs(first.money), 2_000_000));
    const debts = money.filter((e) => e.type === 'DEBT_TAKEN').length;
    const missed = money.filter((e) => e.type === 'PAYMENT_MISSED').length;
    set('economicTrajectory', 0.5 + 0.4 * change - 0.05 * missed - 0.02 * debts, ids(moneyBasis));
  } else set('economicTrajectory', null, []);

  // Resiliencia: tras cada golpe, días hasta volver a su ánimo de antes (1 − días / 60), promediado.
  const recoveries: { e: WorldEvent; r: number }[] = [];
  const firstDay = trajectory[0]?.day ?? Infinity;
  for (const e of events) {
    if (lambdaOf(e) > AVERSIVE || !e.participants.some((p) => p.id === id)) continue;
    const d0 = Math.floor(e.at / DAY);
    if (d0 <= firstDay) continue;
    const before = trajectory.filter((p) => p.day <= d0 && p.day > d0 - 7);
    if (!before.length) continue;
    const base = before.reduce((s, p) => s + p.mood, 0) / before.length;
    let days: number | undefined;
    for (let k = 1; k <= RECOVERY_DAYS; k++) {
      const p = pointAt(trajectory, d0 + k);
      if (!p || p.day < d0 + k) break;
      if (p.mood >= base - 0.02) {
        days = k;
        break;
      }
    }
    if (days !== undefined) recoveries.push({ e, r: 1 - days / RECOVERY_DAYS });
    else if (Math.floor(now / DAY) - d0 >= RECOVERY_DAYS) recoveries.push({ e, r: 0 });
  }
  set('resilience', recoveries.length ? recoveries.reduce((s, x) => s + x.r, 0) / recoveries.length : null, ids(recoveries.map((x) => x.e)));
  return { values, basis };
}

const byId = (a: WorldEvent, b: WorldEvent) => (a.id < b.id ? -1 : 1);
