// Lógica pura del visor (spec 024 CA-004): colores del prototipo, aspecto estable por persona (R-006), velo de
// día y noche (R-007) e interpolación de posiciones (R-002). Sin DOM, para poder probarla.
import type { CitizenPosition } from './types.ts';

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

/** R-007: opacidad del velo nocturno según la hora (0 de 7:00 a 17:00; 0,45 de 20:00 a 5:00; rampas entre medias). */
export function nightAlpha(hour: number, minute = 0, max = 0.45): number {
  const t = hour + minute / 60;
  if (t >= 7 && t <= 17) return 0;
  if (t > 17 && t < 20) return (max * (t - 17)) / 3;
  if (t > 5 && t < 7) return (max * (7 - t)) / 2;
  return max;
}

/** Hora y minuto de una fecha de la API (`2027-01-04 07:35`). */
export function timeOf(date: string): { hour: number; minute: number } {
  const m = /(\d\d):(\d\d)$/.exec(date);
  return m ? { hour: Number(m[1]), minute: Number(m[2]) } : { hour: 12, minute: 0 };
}

/**
 * R-002: posición interpolada entre dos actualizaciones (`t` ∈ [0,1]). Quien no estaba antes aparece en su sitio;
 * quien está fuera del mapa (`x = null`) no se dibuja.
 */
export function interpolate(prev: ReadonlyMap<string, CitizenPosition>, next: readonly CitizenPosition[], t: number): { id: string; x: number; y: number }[] {
  const k = Math.min(1, Math.max(0, t));
  const out: { id: string; x: number; y: number }[] = [];
  for (const c of next) {
    if (c.x === null || c.y === null) continue;
    const p = prev.get(c.id);
    if (!p || p.x === null || p.y === null) out.push({ id: c.id, x: c.x, y: c.y });
    else out.push({ id: c.id, x: p.x + (c.x - p.x) * k, y: p.y + (c.y - p.y) * k });
  }
  return out;
}

/** Varias personas en el mismo punto (una puerta) se reparten en un pequeño círculo para verse. */
export function spread(points: readonly { id: string; x: number; y: number }[]): { id: string; x: number; y: number }[] {
  const groups = new Map<string, { id: string; x: number; y: number }[]>();
  for (const p of points) {
    const key = `${Math.round(p.x * 4)}|${Math.round(p.y * 4)}`;
    const g = groups.get(key);
    if (g) g.push(p);
    else groups.set(key, [p]);
  }
  const out: { id: string; x: number; y: number }[] = [];
  for (const g of groups.values()) {
    if (g.length === 1) {
      out.push(g[0]!);
      continue;
    }
    const r = Math.min(1.2, 0.25 + 0.05 * g.length);
    g.forEach((p, i) => {
      const a = (2 * Math.PI * i) / g.length;
      out.push({ id: p.id, x: p.x + r * Math.cos(a), y: p.y + r * Math.sin(a) });
    });
  }
  return out;
}
