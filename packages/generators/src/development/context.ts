// Contexto de desarrollo de una persona (spec 041 R-003, R-006): su familia con fechas de vida, los hechos de su
// infancia (030) y las condiciones de su vida adulta. Solo lee el mundo ya generado (población, empleo, historia).
import { idNumber } from '@datas-world/engine';
import type { EntityId, World, WorldEvent } from '@datas-world/engine';

const DAY = 1440;
export const YEAR = 365 * DAY;

export interface Kin {
  mother?: EntityId;
  father?: EntityId;
  /** Abuelas y abuelos (materna y paterna), si se conocen. */
  grandparents: EntityId[];
  siblings: EntityId[];
  partner?: EntityId;
  children: EntityId[];
}

export interface DevContext {
  id: EntityId;
  birth: number;
  /** Años cumplidos en el presente del mundo. */
  age: number;
  /** Condiciones del hogar y de la historia: hechos de infancia (`familia_unida`…), `estrato_bajo`, `estudios_superiores`. */
  flags: Set<string>;
  kin: Kin;
  /** Desde cuándo tiene pareja, trabajo e hijos (si los tiene). */
  partnerSince?: number;
  workingSince?: number;
  firstChildAt?: number;
}

const col = (world: World, name: string, id: EntityId) => (world.components.i32[name] ?? world.components.u8[name])?.[idNumber(id)] ?? 0;
export const birthOf = (world: World, id: EntityId) => col(world, 'demo.birthMinute', id);
/** Vive en ese minuto: ya nació y no ha muerto (un antepasado sin fecha de muerte cuenta como vivo). */
export function aliveAt(world: World, id: EntityId | undefined, at: number): boolean {
  if (!id || !world.citizens.has(id)) return false;
  const death = col(world, 'demo.deathMinute', id);
  return birthOf(world, id) <= at && (death === 0 || death > at);
}

const CHILDHOOD_FLAGS: Readonly<Record<string, string>> = {
  'infancia.abuelos': 'abuelos',
  'infancia.campo': 'campo',
  'infancia.familia_unida': 'familia_unida',
  'infancia.hermano_mayor': 'hermano_mayor',
  'infancia.mudanzas': 'mudanzas',
  'infancia.padres_separados': 'padres_separados',
  'infancia.perdida_padre': 'perdida_padre',
};

/** Índices de la 030 que usa el desarrollo: hechos de infancia y uniones por persona. */
export function historyIndex(prior: readonly WorldEvent[]): { childhood: Map<string, string[]>; unions: Map<string, number> } {
  const childhood = new Map<string, string[]>();
  const unions = new Map<string, number>();
  for (const e of prior) {
    if (e.type === 'CHILDHOOD_EVENT') {
      const p = e.payload as { citizenId: string; kind: string };
      childhood.set(p.citizenId, [...(childhood.get(p.citizenId) ?? []), p.kind]);
    } else if (e.type === 'UNION_FORMED') {
      for (const x of e.participants) if (!unions.has(x.id) || e.at < unions.get(x.id)!) unions.set(x.id, e.at);
    }
  }
  return { childhood, unions };
}

export function devContext(world: World, id: EntityId, index: ReturnType<typeof historyIndex>, all: readonly EntityId[]): DevContext {
  const me = world.citizens.get(id)!;
  const birth = birthOf(world, id);
  const age = Math.floor((world.now - birth) / YEAR);
  const flags = new Set<string>();
  for (const k of index.childhood.get(id) ?? []) if (CHILDHOOD_FLAGS[k]) flags.add(CHILDHOOD_FLAGS[k]);
  const h = me.householdId ? world.households.get(me.householdId) : undefined;
  const dwelling = h ? world.places.get(h.dwellingId) : undefined;
  const stratum = (dwelling?.districtId ? world.places.get(dwelling.districtId)?.stratum : undefined) ?? dwelling?.stratum ?? 3;
  if (stratum <= 2) flags.add('estrato_bajo');
  if (col(world, 'demo.education', id) >= 4) flags.add('estudios_superiores');

  const parentsOf = (x: EntityId | undefined) => {
    const p = x ? world.citizens.get(x) : undefined;
    return [p?.motherId, p?.fatherId].filter((y): y is EntityId => y !== undefined);
  };
  const siblings = all.filter((x) => x !== id && ((me.motherId && world.citizens.get(x)?.motherId === me.motherId) || (me.fatherId && world.citizens.get(x)?.fatherId === me.fatherId)));
  const children = all.filter((x) => world.citizens.get(x)?.motherId === id || world.citizens.get(x)?.fatherId === id);
  const k = h?.kinship.find((x) => x.kind === 'partner' && (x.from === id || x.to === id));
  const partner = k ? (k.from === id ? k.to : k.from) : undefined;
  const firstChild = children.map((x) => birthOf(world, x)).sort((a, b) => a - b)[0];
  const occ = me.occupation;
  return {
    id, birth, age, flags,
    kin: {
      ...(me.motherId ? { mother: me.motherId } : {}),
      ...(me.fatherId ? { father: me.fatherId } : {}),
      grandparents: [...parentsOf(me.motherId), ...parentsOf(me.fatherId)],
      siblings: [...siblings].sort(),
      ...(partner ? { partner } : {}),
      children: [...children].sort(),
    },
    ...(partner ? { partnerSince: index.unions.get(id) ?? birth + 24 * YEAR } : {}),
    ...(occ && occ.kind !== 'none' ? { workingSince: birth + 18 * YEAR } : {}),
    ...(firstChild !== undefined ? { firstChildAt: firstChild } : {}),
  };
}

/** Condiciones de `requires` en el minuto del episodio. */
export function meets(c: DevContext, req: string, at: number): boolean {
  switch (req) {
    case 'edad_2': // los episodios verbales (elogio, reglas, nombrar emociones) desde los 2 años
      return at - c.birth >= 2 * YEAR;
    case 'edad_14':
      return at - c.birth >= 14 * YEAR;
    case 'empleado':
      return c.workingSince !== undefined && at >= c.workingSince;
    case 'con_pareja':
      return c.partnerSince !== undefined && at >= c.partnerSince;
    case 'con_hijos':
      return c.firstChildAt !== undefined && at >= c.firstChildAt;
    default:
      return c.flags.has(req);
  }
}
