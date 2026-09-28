// API de la CLI. El proceso se lanza con main.ts; `run` se usa directamente en las pruebas.
export { DEFAULT_DB, USAGE, run, runAsync } from './commands.ts';
export { chatBattery } from './battery.ts';
export type { Io } from './commands.ts';
export { bench } from './bench.ts';
