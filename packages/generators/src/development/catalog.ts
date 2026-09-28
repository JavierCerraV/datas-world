// Catálogo `development_episodes` (spec 041 §3) en la forma que usa el generador. Llega ya validado (ADR-006).
import type { Catalog } from '../catalogs/schema.ts';

export type Stage = 'infancia' | 'escolar' | 'adolescencia' | 'adulto';
export const STAGES: readonly Stage[] = ['infancia', 'escolar', 'adolescencia', 'adulto'];

/** Etapa por edad (041 §3): 0–5, 6–11, 12–17 y 18+. */
export const stageOf = (age: number): Stage => (age < 6 ? 'infancia' : age < 12 ? 'escolar' : age < 18 ? 'adolescencia' : 'adulto');

export type Effect =
  | { op: 'pair'; stim: string; lambda: number; us?: string; social?: boolean }
  | { op: 'operant'; response: string; outcome: number }
  | { op: 'value'; stim: string; domain: string; s: number; lambda: number }
  | { op: 'teach'; a: string; b: string; t: 'coordination' | 'opposition' | 'part_of' | 'causes'; s: number };

export interface EpisodeDef {
  key: string;
  name: string;
  stage: Stage | 'cualquiera';
  weight: number;
  /** Quién interviene: un rol (`madre`, `par`…) o uno que se resuelve por persona (`progenitor`, `cuidador_principal`). */
  speaker: string;
  valence: -1 | 0 | 1;
  text: string;
  effects: Effect[];
  mods: { if: string; x: number }[];
  requires: string[];
  /** Hechos de la 030 que lo producen (sin sorteo): `TIPO` o `TIPO:clave`. */
  triggers: string[];
}

export function episodeDefs(c: Catalog): EpisodeDef[] {
  return c.entries.map((e) => {
    const a = (e.attrs ?? {}) as Record<string, unknown>;
    const trigger = a.trigger;
    return {
      key: e.key,
      name: e.name,
      stage: a.stage as EpisodeDef['stage'],
      weight: Number(a.weight ?? 0),
      speaker: String(a.speaker ?? 'ninguno'),
      valence: Number(a.valence ?? 0) as EpisodeDef['valence'],
      text: String(a.text ?? e.name),
      effects: (a.effects ?? []) as Effect[],
      mods: (a.mods ?? []) as EpisodeDef['mods'],
      requires: (a.requires ?? []) as string[],
      triggers: trigger === undefined ? [] : Array.isArray(trigger) ? (trigger as string[]) : [String(trigger)],
    };
  });
}
