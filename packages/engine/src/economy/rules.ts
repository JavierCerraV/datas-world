// Reglas de dinero de la spec 015, como funciones puras y en pesos enteros (R-001).
import type { EconomyParams } from './params.ts';

/**
 * R-002: quincena de un empleado formal (CA-004). Neto mensual = sueldo − salud − pensión (cada descuento
 * redondeado al peso), más el auxilio de transporte si gana hasta 2 salarios mínimos. Cada concepto se parte en
 * dos quincenas: la primera se lleva la mitad por abajo y la segunda el resto, así el mes cuadra al peso.
 */
export function quincena(P: EconomyParams, wageMonthly: number, half: 1 | 2): { net: number; deductions: number; allowance: number } {
  const split = (x: number) => (half === 1 ? Math.floor(x / 2) : x - Math.floor(x / 2));
  const deductionsMonthly = Math.round(wageMonthly * P.deductions.health!) + Math.round(wageMonthly * P.deductions.pension!);
  const allowanceMonthly = wageMonthly <= 2 * P.minimumWage ? P.transportAllowance : 0;
  const allowance = split(allowanceMonthly);
  return { net: split(wageMonthly - deductionsMonthly) + allowance, deductions: split(deductionsMonthly), allowance };
}

/**
 * R-003: servicios públicos del mes (CA-005). Tarifa plena = base × (personas / 3)^sizeExp; los estratos 1 a 3
 * pagan menos por el subsidio (`stratum.utilitySubsidy`) y el 5 y el 6 más por la contribución (Ley 142).
 */
export function utilityBill(P: EconomyParams, stratum: number, persons: number): number {
  const full = P.utilities.baseMonthly! * Math.pow(Math.max(1, persons) / 3, P.utilities.sizeExp!);
  const factor = stratum >= 5 ? 1 + (P.utilities[`contribution${stratum}`] ?? 0) : 1 - (P.subsidy[String(stratum)] ?? 0);
  return Math.round(full * factor);
}

/**
 * R-003: alimentación del día de un hogar, desde la línea de pobreza extrema por persona, con factor por estrato y
 * escala de equivalencia: un menor de 12 años cuenta `childWeight` (0,6) de un adulto [M].
 */
export function foodDaily(P: EconomyParams, stratum: number, adults: number, children = 0): number {
  const eq = adults + children * (P.food.childWeight ?? 1);
  return Math.round((P.food.perPersonMonthly! * (P.food[String(stratum)] ?? 1) * eq) / 30);
}

/**
 * R-003 [M]: otros gastos del hogar (vestuario, comunicaciones, educación, aseo, muebles…), una fracción
 * `other.share` de su ingreso mensual esperado, repartida por días (la ENPH los pone en ≈ 40 % del gasto).
 */
export const otherDaily = (P: EconomyParams, monthlyIncome: number): number => Math.round((P.other.share! * monthlyIncome) / 30);

/**
 * R-003: cuota moderadora de una consulta según el régimen (031 `health.insurance`: 0 sin afiliación,
 * 1 contributivo cotizante, 2 beneficiario, 3 subsidiado, 4 especial) y el ingreso del cotizante.
 */
export function copay(P: EconomyParams, insurance: number, wageMonthly: number): number {
  if (insurance === 3 || insurance === 4) return 0;
  if (insurance === 0) return P.health.uninsured!;
  if (wageMonthly > 5 * P.minimumWage) return P.health.copayHigh!;
  if (wageMonthly > 2 * P.minimumWage) return P.health.copayMid!;
  return P.health.copayLow!;
}

/** R-004: condiciones de un préstamo. Banco: cuota mensual de anualidad; gota a gota: cuota diaria, interés de un mes. */
export function loanTerms(P: EconomyParams, kind: 'banco' | 'gota_a_gota', shortfall: number): { principal: number; installment: number; total: number } {
  const C = P.credit;
  if (kind === 'banco') {
    const principal = Math.max(C.bankMin!, Math.ceil(shortfall / 100_000) * 100_000);
    const r = C.bankRate!;
    const n = C.bankMonths!;
    const installment = Math.ceil((principal * r) / (1 - Math.pow(1 + r, -n)));
    return { principal, installment, total: installment * n };
  }
  const principal = Math.max(C.gotaMin!, Math.ceil(shortfall / 50_000) * 50_000);
  const total = Math.round(principal * (1 + C.gotaRate!));
  return { principal, installment: Math.ceil(total / C.gotaDays!), total };
}
