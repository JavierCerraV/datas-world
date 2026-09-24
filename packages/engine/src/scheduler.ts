// Cola de prioridad de elementos programados por (at, id) (spec 002 R-004). Montículo binario.
import type { WorldMinute } from './calendar.ts';
import type { EntityId } from './ids.ts';

export interface ScheduledItem {
  at: WorldMinute;
  id: EntityId; // desempate determinista
  kind: string; // 'SALARY_PAYMENT', 'APPOINTMENT', …
  payload: unknown;
}

export interface Scheduler {
  heap: ScheduledItem[];
  ids: Set<EntityId>;
}

const before = (a: ScheduledItem, b: ScheduledItem) => a.at < b.at || (a.at === b.at && a.id < b.id);

export const createScheduler = (): Scheduler => ({ heap: [], ids: new Set() });

export function schedule(s: Scheduler, item: ScheduledItem): void {
  if (s.ids.has(item.id)) throw new Error(`Scheduler: id duplicado ${item.id}`);
  if (!Number.isSafeInteger(item.at) || item.at < 0) throw new RangeError(`Scheduler: minuto inválido ${item.at}`);
  s.ids.add(item.id);
  const h = s.heap;
  h.push(item);
  let i = h.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (!before(h[i]!, h[p]!)) break;
    [h[i], h[p]] = [h[p]!, h[i]!];
    i = p;
  }
}

function popMin(s: Scheduler): ScheduledItem | undefined {
  const h = s.heap;
  const top = h[0];
  if (top === undefined) return undefined;
  const last = h.pop()!;
  if (h.length > 0) {
    h[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < h.length && before(h[l]!, h[m]!)) m = l;
      if (r < h.length && before(h[r]!, h[m]!)) m = r;
      if (m === i) break;
      [h[i], h[m]] = [h[m]!, h[i]!];
      i = m;
    }
  }
  s.ids.delete(top.id);
  return top;
}

/** Extrae, en orden (at, id), todo lo que vence en `now` o antes. */
export function popDue(s: Scheduler, now: WorldMinute): ScheduledItem[] {
  const due: ScheduledItem[] = [];
  while (s.heap.length > 0 && s.heap[0]!.at <= now) due.push(popMin(s)!);
  return due;
}

/** Contenido en orden canónico, independiente del orden de inserción (para hash e instantáneas). */
export const sortedItems = (s: Scheduler): ScheduledItem[] => [...s.heap].sort((a, b) => (before(a, b) ? -1 : 1));

export function schedulerFrom(items: readonly ScheduledItem[]): Scheduler {
  const s = createScheduler();
  for (const item of items) schedule(s, item);
  return s;
}
