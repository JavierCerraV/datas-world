// Libro de cuentas de una corrida del sistema de economía: lleva los saldos al día dentro de la corrida (para
// que varios pagos seguidos vean el saldo actualizado) y convierte cada movimiento en un parche `transfer`
// (015 R-006). También resuelve el déficit en el orden de R-004.
import type { CauseRef } from '../events.ts';
import { formatId, idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import type { Account, Patch, SystemEvent, WorldView } from '../simulation/system.ts';
import type { Debt, Household } from '../world.ts';
import type { EconomyParams } from './params.ts';
import { loanTerms } from './rules.ts';

const key = (a: Account) => (a.kind === 'citizen' ? `c${a.row}` : a.kind === 'rest' ? 'rest' : `${a.kind}:${a.id}`);

export class Ledger {
  readonly patches: Patch[] = [];
  #balances = new Map<string, number>();
  readonly view: WorldView;
  constructor(view: WorldView) {
    this.view = view;
  }

  balance(a: Account): number {
    const k = key(a);
    if (this.#balances.has(k)) return this.#balances.get(k)!;
    const v = this.view;
    const b =
      a.kind === 'citizen'
        ? (v.components.i32.money?.[a.row] ?? 0)
        : a.kind === 'household'
          ? (v.households.get(a.id)?.savings ?? 0)
          : a.kind === 'org'
            ? (v.organizations.get(a.id)?.cash ?? 0)
            : (v.accounts?.restOfCountry ?? 0);
    this.#balances.set(k, b);
    return b;
  }

  /** Mueve `amount` (entero ≥ 0) de una cuenta a otra. */
  move(from: Account, to: Account, amount: number): void {
    if (amount <= 0) return;
    this.#balances.set(key(from), this.balance(from) - amount);
    this.#balances.set(key(to), this.balance(to) + amount);
    this.patches.push({ op: 'transfer', from, to, amount });
  }
}

export const citizen = (row: number): Account => ({ kind: 'citizen', row });
export const REST: Account = { kind: 'rest' };

/** Estado compartido de los pagos del día: deudas por persona (copias que se escriben al final) y eventos. */
export interface PayCtx {
  ledger: Ledger;
  P: EconomyParams;
  now: number;
  events: SystemEvent[];
  debts: Map<number, Debt[]>;
  /** Filas con deudas cambiadas hoy (para el parche de entidad). */
  changed: Set<number>;
  /** Sueldo mensual formal de cada fila (0 si no tiene empleo formal). */
  wageOf: (row: number) => number;
  /** Filas que recibieron un préstamo del gota a gota hoy (para la emoción, 010). */
  gotaToday: Set<number>;
}

export function debtsOf(ctx: PayCtx, row: number): Debt[] {
  if (!ctx.debts.has(row)) {
    const own = ctx.ledger.view.citizens.get(formatId('CIT', row))?.debts ?? [];
    ctx.debts.set(row, own.map((d) => ({ ...d })));
  }
  return ctx.debts.get(row)!;
}

const outstanding = (ds: readonly Debt[], creditor: Debt['creditor']) =>
  ds.filter((d) => d.creditor === creditor).reduce((s, d) => s + d.balance, 0);

/** R-004, pasos 3 y 4: pide un préstamo al banco (con empleo formal) o al gota a gota, dentro de su tope. */
function borrow(ctx: PayCtx, row: number, shortfall: number, concept: string): boolean {
  const { P } = ctx;
  const ds = debtsOf(ctx, row);
  const wage = ctx.wageOf(row);
  const id = formatId('CIT', row);
  for (const kind of ['banco', 'gota_a_gota'] as const) {
    if (kind === 'banco' && wage <= 0) continue;
    const t = loanTerms(P, kind, shortfall);
    const cap = kind === 'banco' ? P.credit.bankMaxWages! * wage : P.credit.gotaMax!;
    if (outstanding(ds, kind) + t.total > cap) continue;
    const n = ds.length + 1;
    ds.push({
      id: `${id}/D${String(n).padStart(2, '0')}`,
      creditor: kind,
      principal: t.principal,
      balance: t.total,
      monthlyRate: kind === 'banco' ? P.credit.bankRate! : P.credit.gotaRate!,
      installment: t.installment,
      period: kind === 'banco' ? 'month' : 'day',
      startAt: ctx.now,
      ...(kind === 'banco' ? { dueDay: P.days.bankDue! } : {}),
      missed: 0,
    });
    ctx.changed.add(row);
    ctx.ledger.move(REST, citizen(row), t.principal);
    if (kind === 'gota_a_gota') ctx.gotaToday.add(row);
    ctx.events.push({
      type: 'DEBT_TAKEN',
      payload: { citizenId: id, creditor: kind, amount: t.principal, monthlyRate: kind === 'banco' ? P.credit.bankRate! : P.credit.gotaRate! },
      participants: [{ id, role: 'deudor' }],
      causes: [
        { state: 'deficit', entity: id, value: shortfall, weight: 0.7 },
        { state: `gasto.${concept}`, entity: id, weight: 0.3 },
      ],
    });
    return true;
  }
  return false;
}

/**
 * Paga `amount` a `to` con el dinero de las personas `payers` (en su orden), después con el ahorro del hogar y,
 * si falta, con un préstamo del primer pagador que lo consiga (R-004). Devuelve lo que no se pudo pagar (0 = pagado).
 */
export function payWithChain(
  ctx: PayCtx,
  payers: readonly number[],
  household: Pick<Household, 'id'> | undefined,
  amount: number,
  to: Account,
  concept: string,
  allowCredit = true,
): number {
  const L = ctx.ledger;
  let due = amount;
  for (const row of payers) {
    if (due <= 0) break;
    const take = Math.min(due, Math.max(0, L.balance(citizen(row))));
    L.move(citizen(row), to, take);
    due -= take;
  }
  if (due > 0 && household) {
    const h: Account = { kind: 'household', id: household.id };
    const take = Math.min(due, Math.max(0, L.balance(h)));
    L.move(h, to, take);
    due -= take;
  }
  for (const row of allowCredit ? payers : []) {
    if (due <= 0) break;
    if (!borrow(ctx, row, due, concept)) continue;
    const take = Math.min(due, Math.max(0, L.balance(citizen(row))));
    L.move(citizen(row), to, take);
    due -= take;
  }
  return due;
}

/** Evento de impago (R-004, paso 5) y, si es el arriendo, `RENT_LATE` (008 CA-004). */
export function missed(ctx: PayCtx, payer: EntityId, concept: string, amount: number, causes: CauseRef[]): void {
  ctx.events.push({ type: 'PAYMENT_MISSED', payload: { payerId: payer, concept, amount }, participants: [{ id: payer, role: 'pagador' }], causes });
  if (concept === 'arriendo')
    ctx.events.push({ type: 'RENT_LATE', payload: { householdId: payer, amount }, participants: [{ id: payer, role: 'hogar' }], causes });
}

export const rowOf = (id: EntityId) => idNumber(id);
