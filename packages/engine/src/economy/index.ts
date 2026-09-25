// Módulo `economy` (spec 015): ingresos, gastos, ahorro, deudas y conservación del dinero.
export { ECONOMY_COLUMNS, defineEconomyColumns } from './columns.ts';
export { formalWorkers, monthlyWage } from './income.ts';
export { economyParams } from './params.ts';
export type { EconomyParams } from './params.ts';
export { copay, foodDaily, loanTerms, quincena, utilityBill } from './rules.ts';
export { economySystem, totalMoney } from './system.ts';
