// Ficha de un lugar (spec 022 R-007): nombre, tipo, barrio y horario, quién está dentro ahora y, si es vivienda o un
// edificio de viviendas, quién vive allí. Solo lee el estado persistido.
import { ACTIVITY_COLUMN, idNumber } from '@datas-world/engine';
import type { EntityId, World } from '@datas-world/engine';
import { ACTIVITY_NAME, living, nameOf, open } from './views.ts';

export interface PlaceDetail {
  id: string;
  name: string;
  kind: string;
  district: string | null;
  open: string;
  inside: { id: string; name: string; activity: string }[];
  residents: { id: string; name: string }[];
  /** 022 R-014: quién trabaja aquí (puestos ocupados de las organizaciones del lugar); `boss` si no tiene jefe. */
  staff: { id: string; name: string; title: string; org: string; boss: boolean }[];
}

export function placeDetail(world: World, id: EntityId): PlaceDetail | undefined {
  const p = world.places.get(id);
  if (!p) return undefined;
  // El lugar y los que contiene (las viviendas de un edificio).
  const rows = new Set([idNumber(id), ...[...world.places.values()].filter((q) => q.parentId === id).map((q) => idNumber(q.id))]);
  const i = world.components.i32;
  const inside = living(world)
    .filter((c) => {
      const row = idNumber(c.id);
      return rows.has(i['loc.place']?.[row] ?? 0) && (i['trip.to']?.[row] ?? 0) === 0;
    })
    .map((c) => ({ id: c.id, name: nameOf(world, c.id) ?? c.id, activity: ACTIVITY_NAME[world.components.u8[ACTIVITY_COLUMN]?.[idNumber(c.id)] ?? 0] ?? 'idle' }));
  const residents = [...world.households.values()]
    .filter((h) => rows.has(idNumber(h.dwellingId)))
    .flatMap((h) => h.memberIds)
    .filter((m) => world.citizens.get(m)?.status === 'active')
    .sort()
    .map((m) => ({ id: m, name: nameOf(world, m) ?? m }));
  const staff = [...world.organizations.values()]
    .filter((o) => o.status === 'active' && o.placeIds.some((x) => rows.has(idNumber(x))))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .flatMap((o) => o.positions.filter((q) => q.holderId && world.citizens.get(q.holderId)?.status === 'active').map((q) => ({
      id: q.holderId!, name: nameOf(world, q.holderId!) ?? q.holderId!, title: q.title, org: o.name, boss: !q.supervisorPositionId,
    })))
    .sort((a, b) => Number(b.boss) - Number(a.boss) || a.name.localeCompare(b.name, 'es'));
  return {
    id, name: p.name, kind: p.kind, district: p.districtId ? world.places.get(p.districtId)?.name ?? null : null, open: open(p), inside, residents, staff,
  };
}
