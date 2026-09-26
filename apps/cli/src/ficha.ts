// Fichas de salud (031) y de esparcimiento (032) para `citizen:report`, y resúmenes para `world:report`.
// Solo leen el estado persistido (CLAUDE.md §8).
import { ageInYears, idNumber } from '@datas-world/engine';
import type { Citizen, CountryProfile, EntityId, World } from '@datas-world/engine';
import { amenityPlan, loadCatalog } from '@datas-world/generators';
import type { CatalogName } from '@datas-world/generators';
import { dayOf } from './common.ts';

const INSURANCE = ['sin afiliación', 'contributivo (cotizante)', 'contributivo (beneficiario)', 'subsidiado', 'especial o de excepción'];
const BMI = ['bajo peso', 'peso normal', 'sobrepeso', 'obesidad'];
const TOBACCO = ['no fuma', 'exfumador', 'fuma'];
const ALCOHOL = ['no bebe', 'bebe ocasionalmente', 'bebe con frecuencia', 'consumo de riesgo'];
const DOMAINS: [number, string][] = [
  [1, 'ver'],
  [2, 'oír'],
  [4, 'caminar'],
  [8, 'usar las manos'],
  [16, 'entender o recordar'],
  [32, 'autocuidado'],
  [64, 'comunicarse'],
];

// Los catálogos se leen del disco una vez por proceso: los informes recorren a todas las personas.
const cache = new Map<CatalogName, ReturnType<typeof loadCatalog>>();
const catalog = (name: CatalogName) => {
  if (!cache.has(name)) cache.set(name, loadCatalog(name));
  return cache.get(name)!;
};
const names = (name: CatalogName) => new Map(catalog(name).entries.map((e) => [e.key, e.name]));

/** Líneas de la ficha de salud y de esparcimiento de una persona (vacías si el mundo no las tiene). */
export function fichaLines(world: World, c: Citizen): string[] {
  const u8 = world.components.u8;
  if (!('health.insurance' in u8) || c.ancestor) return [];
  const row = idNumber(c.id);
  const v = (col: string) => u8[col]![row]!;
  const dis = DOMAINS.filter(([bit]) => v('health.disability') & bit).map(([, n]) => n);
  const out = [
    '',
    'Salud',
    `  Afiliación: ${INSURANCE[v('health.insurance')]} · salud física ${world.components.f32['health.physical']![row]!.toFixed(2)}`,
    `  ${BMI[v('health.bmiClass')]} · ${TOBACCO[v('health.tobacco')]} · ${ALCOHOL[v('health.alcohol')]} · actividad física ${v('health.activityDays')} días/semana · duerme ${v('health.sleepHours')} h`,
    `  Discapacidad: ${dis.length ? dis.join(', ') : 'ninguna'}`,
  ];
  const conditions = names('health_conditions');
  for (const h of c.conditions ?? [])
    out.push(`  ${conditions.get(h.key) ?? h.key} desde ${dayOf(h.since, world.config.epoch)}${h.controlled ? ' (controlada)' : ''}`);
  if (c.leisure) {
    const acts = names('leisure_activities');
    out.push('', 'Esparcimiento');
    for (const x of c.leisure)
      out.push(
        `  ${acts.get(x.key) ?? x.key}: afinidad ${x.affinity.toFixed(2)}, ` +
          (x.perMonth > 0 ? `${x.perMonth.toFixed(1)} veces al mes` : 'le gusta, pero hoy no le alcanzan el dinero o el tiempo'),
      );
  }
  return out;
}

/**
 * Temperamento de una persona (009 v1.0 R-003): descriptores Big Five y parámetros de aprendizaje, con la
 * advertencia de que describen cómo aprende, no explican su conducta. Vacío si el mundo no los tiene.
 */
export function temperamentLines(world: World, c: Citizen): string[] {
  const f32 = world.components.f32;
  if (c.ancestor) return [];
  const row = idNumber(c.id);
  const col = (e: { attrs?: Record<string, unknown> | undefined }) => String(e.attrs?.column ?? '');
  const traits = catalog('personality_traits').entries.filter((e) => col(e) in f32);
  const params = catalog('temperament_params').entries.filter((e) => col(e) in f32);
  if (!traits.length && !params.length) return [];
  const out = ['', 'Temperamento (describe cómo aprende; no explica su conducta, que sale de su historia)'];
  if (traits.length) out.push(`  Big Five: ${traits.map((e) => `${e.name.toLowerCase()} ${f32[col(e)]![row]!.toFixed(2)}`).join(' · ')}`);
  for (const e of params) out.push(`  ${e.name}: ${f32[col(e)]![row]!.toFixed(2)}`);
  return out;
}

const living = (world: World) => [...world.citizens.values()].filter((c) => !c.ancestor && c.status === 'active');
const ageOf = (world: World, id: EntityId) =>
  ageInYears(world.components.i32['demo.birthMinute']![idNumber(id)]!, world.now, world.config.epoch);
const pct = (x: number) => `${(x * 100).toFixed(1)} %`;

/** `world:report --health`: afiliación, prevalencias y discapacidad del mundo (031 §9). */
export function healthSummary(world: World): string[] {
  const people = living(world);
  if (!('health.insurance' in world.components.u8)) return ['', 'Salud: el perfil de este mundo no tiene ficha de salud'];
  const u8 = (col: string, c: Citizen) => world.components.u8[col]![idNumber(c.id)]!;
  const count = (f: (c: Citizen) => boolean) => people.filter(f).length / Math.max(1, people.length);
  const conditions = names('health_conditions');
  const out = ['', 'Salud', `  Afiliación: ${INSURANCE.map((n, i) => `${n} ${pct(count((c) => u8('health.insurance', c) === i))}`).join(' · ')}`];
  const adults = people.filter((c) => ageOf(world, c.id) >= 18 && ageOf(world, c.id) < 65);
  out.push(`  Exceso de peso (18–64): ${pct(adults.filter((c) => u8('health.bmiClass', c) >= 2).length / Math.max(1, adults.length))} · fuman: ${pct(count((c) => u8('health.tobacco', c) === 2))} · con discapacidad: ${pct(count((c) => u8('health.disability', c) > 0))}`);
  for (const [key, name] of conditions) out.push(`  ${name}: ${pct(count((c) => (c.conditions ?? []).some((h) => h.key === key)))}`);
  return out;
}

/** `world:report --leisure`: práctica de cada actividad (12 años o más) frente a la popularidad del perfil. */
export function leisureSummary(world: World, profile: CountryProfile): string[] {
  const people = living(world).filter((c) => ageOf(world, c.id) >= 12);
  if (!people.some((c) => c.leisure)) return ['', 'Esparcimiento: el perfil de este mundo no tiene ficha de esparcimiento'];
  const popularity = (profile.entries.find((e) => e.key === 'leisure.popularity')?.value ?? {}) as Record<string, number>;
  const acts = names('leisure_activities');
  const out = ['', 'Esparcimiento (12 años o más)', `${'Actividad'.padEnd(36)} ${'Mundo'.padStart(7)} ${'Perfil'.padStart(7)} ${'Veces/mes'.padStart(10)}`];
  for (const [key, name] of acts) {
    const doers = people.filter((c) => (c.leisure ?? []).some((x) => x.key === key));
    const freq = doers.length ? doers.reduce((s, c) => s + c.leisure!.find((x) => x.key === key)!.perMonth, 0) / doers.length : 0;
    out.push(
      `${name.padEnd(36)} ${pct(doers.length / Math.max(1, people.length)).padStart(7)} ${(popularity[key] !== undefined ? pct(popularity[key]) : '—').padStart(7)} ${freq.toFixed(1).padStart(10)}`,
    );
  }
  return out;
}

/** `world:report --places`: lugares por tipo y ámbito, y dotación esperada frente a la generada (033 §9). */
export function placesSummary(world: World): string[] {
  const kinds = names('place_kinds');
  const local = new Map<string, number>();
  const regional: string[] = [];
  for (const p of world.places.values()) {
    if (p.kind.startsWith('territorio.') || p.kind.startsWith('vivienda.')) continue;
    if (p.rect) local.set(p.kind, (local.get(p.kind) ?? 0) + 1);
    else if (p.travel) regional.push(p.name);
  }
  if (regional.length === 0) {
    // Mundo sin dotación (perfil prototipo): solo los lugares que hay.
    return ['', 'Lugares', ...[...local].sort().map(([k, n]) => `  ${(kinds.get(k) ?? k).padEnd(30)} ${String(n).padStart(3)}`)];
  }
  const plan = amenityPlan(catalog('place_kinds'), world.config.population.target);
  const out = ['', `Lugares (dotación para ${world.config.population.target} habitantes)`];
  for (const { kind, count } of plan.local) {
    const got = local.get(kind) ?? 0;
    out.push(`  ${(kinds.get(kind) ?? kind).padEnd(30)} ${String(got).padStart(3)} de ${count}${got < count ? ' (no cupo en la plantilla)' : ''}`);
  }
  out.push(`  En la ciudad de referencia: ${regional.join(', ')}`);
  return out;
}
