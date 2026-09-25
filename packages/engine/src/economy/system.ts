// Sistema `economy` (spec 015): una vez al día, a medianoche, mueve el dinero del día con transferencias
// (R-006): ingresos de las organizaciones, quincenas, ingreso informal de ayer, pensiones, gastos del hogar,
// consultas, cuotas de las deudas y presión por deuda (R-005). Sin `economy.*` en el perfil, no hace nada.
import { daysFromCivil, toCalendar } from '../calendar.ts';
import { formatId } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import { emotionPatches } from '../needs/emotions.ts';
import type { Rng } from '../rng.ts';
import { dayInfo } from '../routines/day.ts';
import type { Account, Patch, System, SystemOutput, TickCtx, WorldView } from '../simulation/system.ts';
import type { Debt } from '../world.ts';
import { expectedIncome, formalWorkers, orgRevenue, payInformal, payPensions, payQuincena } from './income.ts';
import { Ledger, REST, citizen, debtsOf, missed, payWithChain } from './ledger.ts';
import type { PayCtx } from './ledger.ts';
import { economyParams } from './params.ts';
import { copay, foodDaily, otherDaily, utilityBill } from './rules.ts';

const DAY = 1440;
const YEAR = 365.25 * DAY;

function daysInMonth(year: number, month: number): number {
  const next = month === 12 ? daysFromCivil(year + 1, 1, 1) : daysFromCivil(year, month + 1, 1);
  return next - daysFromCivil(year, month, 1);
}

/** La tienda de barrio del distrito de la vivienda (o cualquiera), para la alimentación (R-003, R-007). */
function shopFor(view: WorldView): (dwelling: EntityId) => Account {
  const byDistrict = new Map<string, EntityId>();
  let any: EntityId | undefined;
  for (const org of [...view.organizations.values()].sort((a, b) => (a.id < b.id ? -1 : 1)))
    for (const pid of org.placeIds) {
      const place = view.places.get(pid);
      if (place?.kind !== 'comercio.tienda_barrio') continue;
      any ??= org.id;
      if (place.districtId && !byDistrict.has(place.districtId)) byDistrict.set(place.districtId, org.id);
    }
  return (dwelling) => {
    const d = view.places.get(dwelling)?.districtId;
    const org = (d && byDistrict.get(d)) || any;
    return org ? { kind: 'org', id: org } : REST;
  };
}

function step(view: WorldView, ctx: TickCtx, rng: Rng): SystemOutput {
  const P = economyParams(view.config.profile!, view.config.epoch.slice(0, 10));
  if (!P || !view.accounts) return {};
  const now = ctx.now;
  const cal = toCalendar(now, view.config.epoch, view.config.holidays);
  const lastDay = daysInMonth(cal.year, cal.month);
  const ledger = new Ledger(view);
  const workers = formalWorkers(view);
  const pc: PayCtx = {
    ledger,
    P,
    now,
    events: [],
    debts: new Map(),
    changed: new Set(),
    wageOf: (row) => workers.get(row)?.wage ?? 0,
    gotaToday: new Set(),
  };
  const active = new Set(ctx.citizens);
  const i32 = view.components.i32;
  const u8 = view.components.u8;
  const ageOf = (row: number) => (now - (i32['demo.birthMinute']?.[row] ?? 0)) / YEAR;
  const patches: Patch[] = [];

  // 1. Ingresos (R-002, R-007).
  orgRevenue(pc, view, rng.fork('orgs'));
  if (cal.day === 15 || cal.day === lastDay) payQuincena(pc, cal.day === 15 ? 1 : 2, active, workers);
  if (now > 0) payInformal(pc, view, dayInfo(view, now - 1), ctx.citizens, rng);
  if (cal.day === lastDay) payPensions(pc, view, ctx.citizens);

  // 2. Consultas por enfermedad aguda (R-003; 031): una por episodio, al empezar.
  const consulted: [number, number][] = [];
  for (const row of ctx.citizens) {
    const sick = (u8['health.acute']?.[row] ?? 0) > 0;
    const done = (u8['econ.consulted']?.[row] ?? 0) === 1;
    if (!sick && done) consulted.push([row, 0]);
    if (!sick || done) continue;
    consulted.push([row, 1]);
    const id = formatId('CIT', row);
    const h = view.households.get(view.citizens.get(id)?.householdId as EntityId);
    const payer = ageOf(row) >= 18 ? [row] : adultsOf(view, h?.memberIds ?? [], ledger, active, ageOf);
    const fee = copay(P, u8['health.insurance']?.[row] ?? 0, pc.wageOf(row));
    const due = payWithChain(pc, payer, h, fee, REST, 'salud');
    if (due > 0) missed(pc, id, 'salud', due, [{ state: 'saldo_insuficiente', entity: id, value: due, weight: 1 }]);
  }

  // 3. Gastos del hogar (R-003): alimentación diaria; arriendo, servicios y medicamentos en su día del mes.
  const shop = shopFor(view);
  for (const h of [...view.households.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const members = h.memberIds.map((m) => Number(m.slice(4))).filter((r) => active.has(r));
    if (members.length === 0) continue;
    const payers = adultsOf(view, h.memberIds, ledger, active, ageOf);
    const stratum = view.places.get(view.places.get(h.dwellingId)?.districtId as EntityId)?.stratum ?? 3;
    const children = members.filter((r) => ageOf(r) < 12).length;
    const income = members.reduce((s, r) => s + (ageOf(r) >= 18 ? expectedIncome(pc, view, r, workers) : 0), 0);
    const bills: [string, number, Account][] = [
      ['alimentacion', foodDaily(P, stratum, members.length - children, children), shop(h.dwellingId)],
      ['otros', otherDaily(P, income), shop(h.dwellingId)],
    ];
    if (cal.day === P.days.rent && (h.tenure === 'arriendo' || h.tenure === 'pagando') && (h.rent ?? 0) > 0) bills.push(['arriendo', h.rent!, REST]);
    if (cal.day === P.days.utilities) bills.push(['servicios', utilityBill(P, stratum, members.length), REST]);
    if (cal.day === P.days.meds) {
      const chronic = members.reduce((s, r) => s + (view.citizens.get(formatId('CIT', r))?.conditions?.length ?? 0), 0);
      if (chronic > 0) bills.push(['medicamentos', chronic * P.health.medsMonthly!, REST]);
    }
    for (const [concept, amount, to] of bills) {
      const due = payWithChain(pc, payers, h, amount, to, concept);
      const causes = [{ state: 'saldo_insuficiente', entity: h.id, value: due, weight: 1 }];
      if (due > 0) missed(pc, h.id, concept, due, causes);
      else if (concept === 'arriendo')
        pc.events.push({ type: 'RENT_PAID', payload: { householdId: h.id, amount }, participants: [{ id: h.id, role: 'hogar' }], causes: [{ state: 'tenencia', entity: h.id, weight: 1 }] });
    }
  }

  // 4. Cuotas de las deudas (R-004): el gota a gota cada día, el banco en su día del mes. Sin préstamos nuevos.
  for (const row of ctx.citizens) {
    const own = view.citizens.get(formatId('CIT', row))?.debts;
    if (!own?.length && !pc.debts.has(row)) continue;
    const ds = debtsOf(pc, row);
    const id = formatId('CIT', row);
    const h = view.households.get(view.citizens.get(id)?.householdId as EntityId);
    for (const d of ds) {
      if (d.balance <= 0 || d.startAt >= now) continue;
      if (d.period === 'month' && cal.day !== d.dueDay) continue;
      const amount = Math.min(d.installment, d.balance);
      const due = payWithChain(pc, [row], h, amount, REST, 'cuota', false);
      d.balance -= amount - due;
      pc.changed.add(row);
      if (due > 0) {
        // Cuotas atrasadas seguidas; el evento, en la primera y cada 30 (no un evento diario por deuda).
        d.missed += 1;
        if (d.missed === 1 || d.missed % 30 === 0)
          missed(pc, id, 'cuota', due, [{ state: `deuda.${d.creditor}`, entity: id, value: d.balance, weight: 1 }]);
      } else d.missed = 0;
    }
  }
  for (const row of [...pc.changed].sort((a, b) => a - b)) {
    const id = formatId('CIT', row);
    const ds = pc.debts.get(row)!;
    for (const d of ds.filter((x) => x.balance <= 0))
      pc.events.push({ type: 'DEBT_REPAID', payload: { citizenId: id, debtId: d.id }, participants: [{ id, role: 'deudor' }], causes: [{ state: 'cuotas_pagadas', entity: id, value: d.principal, weight: 1 }] });
    patches.push({ op: 'entity', id: id as EntityId, fields: { debts: ds.filter((x) => x.balance > 0) } });
  }

  // 5. Presión por deuda con histéresis (R-005) y emoción del gota a gota (010 R-005).
  const rows: number[] = [];
  const debt: number[] = [];
  const pressure: number[] = [];
  for (const row of ctx.citizens) {
    const ds: readonly Debt[] = pc.debts.get(row)?.filter((x) => x.balance > 0) ?? view.citizens.get(formatId('CIT', row))?.debts ?? [];
    const total = ds.reduce((s, d) => s + d.balance, 0);
    const was = (u8['econ.debtPressure']?.[row] ?? 0) === 1;
    rows.push(row);
    debt.push(total);
    pressure.push(total > P.credit.pressureEnter! || (was && total > P.credit.pressureExit!) ? 1 : 0);
  }
  patches.push({ op: 'setMany', type: 'i32', column: 'econ.debt', rows, values: debt });
  patches.push({ op: 'setMany', type: 'u8', column: 'econ.debtPressure', rows, values: pressure });
  if (consulted.length)
    patches.push({ op: 'setMany', type: 'u8', column: 'econ.consulted', rows: consulted.map((c) => c[0]), values: consulted.map((c) => c[1]) });
  if ('emo.fear' in view.components.f32)
    for (const row of [...pc.gotaToday].sort((a, b) => a - b)) patches.push(...emotionPatches(view, row, 'DEBT_TAKEN'));

  return { patches: [...ledger.patches, ...patches], events: pc.events };
}

/** Adultos activos del hogar que pagan, de más a menos saldo (y por fila para desempatar). */
function adultsOf(view: WorldView, memberIds: readonly EntityId[], ledger: Ledger, active: ReadonlySet<number>, ageOf: (row: number) => number): number[] {
  return memberIds
    .map((m) => Number(m.slice(4)))
    .filter((r) => active.has(r) && ageOf(r) >= 18)
    .sort((a, b) => ledger.balance(citizen(b)) - ledger.balance(citizen(a)) || a - b);
}

export const economySystem: System = {
  id: 'economy',
  phase: 'economy',
  order: 0,
  capability: 'economy',
  cadence: 'day',
  minLevel: 0,
  run: step,
};

/** Suma de todos los saldos del mundo (015 R-006, CA-001): personas, hogares, organizaciones y resto del país. */
export function totalMoney(view: WorldView): number {
  let s = view.accounts?.restOfCountry ?? 0;
  const money = view.components.i32.money;
  if (money) for (let row = 1; row < money.length; row++) s += money[row]!;
  for (const h of view.households.values()) s += h.savings ?? 0;
  for (const o of view.organizations.values()) s += o.cash ?? 0;
  return s;
}
