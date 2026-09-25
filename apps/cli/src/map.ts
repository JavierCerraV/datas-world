// world:map — el mapa del mundo en la terminal (spec 003 §9): calles, parques y lugares con su leyenda.
import { parseArgs } from 'node:util';
import { TILE, tileAt } from '@datas-world/engine';
import type { Place, World } from '@datas-world/engine';
import { WorldRepository, openReadonly } from '@datas-world/persistence';
import { DEFAULT_DB, UsageError, withDb } from './common.ts';
import type { Io } from './common.ts';

const TILE_CHAR: Record<number, string> = {
  [TILE.grass]: ' ',
  [TILE.road]: '·',
  [TILE.building]: '#',
  [TILE.water]: '~',
  [TILE.park]: '"',
  [TILE.plaza]: '+',
};
const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Líneas del mapa y de la leyenda. Los edificios de vivienda se marcan con `v`; los demás lugares, con una letra. */
export function renderMap(world: World): string[] {
  const g = world.geo;
  if (!g) throw new UsageError('El mundo no tiene mapa: es un mundo vacío de M0');
  const grid = Array.from({ length: g.height }, (_, y) =>
    Array.from({ length: g.width }, (_, x) => TILE_CHAR[tileAt(g, x, y)] ?? '?'),
  );
  const legend: string[] = [];
  const places = [...world.places.values()]
    .filter(
      (p): p is Place & { rect: NonNullable<Place['rect']> } =>
        p.rect !== undefined && p.kind !== 'vivienda.unidad' && !p.kind.startsWith('territorio.'),
    )
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  let n = 0;
  for (const p of places) {
    const residential = p.kind === 'vivienda.edificio';
    const mark = residential ? 'v' : (LABELS[n++] ?? '*');
    const { x, y, w, h } = p.rect;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) grid[j]![i] = mark;
    if (!residential) {
      const district = p.districtId ? world.places.get(p.districtId)?.name : undefined;
      legend.push(`  ${mark}  ${p.name} (${p.kind}${district ? `, ${district}` : ''})`);
    }
  }
  const districts = [...world.places.values()]
    .filter((p) => p.kind === 'territorio.barrio')
    .map((p) => `${p.name} (estrato ${p.stratum})`);
  return [
    ...grid.map((row) => row.join('').trimEnd()),
    '',
    `Barrios: ${districts.join(' · ')}`,
    'Leyenda: · calle  " parque  + plaza  ~ agua  v vivienda',
    ...legend,
  ];
}

export function worldMap(args: string[], io: Io): void {
  const { values: v } = parseArgs({ args, options: { db: { type: 'string', default: DEFAULT_DB } } });
  const lines = withDb(openReadonly(v.db), (db) => renderMap(new WorldRepository(db).loadWorld()));
  for (const l of lines) io.out(l);
}
