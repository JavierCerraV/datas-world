// Respuestas de la API (spec 022) tal como las usa el visor. La web solo lee (CLAUDE.md §8).

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlaceView {
  id: string;
  kind: string;
  name: string;
  rect?: Rect;
  door?: { x: number; y: number };
  open: string;
}

export interface WorldView {
  name: string;
  now: number;
  date: string;
  epoch: string;
  status: string;
  geo: { width: number; height: number; tiles: number[] } | null;
  places: PlaceView[];
  population: number;
}

export interface CitizenPosition {
  id: string;
  name: string;
  x: number | null;
  y: number | null;
  activity: string;
  placeId: string | null;
  moving: boolean;
  mood: number;
}

export type Cause = { event: string; weight: number } | { state: string; value: number | null; weight: number };

export interface EventView {
  id: string;
  type: string;
  at: number;
  date: string;
  participants: { id: string; role: string; name: string | null }[];
  payload: Record<string, unknown>;
  causes: Cause[];
}

export interface CitizenDetail {
  id: string;
  name: string;
  sex: 'F' | 'M' | null;
  age: number;
  occupation: ({ kind: string; orgName?: string; reason?: string; trade?: string } & Record<string, unknown>) | null;
  household: { id: string; members: number } | null;
  money: number | null;
  activity: string;
  place: { id: string; name: string } | null;
  moving: boolean;
  state: { mood: number; stress: number };
  needs: Record<string, number>;
  emotions: Record<string, number>;
  temperament: Record<string, number>;
  learned: { discountK: number; variability: number };
  functions: { stimulus: string; value: number; trials: number; sources: string[] }[];
  responses: { response: string; strength: number }[];
  rules: { response: string; consequence: string; kind: string; speaker: string | null; strength: number; contrast: number; contribution: number }[];
  relations: { a: string; b: string; type: string; strength: number; context: string | null }[];
  /** Vínculos (012); opcionales para fichas de mundos anteriores a M3. */
  bonds?: {
    id: string; name: string | null; labels: string[]; familiarity: number; tension: number; trust: number; encounters: number; affection: number; affectionBack: number;
  }[];
  attachment?: { security: number; avoidance: number; style: string };
  events: EventView[];
}

export interface Health {
  now: number;
  date: string;
  status: string;
  speed: number;
  citizens: number;
  rssMb: number;
  dbMb: number;
}
