// Red de vínculos del mundo (spec 022 R-018) para la red 3D del dashboard (024 R-027): una persona viva por nodo y
// las aristas sin repetir, de sus vínculos (012) y del parentesco de sus hogares (008). Función pura.
import { MINUTES_PER_DAY, idNumber } from '@datas-world/engine';
import type { EntityId, World } from '@datas-world/engine';
import { whereAndUntil } from './observe.ts';
import { living } from './views.ts';

const YEAR = 365.25 * MINUTES_PER_DAY;
export type EdgeKind = 'pareja' | 'familia' | 'amistad' | 'companeros' | 'otros';
export const EDGE_KINDS: readonly EdgeKind[] = ['pareja', 'familia', 'amistad', 'companeros', 'otros'];
const RANK: Record<EdgeKind, number> = { pareja: 0, familia: 1, amistad: 2, companeros: 3, otros: 4 };

/** El tipo de un vínculo por sus etiquetas (012), del más fuerte al más débil. */
export function edgeKindOf(labels: readonly string[]): EdgeKind {
  if (labels.includes('pareja')) return 'pareja';
  if (labels.includes('familia')) return 'familia';
  if (labels.includes('amigo')) return 'amistad';
  if (labels.includes('companero')) return 'companeros';
  return 'otros';
}

export interface NetNode { id: string; name: string; age: number; sex: 'F' | 'M' | null; district: string | null; household: string | null; mood: number }
export interface NetEdge { a: string; b: string; kind: EdgeKind; familiarity: number; tension: number }

/** 022 R-018 (CA-014): nodos y aristas, en orden de id. */
export function networkOf(w: World): { nodes: NetNode[]; edges: NetEdge[] } {
  const people = living(w);
  const alive = new Set<string>(people.map((c) => c.id));
  const nodes = people.map((c) => {
    const row = idNumber(c.id);
    return {
      id: c.id,
      name: c.name ? `${c.name.given} ${c.name.family[0]}` : c.id,
      age: Math.floor((w.now - (w.components.i32['demo.birthMinute']?.[row] ?? 0)) / YEAR),
      sex: c.sex ?? null,
      district: whereAndUntil(w, c.id as EntityId).district,
      household: c.householdId ?? null,
      mood: Math.round((w.components.f32['state.mood']?.[row] ?? 0.5) * 100) / 100,
    };
  });
  const edges = new Map<string, NetEdge>();
  const put = (x: string, y: string, kind: EdgeKind, familiarity: number, tension: number) => {
    if (x === y || !alive.has(x) || !alive.has(y)) return;
    const [a, b] = x < y ? [x, y] : [y, x];
    const key = `${a}|${b}`;
    const old = edges.get(key);
    if (!old) edges.set(key, { a, b, kind, familiarity, tension });
    else if (RANK[kind] < RANK[old.kind] || familiarity > old.familiarity || tension > old.tension)
      edges.set(key, { a, b, kind: RANK[kind] < RANK[old.kind] ? kind : old.kind, familiarity: Math.max(familiarity, old.familiarity), tension: Math.max(tension, old.tension) });
  };
  for (const h of w.households.values())
    for (const k of h.kinship) put(k.from, k.to, k.kind === 'partner' ? 'pareja' : 'familia', 1, 0);
  for (const c of people)
    for (const b of c.bonds ?? []) put(c.id, b.with, edgeKindOf(b.labels ?? []), Math.round((b.familiarity ?? 0) * 100) / 100, Math.round(b.tension * 100) / 100);
  return { nodes, edges: [...edges.values()].sort((x, y) => (x.a < y.a ? -1 : x.a > y.a ? 1 : x.b < y.b ? -1 : 1)) };
}
