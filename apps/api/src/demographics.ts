// Demografía del mundo (spec 022 R-016) para el dashboard de la 024 R-023 y el panel «Ahora» de la R-021: personas,
// nacidos y fallecidos del periodo, hogares, organizaciones, pirámide por edad y sexo, ocupación y lo que hace la gente
// ahora. Solo lee el estado guardado y cuenta eventos en la base.
import { ACTIVITY_COLUMN, MINUTES_PER_DAY, formatId, idNumber } from '@datas-world/engine';
import type { EntityId, World } from '@datas-world/engine';
import type { Db } from '@datas-world/persistence';
import { distributionsOf } from './distributions.ts';
import { statsOf } from './observe.ts';
import { ACTIVITY_NAME, dateOf, living } from './views.ts';

const YEAR = 365.25 * MINUTES_PER_DAY;
export type Period = 'month' | 'year' | 'all';
export const PERIOD_MINUTES: Record<Period, number | null> = { month: 30 * MINUTES_PER_DAY, year: 365 * MINUTES_PER_DAY, all: null };

/** Grupos de edad de la pirámide, de 10 en 10 años hasta «80 o más». */
export const AGE_GROUPS = ['0–9', '10–19', '20–29', '30–39', '40–49', '50–59', '60–69', '70–79', '80+'] as const;

/** Ocupaciones del lienzo, en su orden de lectura. */
export const OCCUPATIONS = ['Empleo formal', 'Empleo informal', 'Independiente', 'Estudiante', 'Menor de edad', 'Labores del hogar', 'Pensionado', 'Desempleado', 'Otra inactividad'] as const;
const REASON: Record<string, (typeof OCCUPATIONS)[number]> = {
  student: 'Estudiante', minor: 'Menor de edad', home_duties: 'Labores del hogar', pensioned: 'Pensionado', unemployed: 'Desempleado', other_inactive: 'Otra inactividad',
};

/** Categorías del panel «Ahora»: cada persona cae en una sola (CA-016). */
export const NOW_KINDS = ['trabajando', 'en clase', 'en casa', 'en la calle', 'en otro lugar'] as const;
export type NowKind = (typeof NOW_KINDS)[number];

/** Qué hace una persona ahora, en una de las categorías del panel «Ahora». */
export function nowKindOf(w: World, id: EntityId): NowKind {
  const row = idNumber(id);
  const act = ACTIVITY_NAME[w.components.u8[ACTIVITY_COLUMN]?.[row] ?? 0];
  const moving = (w.components.i32['trip.to']?.[row] ?? 0) > 0;
  if (moving || act === 'commute') return 'en la calle';
  if (act === 'work') return 'trabajando';
  if (act === 'study') return 'en clase';
  const place = w.components.i32['loc.place']?.[row] ?? 0;
  const c = w.citizens.get(id);
  const home = c?.householdId ? w.households.get(c.householdId)?.dwellingId : undefined;
  const p = place > 0 ? w.places.get(formatId('PLC', place)) : undefined;
  if (p && home && p.id === home) return 'en casa';
  if (p?.kind.startsWith('espacio_publico')) return 'en la calle';
  return 'en otro lugar';
}

export function occupationOf(w: World, id: EntityId): (typeof OCCUPATIONS)[number] {
  const o = w.citizens.get(id)?.occupation;
  if (!o) return 'Otra inactividad';
  if (o.kind === 'formal') return 'Empleo formal';
  if (o.kind === 'informal') return 'Empleo informal';
  if (o.kind === 'independent') return 'Independiente';
  return o.kind === 'none' ? REASON[o.reason] ?? 'Otra inactividad' : 'Otra inactividad';
}

const count = (db: Db, type: string, from: number | null, to: number) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM events WHERE type = ? AND at <= ?${from === null ? '' : ' AND at > ?'}`).get(type, to, ...(from === null ? [] : [from])) as { n: number }).n;

/** 022 R-016 (CA-013): la demografía del periodo. */
export function demographicsOf(w: World, db: Db, period: Period) {
  const people = living(w);
  const birth = w.components.i32['demo.birthMinute'];
  const pyramid = AGE_GROUPS.map((group) => ({ group, F: 0, M: 0 }));
  const occ = new Map<string, number>(OCCUPATIONS.map((o) => [o, 0]));
  const now = new Map<NowKind, number>(NOW_KINDS.map((k) => [k, 0]));
  for (const c of people) {
    const age = Math.max(0, Math.floor((w.now - (birth?.[idNumber(c.id)] ?? w.now)) / YEAR));
    const g = pyramid[Math.min(AGE_GROUPS.length - 1, Math.floor(age / 10))]!;
    if (c.sex === 'M') g.M++;
    else g.F++;
    const o = occupationOf(w, c.id);
    occ.set(o, occ.get(o)! + 1);
    const k = nowKindOf(w, c.id);
    now.set(k, now.get(k)! + 1);
  }
  const span = PERIOD_MINUTES[period];
  const from = span === null ? null : w.now - span;
  const births = count(db, 'CITIZEN_BORN', from, w.now);
  const deaths = count(db, 'CITIZEN_DIED', from, w.now);
  const perThousand = (n: number) => (people.length ? Math.round((n / people.length) * 1000 * 10) / 10 : 0);
  const households = [...w.households.values()].filter((h) => h.memberIds.some((m) => w.citizens.get(m)?.status === 'active' && !w.citizens.get(m)?.ancestor));
  const stats = statsOf(w, 0, null);
  const members = households.reduce((s, h) => s + h.memberIds.filter((m) => w.citizens.get(m)?.status === 'active').length, 0);
  return {
    date: dateOf(w, w.now),
    period,
    population: people.length,
    women: people.filter((c) => c.sex !== 'M').length,
    men: people.filter((c) => c.sex === 'M').length,
    births: { count: births, perThousand: perThousand(births) },
    deaths: { count: deaths, perThousand: perThousand(deaths) },
    households: { count: households.length, meanSize: households.length ? Math.round((members / households.length) * 10) / 10 : 0 },
    organizations: [...w.organizations.values()].filter((o) => o.status === 'active').length,
    pyramid,
    occupations: [...occ].map(([name, n]) => ({ name, count: n })).sort((a, b) => b.count - a.count || OCCUPATIONS.indexOf(a.name as never) - OCCUPATIONS.indexOf(b.name as never)),
    now: NOW_KINDS.map((k) => ({ kind: k, count: now.get(k)! })),
    // R-017: ánimo medio, empleo y distribuciones.
    moodMean: stats.moodMean,
    employedPct: stats.employedPct,
    ...distributionsOf(w, people, households),
  };
}
export type Demographics = ReturnType<typeof demographicsOf>;
