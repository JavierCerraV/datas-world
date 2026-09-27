// Lectura del mundo desde la base que escribe el worker (spec 022 R-001, R-006): conexión de solo lectura y
// recarga del mundo cuando cambia el minuto persistido.
import type { World } from '@datas-world/engine';
import { WorldRepository, closeDb, openReadonly } from '@datas-world/persistence';
import type { Db } from '@datas-world/persistence';

export class WorldReader {
  readonly db: Db;
  #world: World | undefined;
  #minute = Number.NaN;
  #meta;

  constructor(path: string) {
    this.db = openReadonly(path);
    this.#meta = this.db.prepare("SELECT value FROM meta WHERE key = 'now'");
  }

  /** Minuto persistido (barato: una fila de `meta`). */
  persistedMinute(): number {
    const r = this.#meta.get() as { value: string } | undefined;
    return r ? Number(r.value) : Number.NaN;
  }

  /** Recarga el mundo si el minuto persistido cambió; devuelve `true` si recargó. */
  refresh(): boolean {
    const m = this.persistedMinute();
    if (this.#world && m === this.#minute) return false;
    this.#world = new WorldRepository(this.db).loadWorld();
    this.#minute = m;
    return true;
  }

  get world(): World {
    if (!this.#world) this.refresh();
    return this.#world!;
  }

  close(): void {
    closeDb(this.db);
  }
}
