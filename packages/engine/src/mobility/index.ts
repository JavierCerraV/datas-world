// Módulo `mobility` (spec 016; 004 R-003 a R-005): posición, viajes, entrada a los lugares y sistema.
export { MOBILITY_COLUMNS, MODES, defineMobilityColumns, homeOf, initMobility, modeCode } from './columns.ts';
export type { Mode } from './columns.ts';
export { enterRefusal, isOpen, occupancy, worksAt } from './enter.ts';
export { firstOfKind, metersBetween, networkOf, travelTo } from './network.ts';
export { mobilityParams } from './params.ts';
export type { MobilityParams } from './params.ts';
export { mobilitySystem } from './system.ts';
export { busWait, planTrip, travelMinutes, vehiclesOf } from './trip.ts';
export type { TripPlan } from './trip.ts';
export { placeFor, schoolOf, workplaceOf } from './where.ts';
