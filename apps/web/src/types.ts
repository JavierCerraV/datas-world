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
  /** `tileMeters`: metros por tile de este mundo (003 v0.4: 40; los mundos anteriores, 8). */
  geo: { width: number; height: number; tileMeters?: number; tiles: number[] } | null;
  places: PlaceView[];
  population: number;
  /** 022 R-012: por dónde se entra a cada lugar (también a las viviendas), en tiles. */
  points?: Record<string, [number, number]>;
  /** 024 R-017: nombre de cada lugar. */
  names?: Record<string, string>;
}

/** 022 R-013: indicadores de la barra superior. */
export interface Stats {
  population: number;
  households: number;
  districts: number;
  employedPct: number;
  moodMean: number;
  eventsToday: number;
  advance: { from: number; to: number } | null;
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
  /** 024 R-008 (opcional en respuestas antiguas). */
  age?: number;
  /** 022 R-019: su ocupación y el estrato de su vivienda (opcionales en respuestas antiguas). */
  occupation?: string;
  stratum?: number | null;
  /** 024 R-017: su vivienda. */
  homeId?: string | null;
  /** 022 R-008: el viaje en curso, para dibujarlo por las calles. */
  trip?: { from: { x: number; y: number }; to: { x: number; y: number }; departAt: number; arriveAt: number };
}

/** 022 R-007: ficha de un lugar. */
export interface PlaceDetail {
  id: string;
  name: string;
  kind: string;
  district: string | null;
  open: string;
  inside: { id: string; name: string; activity: string }[];
  residents: { id: string; name: string }[];
  /** 022 R-014: quién trabaja aquí. */
  staff?: { id: string; name: string; title: string; org: string; boss: boolean }[];
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
  /** 024 R-016: texto del evento; las personas van por id (`CIT-000012`) para mostrarlas como nombres pulsables. */
  text?: string;
  /** Nombre de cada persona que menciona el texto. */
  names?: Record<string, string | null>;
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
  /** 025: lo que cree de otros; `truth` es solo para quien observa. */
  beliefs?: { about: string; name: string | null; predicate: string; topic: string; source: string; sourceName: string | null; credibility: number; hops: number; truth: boolean }[];
  events: EventView[];
  /** 022 R-014: vivienda, barrio, hasta cuándo dura lo que hace y lo que otros creen de la persona. */
  home?: { id: string; name: string } | null;
  district?: string | null;
  until?: string | null;
  aboutMe?: { predicate: string; topic: string; true: boolean; holders: { id: string; name: string; credibility: number }[] }[];
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
