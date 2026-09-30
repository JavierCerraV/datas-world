// Reproducción del movimiento (spec 024 R-013): el visor muestra el mundo unos segundos por detrás del último minuto
// guardado y, con los viajes anotados por el worker (022 R-012), sabe dónde estaba cada persona en cada minuto:
// caminando entre dos lugares o dentro de uno. Lógica pura, sin DOM.

export interface Move {
  citizenId: string;
  departAt: number;
  arriveAt: number;
  from: string;
  to: string;
  mode: string;
}

export type Where = { kind: 'walk'; move: Move; f: number } | { kind: 'at'; place: string | null };

/** Los viajes conocidos de cada persona, sin repetidos y en orden de salida. */
export class MoveBook {
  #by = new Map<string, Move[]>();
  #keys = new Set<string>();

  add(moves: readonly Move[]): void {
    for (const m of moves) {
      const key = `${m.citizenId}@${m.departAt}`;
      if (this.#keys.has(key)) continue;
      this.#keys.add(key);
      const list = this.#by.get(m.citizenId) ?? [];
      list.push(m);
      list.sort((a, b) => a.departAt - b.departAt);
      this.#by.set(m.citizenId, list);
    }
  }

  /** Olvida los viajes que llegaron antes de `before`, salvo el último de cada persona (dice dónde quedó). */
  prune(before: number): void {
    for (const [id, list] of this.#by) {
      const keep = list.filter((m, i) => m.arriveAt >= before || i === list.length - 1);
      for (const m of list) if (!keep.includes(m)) this.#keys.delete(`${m.citizenId}@${m.departAt}`);
      this.#by.set(id, keep);
    }
  }

  /**
   * Dónde está una persona en el minuto `t`: caminando si está entre la salida y la llegada de un viaje; si no, en
   * el destino del último viaje que empezó, o en el origen del primero que aún no empezó; sin viajes, en `base` (su
   * lugar según el último estado guardado).
   */
  where(id: string, t: number, base: string | null): Where {
    const list = this.#by.get(id);
    if (!list?.length) return { kind: 'at', place: base };
    let last: Move | undefined;
    for (const m of list) if (m.departAt <= t) last = m;
    if (!last) return { kind: 'at', place: list[0]!.from };
    if (t < last.arriveAt) return { kind: 'walk', move: last, f: (t - last.departAt) / Math.max(1, last.arriveAt - last.departAt) };
    return { kind: 'at', place: last.to };
  }

  get size(): number {
    return this.#keys.size;
  }
}

/** [M] Retraso máximo del reloj de vista en minutos de mundo (024 §8); a velocidades altas, 5 s reales. */
export const VIEW_LAG_MAX = 90;
/** Retraso buscado: lo que tarda en llegar un guardado (≈ 2,5 s reales) más un tick. */
const TARGET_LAG_S = 2.5;

/**
 * CA-010: el siguiente minuto de la vista. Avanza a la velocidad del mundo (minutos por segundo), un poco más
 * deprisa si se queda atrás y más despacio si se acerca demasiado, sin pasar nunca de `latest`. En pausa, alcanza
 * el último minuto guardado. Si se queda más atrás del máximo, salta.
 */
export function stepView(at: number | null, latest: number, speed: number, dtMs: number, paused: boolean): number {
  const target = speed * TARGET_LAG_S + 5;
  const lagMax = Math.max(VIEW_LAG_MAX, speed * 5 + 5);
  if (at === null || at > latest || latest - at > lagMax) return Math.max(0, latest - target);
  const lag = latest - at;
  const rate = paused || speed === 0 ? Math.max(10, lag) : speed * Math.min(3, Math.max(0.25, 1 + (lag - target) / target));
  return Math.min(latest, at + (rate * dtMs) / 1000);
}
