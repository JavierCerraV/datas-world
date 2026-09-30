// Cliente de la API (spec 022): lecturas con fetch, flujo en vivo con EventSource (reconecta solo y envía
// Last-Event-ID) y controles con basic auth.
import type { Demographics, Dossier } from './dossier-types.ts';
import type { Network } from './network3d.ts';
import type { Move } from './replay.ts';
import type { Metrics } from './world-panel.ts';
import type { CitizenDetail, CitizenPosition, EventView, Health, PlaceDetail, Stats, WorldView } from './types.ts';

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return (await r.json()) as T;
}

export const api = {
  world: () => get<WorldView>('/api/world'),
  citizens: () => get<CitizenPosition[]>('/api/citizens'),
  citizen: (id: string) => get<CitizenDetail>(`/api/citizens/${id}`),
  place: (id: string) => get<PlaceDetail>(`/api/places/${id}`),
  /** 022 R-009: los días con instantánea (la línea temporal). */
  days: () => get<{ today: number; days: { day: number; date: string }[] }>('/api/days'),
  /** Posiciones o ficha de una ruta dada (la del presente o la de un día pasado, 024 R-010). */
  at: <T>(path: string) => get<T>(path),
  /** 022 R-010: métricas por día y alertas (el panel del mundo). */
  metrics: () => get<Metrics>('/api/metrics'),
  /** 022 R-012: los viajes que llegan después de `since`. */
  moves: (since: number) => get<Move[]>(`/api/moves?since=${Math.floor(since)}`),
  /** 022 R-013: indicadores de la barra superior y avance sin observar. */
  stats: () => get<Stats>('/api/stats'),
  /** 022 R-015: el expediente de una persona. */
  dossier: (id: string) => get<Dossier>(`/api/citizens/${id}/dossier`),
  /** 022 R-016: la demografía del periodo y el panel «Ahora». */
  demographics: (period: 'month' | 'year' | 'all' = 'year') => get<Demographics>(`/api/demographics?period=${period}`),
  /** 022 R-018: la red de vínculos (024 R-027). */
  network: () => get<Network>('/api/network'),
  events: (limit = 30) => get<EventView[]>(`/api/events?limit=${limit}`),
  health: () => get<Health>('/api/health'),
};

export interface Tick {
  now: number;
  date: string;
  status: string;
  /** 022 R-012: los viajes nuevos desde el tick anterior. */
  moves?: Move[];
}

export function stream(handlers: { tick: (t: Tick) => void; event: (e: EventView) => void; status: (ok: boolean) => void }): EventSource {
  const es = new EventSource('/api/stream');
  es.addEventListener('tick', (m) => handlers.tick(JSON.parse((m as MessageEvent<string>).data) as Tick));
  es.addEventListener('event', (m) => handlers.event(JSON.parse((m as MessageEvent<string>).data) as EventView));
  es.onopen = () => handlers.status(true);
  es.onerror = () => handlers.status(false);
  return es;
}

/** Envía una orden de control; devuelve el código HTTP (401 sin credenciales válidas, 503 si están desactivados). */
export async function control(cmd: 'pause' | 'resume' | 'speed' | 'step' | 'advance', arg: number | undefined, credentials: string | null): Promise<number> {
  const r = await fetch('/api/control', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(credentials ? { authorization: `Basic ${credentials}` } : {}) },
    body: JSON.stringify(arg === undefined ? { cmd } : { cmd, arg }),
  });
  return r.status;
}
