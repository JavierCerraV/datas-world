// Mapa del mundo y distancias por las calles (spec 003). Puro: la movilidad (016) lo usará en M2.

/** Tipos de tile (u8). El orden es parte del formato guardado: solo se añaden valores al final. */
export const TILE = Object.freeze({ grass: 0, road: 1, building: 2, water: 3, park: 4, plaza: 5 });
export type TileKind = keyof typeof TILE;

export interface GeoMap {
  width: number;
  height: number;
  tileMeters: number;
  tiles: Uint8Array; // índice y*width+x → TILE
}

export interface TilePoint {
  x: number;
  y: number;
}

export function createGeoMap(width: number, height: number, tileMeters: number): GeoMap {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 1 << 20) {
    throw new RangeError(`Tamaño de mapa inválido: ${width}×${height}`);
  }
  if (!(tileMeters > 0)) throw new RangeError(`tileMeters inválido: ${tileMeters}`);
  return { width, height, tileMeters, tiles: new Uint8Array(width * height) };
}

const inside = (m: GeoMap, x: number, y: number) => x >= 0 && y >= 0 && x < m.width && y < m.height;

export function tileAt(m: GeoMap, x: number, y: number): number {
  if (!inside(m, x, y)) throw new RangeError(`Fuera del mapa: (${x}, ${y})`);
  return m.tiles[y * m.width + x]!;
}

export function setTile(m: GeoMap, x: number, y: number, kind: number): void {
  if (!inside(m, x, y)) throw new RangeError(`Fuera del mapa: (${x}, ${y})`);
  m.tiles[y * m.width + x] = kind;
}

/**
 * Pasos por calle desde `from` a cada tile (4 vecinos, solo tiles `road`). -1 = inalcanzable.
 * `from` debe ser una calle: las puertas de los lugares están sobre la calle (como en el prototipo).
 */
export function roadDistances(m: GeoMap, from: TilePoint): Int32Array {
  const dist = new Int32Array(m.width * m.height).fill(-1);
  if (tileAt(m, from.x, from.y) !== TILE.road) throw new Error(`(${from.x}, ${from.y}) no es una calle`);
  const queue = new Int32Array(m.width * m.height);
  let head = 0;
  let tail = 0;
  const start = from.y * m.width + from.x;
  dist[start] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const cur = queue[head++]!;
    const cx = cur % m.width;
    const cy = (cur - cx) / m.width;
    // Orden fijo de vecinos: este, oeste, sur, norte (como `path` del prototipo).
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inside(m, nx, ny)) continue;
      const ni = ny * m.width + nx;
      if (dist[ni] !== -1 || m.tiles[ni] !== TILE.road) continue;
      dist[ni] = dist[cur]! + 1;
      queue[tail++] = ni;
    }
  }
  return dist;
}

/** Matriz N×N de pasos entre puertas (fila i = desde la puerta i). -1 = inalcanzable. Derivada: no se guarda. */
export function doorDistanceMatrix(m: GeoMap, doors: readonly TilePoint[]): Int32Array {
  const n = doors.length;
  const out = new Int32Array(n * n);
  doors.forEach((d, i) => {
    const dist = roadDistances(m, d);
    doors.forEach((e, j) => (out[i * n + j] = dist[e.y * m.width + e.x]!));
  });
  return out;
}

/** Forma JSON del mapa, para la instantánea y la persistencia. */
export interface GeoMapData {
  width: number;
  height: number;
  tileMeters: number;
  tiles: number[];
}

export const geoToData = (m: GeoMap): GeoMapData => ({
  width: m.width,
  height: m.height,
  tileMeters: m.tileMeters,
  tiles: Array.from(m.tiles),
});

export function geoFromData(d: GeoMapData): GeoMap {
  const m = createGeoMap(d.width, d.height, d.tileMeters);
  if (d.tiles.length !== d.width * d.height) throw new Error('Mapa guardado con un número de tiles incorrecto');
  m.tiles.set(d.tiles);
  return m;
}
