// Instrumentos psicológicos (spec 045): indicadores, respuesta, selección y estadística.
export { INDICATORS, INDICATORS_VERSION, INDICATOR_PARAMS, indicatorValues, isIndicator } from './indicators.ts';
export type { IndicatorInput, IndicatorKey } from './indicators.ts';
export { RESPONSE_NOISE, answerInstrument, categoryOf, checkInstrument, responseRng, samplingRng, scoreOf } from './respond.ts';
export { ageGroup, candidatesOf, resolveSelection } from './select.ts';
export { cohenD, cronbachAlpha, describeScores, groupStats, pearson } from './stats.ts';
export type { Descriptive, GroupRow } from './stats.ts';
export type {
  Answer,
  Candidate,
  Cutoff,
  ExclusionReason,
  Instrument,
  InstrumentItem,
  InstrumentOption,
  ResolvedSelection,
  ResponseResult,
  Selection,
} from './types.ts';
