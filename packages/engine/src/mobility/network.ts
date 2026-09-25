// Red del pueblo (016 R-001; 003 R-002): metros por calle entre las puertas de los lugares, y lugares por tipo.
// Todo es derivado del mapa y de los lugares: se calcula una vez por mundo y no se guarda.
import { idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import { doorDistanceMatrix } from '../geo.ts';
import type { WorldView } from '../simulation/system.ts';

interface Network {
  places: number;
  /** Número de lugar → índice de su puerta en la matriz. */
  door: Map<number, number>;
  n: number;
  steps: Int32Array;
  tileMeters: number;
  /** Tipo → números de lugar activos, en orden ascendente. */
  byKind: Map<string, number[]>;
  /** Número de lugar → viaje fuera del mapa (propio o del municipio al que pertenece). */
  travel: Map<number, { minutes: number; cost: number }>;
}

const memo = new WeakMap<object, Network>();

function build(view: WorldView): Network {
  const doorIndex = new Map<string, number>();
  const doors: { x: number; y: number }[] = [];
  const door = new Map<number, number>();
  const byKind = new Map<string, number[]>();
  const travel = new Map<number, { minutes: number; cost: number }>();
  const ids = [...view.places.keys()].sort((a, b) => idNumber(a) - idNumber(b));
  for (const id of ids) {
    const p = view.places.get(id)!;
    if (p.status !== 'active') continue;
    const n = idNumber(id);
    byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), n]);
    const t = p.travel ?? (p.parentId ? view.places.get(p.parentId as EntityId)?.travel : undefined);
    if (t) travel.set(n, { minutes: t.minutes, cost: t.cost });
    if (!p.door || !view.geo) continue;
    const key = `${p.door.x},${p.door.y}`;
    if (!doorIndex.has(key)) {
      doorIndex.set(key, doors.length);
      doors.push({ x: p.door.x, y: p.door.y });
    }
    door.set(n, doorIndex.get(key)!);
  }
  const steps = view.geo && doors.length ? doorDistanceMatrix(view.geo as Parameters<typeof doorDistanceMatrix>[0], doors) : new Int32Array(0);
  return { places: view.places.size, door, n: doors.length, steps, tileMeters: view.geo?.tileMeters ?? 8, byKind, travel };
}

/** La red del mundo; se reconstruye si cambia el número de lugares. */
export function networkOf(view: WorldView): Network {
  const hit = memo.get(view.places);
  if (hit && hit.places === view.places.size) return hit;
  const net = build(view);
  memo.set(view.places, net);
  return net;
}

/** Metros por calle entre dos lugares del mapa; `undefined` si alguno no tiene puerta o no hay camino. */
export function metersBetween(view: WorldView, from: number, to: number): number | undefined {
  const net = networkOf(view);
  const a = net.door.get(from);
  const b = net.door.get(to);
  if (a === undefined || b === undefined) return undefined;
  const s = net.steps[a * net.n + b]!;
  return s < 0 ? undefined : s * net.tileMeters;
}

/** Primer lugar activo de un tipo (el de número menor), o 0. */
export const firstOfKind = (view: WorldView, kind: string): number => networkOf(view).byKind.get(kind)?.[0] ?? 0;

/** Viaje fuera del mapa hasta un lugar regional (033), si lo es. */
export const travelTo = (view: WorldView, place: number) => networkOf(view).travel.get(place);
