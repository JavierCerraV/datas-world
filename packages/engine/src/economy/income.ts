// Ingresos del día (spec 015 R-002) y caja de las organizaciones (R-007).
import { formatId, idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import type { Rng } from '../rng.ts';
import type { DayInfo } from '../routines/day.ts';
import type { WorldView } from '../simulation/system.ts';
import type { Organization } from '../world.ts';
import { REST, citizen } from './ledger.ts';
import type { PayCtx } from './ledger.ts';
import { quincena } from './rules.ts';

/** Sectores (CIIU) financiados por el Estado: administración pública, policía, educación, salud y cultura públicas [M]. */
const PUBLIC_SECTORS = new Set(['ciiu.8411', 'ciiu.8424', 'ciiu.8521', 'ciiu.8522', 'ciiu.8553', 'ciiu.8610', 'ciiu.9101']);

/** Sueldo mensual de un puesto (los de pago diario, del perfil prototipo, × 26 días). */
export const monthlyWage = (p: Organization['positions'][number]) => (p.wagePeriod === 'day' ? p.wage * 26 : p.wage);

/** Trabajadores formales: fila → organización y sueldo mensual, en orden de organización y puesto. */
export function formalWorkers(view: WorldView): Map<number, { orgId: EntityId; wage: number }> {
  const out = new Map<number, { orgId: EntityId; wage: number }>();
  for (const org of [...view.organizations.values()].sort((a, b) => (a.id < b.id ? -1 : 1)))
    for (const p of org.positions) if (p.holderId) out.set(idNumber(p.holderId), { orgId: org.id, wage: monthlyWage(p) });
  return out;
}

/**
 * R-007: ingresos diarios de cada organización. Las públicas reciben del resto del país lo que cuesta su nómina;
 * las privadas, ventas a clientes de fuera del municipio (demanda externa) por la nómina × U(lo, hi). Las ventas
 * a los vecinos llegan por sus propios pagos (alimentación, esparcimiento).
 */
export function orgRevenue(ctx: PayCtx, view: WorldView, rng: Rng): void {
  const O = ctx.P.orgs;
  for (const org of [...view.organizations.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (org.status !== 'active') continue;
    const payroll = org.positions.filter((p) => p.holderId).reduce((s, p) => s + monthlyWage(p), 0);
    if (payroll <= 0) continue;
    const factor = PUBLIC_SECTORS.has(org.sector) ? 1 : O.externalLo! + (O.externalHi! - O.externalLo!) * rng.fork(org.id).next();
    const account = { kind: 'org', id: org.id } as const;
    ctx.ledger.move(REST, account, Math.round((payroll / 30) * factor));
    // [M] Lo que pasa de `maxCashMonths` meses de nómina sale del municipio: pago a proveedores y utilidades de
    // los dueños (sin él, las tiendas acumularían todo lo que el pueblo gasta en comida).
    const excess = ctx.ledger.balance(account) - Math.round(payroll * O.maxCashMonths!);
    if (excess > 0) ctx.ledger.move(account, REST, excess);
  }
}

/** Ingreso mensual esperado de una persona (para los otros gastos del hogar, R-003): sueldo neto, informal o pensión. */
export function expectedIncome(ctx: PayCtx, view: WorldView, row: number, workers: Map<number, { wage: number }>): number {
  const w = workers.get(row);
  if (w) return quincena(ctx.P, w.wage, 1).net + quincena(ctx.P, w.wage, 2).net;
  const occ = view.citizens.get(formatId('CIT', row))?.occupation;
  const I = ctx.P.informal;
  let income = 0;
  if (occ?.kind === 'informal') income += ctx.P.minimumWage * I.meanSmmlv!;
  if (occ?.kind === 'independent') income += ctx.P.minimumWage * I.meanSmmlv! * I.independentFactor!;
  if ((view.components.u8['demo.pensioned']?.[row] ?? 0) === 1) income += ctx.P.minimumWage * ctx.P.pension.smmlv!;
  return Math.round(income);
}

/** R-002: quincena de los formales (días 15 y último del mes). Descuentos de ley al resto del país. */
export function payQuincena(ctx: PayCtx, half: 1 | 2, active: ReadonlySet<number>, workers: Map<number, { orgId: EntityId; wage: number }>): void {
  for (const [row, { orgId, wage }] of [...workers].sort((a, b) => a[0] - b[0])) {
    if (!active.has(row)) continue;
    const q = quincena(ctx.P, wage, half);
    const org = { kind: 'org', id: orgId } as const;
    ctx.ledger.move(org, citizen(row), q.net);
    ctx.ledger.move(org, REST, q.deductions);
    const id = formatId('CIT', row);
    ctx.events.push({
      type: 'SALARY_PAID',
      payload: { citizenId: id, orgId, net: q.net },
      participants: [{ id, role: 'empleado' }, { id: orgId, role: 'empleador' }],
      causes: [{ state: 'quincena', entity: orgId, value: half, weight: 1 }],
    });
  }
}

/**
 * R-002: ingreso del día trabajado de ayer para informales e independientes (lunes a sábado, sin festivos ni
 * enfermedad): SMMLV × `meanSmmlv` / `workDays`, × `independentFactor` si es independiente, con ruido lognormal
 * y "días malos" (`badDayP`, `badDayFactor`).
 */
export function payInformal(ctx: PayCtx, view: WorldView, yesterday: DayInfo, rows: readonly number[], rng: Rng): void {
  if (yesterday.restDay || yesterday.weekday > 5) return;
  const I = ctx.P.informal;
  const base = (ctx.P.minimumWage * I.meanSmmlv!) / I.workDays!;
  for (const row of rows) {
    const occ = view.citizens.get(formatId('CIT', row))?.occupation;
    if (occ?.kind !== 'informal' && occ?.kind !== 'independent') continue;
    if ((view.components.u8['health.acute']?.[row] ?? 0) > 0) continue;
    const r = rng.fork('informal').fork(row);
    const bad = r.chance(I.badDayP!);
    const noise = Math.exp(r.normal(0, I.sd!) - (I.sd! * I.sd!) / 2); // media 1
    const amount = Math.round(base * (occ.kind === 'independent' ? I.independentFactor! : 1) * noise * (bad ? I.badDayFactor! : 1));
    ctx.ledger.move(REST, citizen(row), amount);
  }
}

/** R-002: pensión mensual (último día del mes) desde el resto del país. */
export function payPensions(ctx: PayCtx, view: WorldView, rows: readonly number[]): void {
  const amount = Math.round(ctx.P.minimumWage * ctx.P.pension.smmlv!);
  for (const row of rows) if ((view.components.u8['demo.pensioned']?.[row] ?? 0) === 1) ctx.ledger.move(REST, citizen(row), amount);
}
