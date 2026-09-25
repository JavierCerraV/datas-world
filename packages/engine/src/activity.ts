// Actividad actual de cada persona (spec 011 §3): la escriben las rutinas y las decisiones (011, 017) y la leen
// las necesidades (010). Va en la columna `act.kind` (u8) con estos códigos, estables: se amplía al final.

export const ACTIVITY = Object.freeze({
  idle: 0,
  sleep: 1,
  eat: 2,
  work: 3,
  study: 4,
  commute: 5,
  leisure: 6,
  socialize: 7,
  chores: 8,
  shop: 9,
  exercise: 10,
  care: 11,
  job_search: 12,
  errands: 13,
  sick: 14,
  wash: 15,
} as const);
export type ActivityKind = keyof typeof ACTIVITY;

export const ACTIVITY_COLUMN = 'act.kind';
