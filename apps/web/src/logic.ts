// Lógica pura del visor (spec 024 CA-004): colores del prototipo y aspecto estable por persona (R-006). El velo de la
// noche está en `figures.ts` y la reproducción del movimiento (que sustituye a la interpolación, R-013) en `replay.ts`.

export const TS = 8; // tile de 8 px (R-001)

/** Colores de los tiles (`TILE` del motor: grass, road, building, water, park, plaza), del prototipo. */
export const TILE_COLORS: readonly string[] = ['#76A053', '#6A655C', '#C8BFA4', '#3F7FB5', '#5F9146', '#CDBF98'];

export interface BuildingStyle {
  roof: string;
  wall: string;
  win: string;
  door: string;
}

/** Estilos de edificio del prototipo (`PSTYLE`). */
const STYLES: Record<string, BuildingStyle> = {
  casa: { roof: '#B4583F', wall: '#E8D6B7', win: '#56789A', door: '#6B3E24' },
  oficina: { roof: '#3F5E86', wall: '#B8C7D8', win: '#2F4B6B', door: '#2A3440' },
  hospital: { roof: '#E6E6E6', wall: '#F4F4F4', win: '#7EA6C4', door: '#8A8A8A' },
  colegio: { roof: '#D6B43E', wall: '#EADFC0', win: '#56789A', door: '#7A5A24' },
  fabrica: { roof: '#7C7F87', wall: '#A7A69E', win: '#4E5560', door: '#3E3E3E' },
  tienda: { roof: '#3D8A6A', wall: '#E9E1CC', win: '#56789A', door: '#2F5E48' },
  cafe: { roof: '#6E4630', wall: '#E5D2B8', win: '#56789A', door: '#4A2E1E' },
  restaurante: { roof: '#A33B2E', wall: '#EEDFC9', win: '#56789A', door: '#5A2019' },
  gimnasio: { roof: '#5D4E9E', wall: '#D6D0EA', win: '#3D3470', door: '#2E2750' },
};
const ROOFS = ['#B4583F', '#8E4E6B', '#C47A3A'];

/** Estilo de un lugar por su tipo de catálogo (`vivienda.edificio`, `ocio.cafe`…). */
export function styleOf(kind: string, id: string): BuildingStyle {
  if (kind.startsWith('vivienda')) return { ...STYLES.casa!, roof: ROOFS[hash(id) % ROOFS.length]! };
  if (kind === 'servicios.oficina' || kind.startsWith('gobierno') || kind.startsWith('finanzas')) return STYLES.oficina!;
  if (kind.startsWith('salud')) return STYLES.hospital!;
  if (kind.startsWith('educacion') || kind.startsWith('cultura')) return STYLES.colegio!;
  if (kind.startsWith('industria')) return STYLES.fabrica!;
  if (kind === 'ocio.cafe' || kind === 'ocio.bar') return STYLES.cafe!;
  if (kind === 'ocio.restaurante') return STYLES.restaurante!;
  if (kind === 'ocio.gimnasio' || kind.startsWith('deporte')) return STYLES.gimnasio!;
  return STYLES.tienda!;
}

/** FNV-1a de 32 bits: estable para un id (sin azar, R-006). */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const SKIN = ['#F1C9A5', '#D9A47C', '#B97F57', '#8D5A3A', '#E8B98F'];
const HAIR = ['#2B1D14', '#4A3020', '#7A5230', '#1A1A1A', '#B0B0B0', '#8C3B1F'];
const SHIRT = ['#D24B4B', '#3E7CC2', '#E0B53A', '#4F9A5B', '#9A5CC0', '#E07B39', '#2F9C9C', '#F2F2F2', '#C2527E'];
const PANTS = ['#2F3A55', '#4A4A4A', '#5A4632', '#26313F'];

export interface Look {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
}

/** R-006: aspecto de una persona por su id, sobre las paletas del prototipo. */
export function lookOf(id: string): Look {
  const h = hash(id);
  return {
    skin: SKIN[h % SKIN.length]!,
    hair: HAIR[(h >>> 3) % HAIR.length]!,
    shirt: SHIRT[(h >>> 7) % SHIRT.length]!,
    pants: PANTS[(h >>> 11) % PANTS.length]!,
  };
}


