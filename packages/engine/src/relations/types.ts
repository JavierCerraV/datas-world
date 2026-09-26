// Tipos y parámetros de la red relacional (spec 037 §3, §8).

/** Tipo de relación "A <tipo> B" (037 §3): comparación, jerarquía, causal y temporal van en pares inversos. */
export type RelationType =
  | 'coordination'
  | 'distinction'
  | 'opposition'
  | 'more'
  | 'less'
  | 'contains'
  | 'part_of'
  | 'causes'
  | 'caused_by'
  | 'before'
  | 'after'
  | 'deictic';

/** Arista directa (enseñada, observada o derivada y consolidada). */
export interface Relation {
  a: string;
  b: string;
  t: RelationType;
  /** Fuerza [0,1]. */
  s: number;
  /** Clave relacional: solo participa en ese contexto (R-005). */
  crel?: string;
  /** Clave funcional aprendida: en ese contexto transforma del todo (R-004). */
  cfunc?: string;
  o: 'taught' | 'derived_stored' | 'observed';
  /** Eventos de origen (019), los 3 últimos. */
  src: string[];
  at: number;
}

/** Red de una persona (`Citizen.network`). `pruned` cuenta las aristas podadas (INV-004). */
export interface RelationalNetwork {
  e: Relation[];
  pruned: number;
}

/** Relación derivada desde un estímulo: tipo compuesto, fuerza, pasos de derivación y camino. */
export interface Derived {
  to: string;
  t: RelationType;
  s: number;
  steps: number;
  /** Índices de las aristas del camino en `RelationalNetwork.e`. */
  path: number[];
  /** Todas las aristas del camino tienen la clave funcional del contexto (R-004). */
  cfunc: boolean;
}

export interface NetworkMetrics {
  coherence: number;
  complexity: number;
  derivationLevel: number;
  flexibility: number;
}

/** 037 §8 [M]. */
export const MAX_DEPTH = 3;
export const ATTENUATION = 0.7;
export const COMP_FACTOR = 1.5;
export const CFUNC_DEFAULT = 0.5;
export const MAX_RELATIONS = 512;

export const emptyNetwork = (): RelationalNetwork => ({ e: [], pruned: 0 });
