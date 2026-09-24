// Plantillas de mapa (spec 003 R-001, R-004). La de M1 reproduce el prototipo: 64×40 tiles de 8 m,
// calles de 2 tiles, 3 filas de 4 manzanas y un barrio por fila (más la iglesia de la spec 004).

export interface DistrictTemplate {
  name: string;
  stratum: number; // 1–6
  /** Filas del mapa que cubre [y0, y1); las filas de todos los barrios parten el mapa sin huecos. */
  rows: [number, number];
  /** Década en que nace el barrio (historia generada, spec 030). */
  foundedDecade: number;
}

/** Una parcela de manzana: un edificio (o el parque) con su puerta sobre la calle. */
export interface PlotTemplate {
  row: number; // fila de manzanas = barrio
  col: number;
  index: number; // 0 o 1 dentro de la manzana; 0 en el parque
  kind: string; // clave de place_kinds
  rect: { x: number; y: number; w: number; h: number };
  door: { x: number; y: number };
}

export interface MapTemplate {
  id: string;
  width: number;
  height: number;
  tileMeters: number;
  roadX: readonly number[]; // columna izquierda de cada calle vertical (2 tiles de ancho)
  roadY: readonly number[]; // fila superior de cada calle horizontal
  blockCols: readonly number[];
  blockRows: readonly number[];
  districts: readonly DistrictTemplate[];
  /** Por fila y columna: el parque o un par de parcelas. */
  layout: readonly (readonly ('park' | readonly [string, string])[])[];
}

export const PROTOTYPE_64X40: MapTemplate = Object.freeze<MapTemplate>({
  id: 'prototipo-64x40',
  width: 64,
  height: 40,
  tileMeters: 8,
  roadX: [5, 17, 29, 41, 53],
  roadY: [4, 14, 24, 34],
  blockCols: [7, 19, 31, 43],
  blockRows: [6, 16, 26],
  districts: [
    { name: 'La Esperanza', stratum: 3, rows: [0, 15], foundedDecade: 1950 },
    { name: 'Centro', stratum: 4, rows: [15, 25], foundedDecade: 1900 },
    { name: 'San Martín', stratum: 2, rows: [25, 40], foundedDecade: 1970 },
  ],
  layout: [
    [
      ['vivienda.edificio', 'vivienda.edificio'],
      ['educacion.colegio', 'vivienda.edificio'],
      ['vivienda.edificio', 'vivienda.edificio'],
      ['vivienda.edificio', 'ocio.gimnasio'],
    ],
    [
      ['ocio.cafe', 'ocio.restaurante'],
      'park',
      ['servicios.oficina', 'salud.hospital'],
      ['vivienda.edificio', 'comercio.tienda_barrio'],
    ],
    [
      ['vivienda.edificio', 'vivienda.edificio'],
      ['industria.fabrica', 'vivienda.edificio'],
      ['religioso.iglesia', 'vivienda.edificio'], // la iglesia ocupa una casa de San Martín (004 R-001)
      ['vivienda.edificio', 'vivienda.edificio'],
    ],
  ],
});

export const MAP_TEMPLATES: Readonly<Record<string, MapTemplate>> = Object.freeze({
  [PROTOTYPE_64X40.id]: PROTOTYPE_64X40,
});

export const isRoadTile = (t: MapTemplate, x: number, y: number): boolean =>
  t.roadX.some((r) => x === r || x === r + 1) || t.roadY.some((r) => y === r || y === r + 1);

/** Parcelas en orden de fila, columna e índice, con rectángulo y puerta como en `buildPlaces` del prototipo. */
export function plots(t: MapTemplate): PlotTemplate[] {
  const out: PlotTemplate[] = [];
  t.layout.forEach((row, r) =>
    row.forEach((cell, c) => {
      const x0 = t.blockCols[c]!;
      const y0 = t.blockRows[r]!;
      if (cell === 'park') {
        out.push({
          row: r,
          col: c,
          index: 0,
          kind: 'espacio_publico.parque',
          rect: { x: x0 + 1, y: y0 + 1, w: 8, h: 6 },
          door: { x: x0 + 4, y: y0 + 8 },
        });
        return;
      }
      cell.forEach((kind, i) => {
        const x = x0 + 1 + i * 4;
        out.push({
          row: r,
          col: c,
          index: i,
          kind,
          rect: { x, y: y0 + 1, w: 4, h: 6 },
          door: { x: x + (i ? 1 : 2), y: y0 + 8 },
        });
      });
    }),
  );
  return out;
}
