// Batería psicométrica (spec 045): instrumentos, corrección, indicadores, respuesta verdadera, disposición y muestra.
export { INSTRUMENTS, INSTRUMENT_IDS, optionsOf } from './instruments.ts';
export type { Cutoff, Instrument, InstrumentId, InstrumentItem } from './instruments.ts';
export { scoreInstrument } from './scoring.ts';
export type { Score } from './scoring.ts';
export { core, indicatorsOf } from './indicators.ts';
export type { IndicatorInput, Indicators } from './indicators.ts';
export { MEASURE_PARAMS, likert, satisfaction, truthfulResponses } from './response.ts';
export type { Truthful } from './response.ts';
export { CANDOR_PARAMS, dispose, drives } from './candor.ts';
export type { Disposed, Disposition } from './candor.ts';
export { AGE_GROUPS, N_SAMPLE, adults, selectSample } from './sample.ts';
export type { Participant } from './sample.ts';
