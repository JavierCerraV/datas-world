// Tipos de la capa de instrumentos (spec 045 §3), en su parte de cálculo. La ingesta, la biblioteca y las tablas
// viven fuera del motor (API, pasarela 026, persistencia 027).
import type { EntityId } from '../ids.ts';

export interface InstrumentOption {
  label: string;
  value: number;
}

export interface InstrumentItem {
  n: number;
  text: string;
  options: InstrumentOption[];
  reversed: boolean;
  /** Indicadores del motor que responden el ítem, con su peso (negativo = en contra). Vacío = «sin base en el motor». */
  mapping: { indicator: string; weight: number }[];
  page: number | null;
}

export interface Cutoff {
  min: number;
  max: number;
  label: string;
  severity: 0 | 1 | 2 | 3 | 4;
}

export interface Instrument {
  id: string;
  name: string;
  acronym: string;
  construct: string;
  instructions: string;
  /** Ventana temporal en días («las últimas 2 semanas» → 14); `null` = el estado actual. */
  recallDays: number | null;
  items: InstrumentItem[];
  scoring: { method: 'sum' | 'mean'; subscales?: { name: string; items: number[] }[] };
  cutoffs: Cutoff[];
  minAge: number;
  status: 'extraido' | 'revisado' | 'retirado';
  version: number;
}

/** A quién se aplica (R-007). */
export type Selection =
  | { kind: 'todos' }
  | { kind: 'azar'; n: number; strata?: string[] }
  | { kind: 'seleccionados'; citizens: EntityId[]; from?: string }
  | { kind: 'individual'; citizen: EntityId };

export type ExclusionReason = 'menor' | 'fallecido' | 'no_existe';

/** Persona candidata a una aplicación, con sus variables de agrupación ya calculadas por quien llama. */
export interface Candidate {
  id: EntityId;
  age: number;
  alive: boolean;
  /** Variables para estratificar o agrupar: `{ sexo: 'F', edad: '30-39', barrio: 'La Esperanza' }`. */
  vars: Readonly<Record<string, string>>;
}

export interface ResolvedSelection {
  resolved: EntityId[];
  excluded: { citizen: EntityId; reason: ExclusionReason }[];
}

export interface Answer {
  n: number;
  /** `null` si el ítem no tiene base en el motor: no puntúa. */
  value: number | null;
  basis: { indicator: string; value: number }[];
  /** Intensidad latente en [0,1] antes de elegir la opción (para el «¿por qué respondió así?»). */
  intensity: number | null;
}

export interface ResponseResult {
  answers: Answer[];
  score: number;
  subscores?: Record<string, number>;
  category: string;
  style: { acquiescence: number; desirability: number; noise: number };
}
