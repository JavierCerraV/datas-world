// Expediente de una persona (spec 022 R-015, para el expediente de vida de la 024 R-022): lo que la ficha no trae.
// Identidad, «por qué está donde está», agenda de hoy, familia, salud, objetos y todos sus eventos marcados como
// historia de origen (030) o simulación. Funciones puras sobre el mundo cargado; no cambian el estado.
import { MINUTES_PER_DAY, dayInfo, idNumber, planAt } from '@datas-world/engine';
import type { EntityId, World, WorldEvent } from '@datas-world/engine';
import type { Catalogs } from '@datas-world/generators';
import type { Movement } from '@datas-world/persistence';
import { relatives } from './life.ts';
import { whereAndUntil } from './observe.ts';
import { dateOf, eventView, nameOf } from './views.ts';

const YEAR = 365.25 * MINUTES_PER_DAY;
const SLOT = 10; // minutos por casilla de la agenda

/** Clase de cada bloque de la agenda, como el lienzo: dormir, desplazamiento, obligación, cuidado propio o libre. */
export type AgendaKind = 'dormir' | 'desplazamiento' | 'trabajo' | 'estudio' | 'obligacion' | 'cuidado' | 'libre';
const KIND_OF: Record<string, AgendaKind> = {
  sleep: 'dormir', work: 'trabajo', study: 'estudio', job_search: 'obligacion', chores: 'obligacion', errands: 'obligacion', care: 'obligacion',
  wash: 'cuidado', eat: 'cuidado', leisure: 'libre',
};
export interface AgendaBlock { from: number; to: number; kind: AgendaKind; activity: string }

/** Tipos de evento que explican dónde está una persona (su ocupación y su llegada al mundo). */
const WHY_TYPES = new Set(['JOB_HIRED', 'JOB_LOST', 'INFORMAL_WORK_STARTED', 'RETIRED', 'STUDIES_COMPLETED', 'MIGRATED', 'HOUSEHOLD_FORMED']);
const CLOSE = new Set(['madre', 'padre', 'pareja', 'hija', 'hijo', 'hermana', 'hermano']);
const ORDER = ['padre', 'madre', 'pareja', 'hija', 'hijo', 'hermana', 'hermano'];

const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * Agenda de hoy: la rutina prevista (011) en bloques del día, con los viajes guardados del día como desplazamiento.
 * Cubre las 24 horas sin huecos (CA-012).
 */
export function agendaOf(world: World, id: EntityId, moves: readonly Movement[]): AgendaBlock[] {
  const row = idNumber(id);
  const dayStart = Math.floor(world.now / MINUTES_PER_DAY) * MINUTES_PER_DAY;
  const day = dayInfo(world, world.now);
  const slots: { kind: AgendaKind; activity: string }[] = [];
  for (let m = 0; m < MINUTES_PER_DAY; m += SLOT) {
    const p = planAt(world, row, day, m);
    slots.push({ kind: KIND_OF[p.activity] ?? 'libre', activity: p.activity });
  }
  for (const mv of moves) {
    if (mv.citizenId !== id) continue;
    const a = Math.max(0, mv.departAt - dayStart);
    const b = Math.min(MINUTES_PER_DAY, mv.arriveAt - dayStart);
    for (let m = Math.floor(a / SLOT) * SLOT; m < b; m += SLOT) slots[m / SLOT] = { kind: 'desplazamiento', activity: 'commute' };
  }
  const out: AgendaBlock[] = [];
  slots.forEach((s, k) => {
    const last = out.at(-1);
    if (last && last.kind === s.kind && last.activity === s.activity) last.to = (k + 1) * SLOT;
    else out.push({ from: k * SLOT, to: (k + 1) * SLOT, ...s });
  });
  return out;
}

/** Desde cuándo y hasta cuándo queda libre hoy, a partir del minuto actual (o nada si no le queda tiempo libre). */
export function freeWindow(blocks: readonly AgendaBlock[], minute: number): { from: string; to: string } | null {
  const k = blocks.findIndex((b) => b.kind === 'libre' && b.to > minute);
  if (k < 0) return null;
  const from = Math.max(blocks[k]!.from, minute);
  let to = blocks[k]!.to;
  for (let j = k + 1; j < blocks.length && (blocks[j]!.kind === 'libre' || (blocks[j]!.kind === 'cuidado' && blocks[j]!.activity === 'wash')); j++) to = blocks[j]!.to;
  return { from: hhmm(from), to: hhmm(to % MINUTES_PER_DAY) };
}

const catalogName = (c: Catalogs, cat: keyof Catalogs, key: string) => c[cat].entries.find((e) => e.key === key)?.name ?? key;

/** Situación de un familiar: murió (año y edad), vive fuera o su edad con lo que hace. */
function situation(world: World, rid: string): string {
  const c = world.citizens.get(rid as EntityId);
  const row = idNumber(rid as EntityId);
  const birth = world.components.i32['demo.birthMinute']?.[row] ?? 0;
  const death = world.components.i32['demo.deathMinute']?.[row] ?? 0;
  if (death !== 0 && (c?.status === 'inactive' || death <= world.now))
    return `Murió en ${dateOf(world, death).slice(0, 4)}, a los ${Math.floor((death - birth) / YEAR)}`;
  if (c?.ancestor) return 'Vive fuera del mundo';
  const age = Math.floor((world.now - birth) / YEAR);
  const occ = c?.occupation;
  const org = occ && 'orgId' in occ ? world.organizations.get(occ.orgId)?.name : undefined;
  const what = org ?? (occ?.kind === 'none' ? { student: 'estudiante', unemployed: 'sin empleo', pensioned: 'pensionado', home_duties: 'labores del hogar', minor: 'menor de edad', other_inactive: 'inactivo' }[occ.reason] : occ && 'trade' in occ ? occ.trade.replace(/_/g, ' ') : '');
  return `${age}${what ? ` · ${what}` : ''}`;
}

/** 022 R-015: el expediente. `events` son todos los de la persona en orden cronológico; `chats`, cuántas charlas tuvo. */
export function dossierView(world: World, id: EntityId, events: readonly WorldEvent[], moves: readonly Movement[], catalogs: Catalogs, chats: number) {
  const c = world.citizens.get(id);
  if (!c || c.ancestor) return undefined;
  const row = idNumber(id);
  const i = world.components.i32;
  const u = world.components.u8;
  const birth = i['demo.birthMinute']?.[row] ?? 0;
  const edu = catalogs.education_levels.entries.find((e) => (e.attrs as { column?: number } | undefined)?.column === (u['demo.education']?.[row] ?? 0));
  const born = events.find((e) => e.type === 'CITIZEN_BORN' && (e.payload as { citizenId?: string }).citizenId === id);
  const migrated = [...events].reverse().find((e) => e.type === 'MIGRATED' && (e.payload as { citizenId?: string }).citizenId === id);
  const household = c.householdId ? world.households.get(c.householdId) : undefined;
  const views = events.map((e) => ({ ...eventView(world, e), origin: e.at < 0 }));

  // Familia cercana: padres, pareja, hijos y hermanos, con su situación.
  const family = [...relatives(world, id)]
    .filter(([rid, r]) => rid !== id && CLOSE.has(r.relation(world.citizens.get(rid as EntityId)?.sex ?? 'F')))
    .map(([rid, r]) => ({ id: rid, name: nameOf(world, rid) ?? rid, relation: r.relation(world.citizens.get(rid as EntityId)?.sex ?? 'F'), situation: situation(world, rid) }))
    .sort((a, b) => ORDER.indexOf(a.relation) - ORDER.indexOf(b.relation) || (a.id < b.id ? -1 : 1));

  // Salud (031): el último régimen, las condiciones y los episodios de la simulación.
  const insurance = [...events].reverse().find((e) => e.type === 'HEALTH_INSURANCE_SET');
  const overslept = events.filter((e) => e.type === 'OVERSLEPT');
  const ill = events.filter((e) => e.type === 'FELL_ILL');

  // Objetos (005): de la persona o de su hogar, con la fecha y el precio de su adquisición.
  const acquired = new Map(events.filter((e) => e.type === 'OBJECT_ACQUIRED' || e.type === 'OBJECT_INHERITED').map((e) => [(e.payload as { objectId?: string }).objectId, e]));
  const objects = [...world.objects.values()]
    .filter((o) => o.fate === 'owned' && (o.ownerId === id || (household && o.ownerId === household.id)))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((o) => {
      const e = acquired.get(o.id);
      return { id: o.id, name: o.name, owner: o.ownerId === id ? 'persona' : 'hogar', acquired: e ? dateOf(world, e.at).slice(0, 7) : null, price: (e?.payload as { price?: number } | undefined)?.price ?? o.marketValue };
    });

  const agenda = agendaOf(world, id, moves);
  const minute = world.now % MINUTES_PER_DAY;
  const where = whereAndUntil(world, id);
  return {
    id,
    identity: {
      birthDate: dateOf(world, birth).slice(0, 10),
      birthplace: (born?.payload as { placeName?: string } | undefined)?.placeName ?? (c.birthplace ? catalogName(catalogs, 'birthplaces', c.birthplace) : null),
      education: edu?.name ?? null,
      arrived: migrated ? { date: dateOf(world, migrated.at).slice(0, 10), from: (migrated.payload as { from?: string }).from ?? null, reason: migrated.causes.map((k) => ('state' in k ? k.state.replace(/_/g, ' ') : '')).filter(Boolean)[0] ?? null } : null,
      household: household ? { id: household.id, members: household.memberIds.length, tenure: household.tenure ?? null } : null,
    },
    why: views.filter((e) => WHY_TYPES.has(e.type) && e.participants.some((p) => p.id === id)).slice(-3),
    until: where.until,
    agenda: { blocks: agenda, now: minute, free: freeWindow(agenda, minute) },
    family,
    health: {
      insurance: insurance ? { regime: (insurance.payload as { regime?: string }).regime ?? null, since: dateOf(world, insurance.at).slice(0, 10) } : null,
      conditions: (c.conditions ?? []).map((k) => ({ name: catalogName(catalogs, 'health_conditions', k.key), since: dateOf(world, k.since).slice(0, 10), controlled: k.controlled })),
      illnesses: ill.map((e) => dateOf(world, e.at).slice(0, 10)),
      overslept: { count: overslept.length, last: overslept.at(-1) ? dateOf(world, overslept.at(-1)!.at).slice(0, 10) : null },
    },
    objects,
    debts: (c.debts ?? []).map((d) => ({ creditor: d.creditor, balance: d.balance, installment: d.installment, period: d.period })),
    events: views,
    counts: { events: views.length, functions: c.functions?.f.length ?? 0, rules: c.rules?.length ?? 0, chats },
  };
}
export type Dossier = NonNullable<ReturnType<typeof dossierView>>;
