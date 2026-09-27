// Cliente de la API (spec 022): lecturas con fetch, flujo en vivo con EventSource (reconecta solo y envía
// Last-Event-ID) y controles con basic auth.
import type { CitizenDetail, CitizenPosition, EventView, Health, WorldView } from './types.ts';

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return (await r.json()) as T;
}

export const api = {
  world: () => get<WorldView>('/api/world'),
  citizens: () => get<CitizenPosition[]>('/api/citizens'),
  citizen: (id: string) => get<CitizenDetail>(`/api/citizens/${id}`),
  events: (limit = 30) => get<EventView[]>(`/api/events?limit=${limit}`),
  health: () => get<Health>('/api/health'),
};

export function stream(handlers: { tick: (t: { now: number; date: string; status: string }) => void; event: (e: EventView) => void; status: (ok: boolean) => void }): EventSource {
  const es = new EventSource('/api/stream');
  es.addEventListener('tick', (m) => handlers.tick(JSON.parse((m as MessageEvent<string>).data)));
  es.addEventListener('event', (m) => handlers.event(JSON.parse((m as MessageEvent<string>).data)));
  es.onopen = () => handlers.status(true);
  es.onerror = () => handlers.status(false);
  return es;
}

/** Envía una orden de control; devuelve el código HTTP (401 sin credenciales válidas, 503 si están desactivados). */
export async function control(cmd: 'pause' | 'resume' | 'speed' | 'step', arg: number | undefined, credentials: string | null): Promise<number> {
  const r = await fetch('/api/control', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(credentials ? { authorization: `Basic ${credentials}` } : {}) },
    body: JSON.stringify(arg === undefined ? { cmd } : { cmd, arg }),
  });
  return r.status;
}
