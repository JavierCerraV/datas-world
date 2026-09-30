// Respuestas de la API del Visor A+ (spec 022 R-015 y R-016) tal como las usa el visor.
import type { EventView } from './types.ts';

export type AgendaKind = 'dormir' | 'desplazamiento' | 'trabajo' | 'estudio' | 'obligacion' | 'cuidado' | 'libre';

export interface Dossier {
  id: string;
  identity: {
    birthDate: string;
    birthplace: string | null;
    education: string | null;
    arrived: { date: string; from: string | null; reason: string | null } | null;
    household: { id: string; members: number; tenure: string | null } | null;
  };
  why: (EventView & { origin: boolean })[];
  until: string | null;
  agenda: { blocks: { from: number; to: number; kind: AgendaKind; activity: string }[]; now: number; free: { from: string; to: string } | null };
  family: { id: string; name: string; relation: string; situation: string }[];
  health: {
    insurance: { regime: string | null; since: string } | null;
    conditions: { name: string; since: string; controlled: boolean }[];
    illnesses: string[];
    overslept: { count: number; last: string | null };
  };
  objects: { id: string; name: string; owner: 'persona' | 'hogar'; acquired: string | null; price: number }[];
  debts: { creditor: string; balance: number; installment: number; period: 'month' | 'day' }[];
  events: (EventView & { origin: boolean })[];
  counts: { events: number; functions: number; rules: number; chats: number };
}

export interface Demographics {
  date: string;
  period: 'month' | 'year' | 'all';
  population: number;
  women: number;
  men: number;
  births: { count: number; perThousand: number };
  deaths: { count: number; perThousand: number };
  households: { count: number; meanSize: number };
  organizations: number;
  pyramid: { group: string; F: number; M: number }[];
  occupations: { name: string; count: number }[];
  now: { kind: string; count: number }[];
  /** 022 R-017 (opcionales en respuestas anteriores). */
  moodMean?: number;
  employedPct?: number;
  mood?: number[];
  stress?: number[];
  money?: { bins: { label: string; count: number }[]; median: number; gini: number };
  householdSizes?: { size: string; count: number }[];
  employers?: { id: string; name: string; count: number }[];
}
