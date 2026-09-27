// Almacén de registros en memoria con tope LRU (spec 026 R-003, §8 `RECORD_LRU`). La versión SQLite
// (`llm_records`, fuera del stateHash) llega con la persistencia en el bloque L3 y cumple la misma interfaz.
import type { LlmRecord, RecordStore } from './types.ts';

export class MemoryRecordStore implements RecordStore {
  #max: number;
  #map = new Map<string, LlmRecord>();

  constructor(max = 500) {
    this.#max = max;
  }

  get(key: string): LlmRecord | undefined {
    const r = this.#map.get(key);
    if (r) {
      // Uso reciente: al final del orden de inserción.
      this.#map.delete(key);
      this.#map.set(key, r);
    }
    return r;
  }

  put(record: LlmRecord): void {
    this.#map.delete(record.key);
    this.#map.set(record.key, structuredClone(record));
    while (this.#map.size > this.#max) {
      // Se desaloja el menos reciente que no afecte al mundo; los que afectan al mundo no se pierden.
      const victim = [...this.#map.values()].find((r) => !r.affectsWorld);
      if (!victim) break;
      this.#map.delete(victim.key);
    }
  }

  markAffectsWorld(key: string): void {
    const r = this.#map.get(key);
    if (r) r.affectsWorld = true;
  }

  prune(beforeIso: string): number {
    let n = 0;
    for (const [k, r] of this.#map)
      if (!r.affectsWorld && r.createdAt < beforeIso) {
        this.#map.delete(k);
        n++;
      }
    return n;
  }

  /** Todos los registros (para exportar o persistir). */
  all(): LlmRecord[] {
    return [...this.#map.values()].map((r) => structuredClone(r));
  }
}
