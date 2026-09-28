// Ficha de salud, fase 1 (spec 031 R-002, R-004, R-005): sueño y discapacidad antes del empleo (la discapacidad para
// caminar o para el autocuidado baja la probabilidad de trabajar, R-004); los hábitos y el peso, después del
// desarrollo (041 R-008), desde lo aprendido y no desde rasgos.
import { ageInYears, defineColumn, idNumber } from '@datas-world/engine';
import type { EntityId, Rng, World } from '@datas-world/engine';
import { DISABILITY_BITS, stepAt } from './params.ts';
import type { HealthParams } from './params.ts';

/** Columnas de la ficha de salud (031 §3); `health.physical` ya existe (007). */
export const HEALTH_COLUMNS = [
  'health.insurance',
  'health.bmiClass',
  'health.tobacco',
  'health.alcohol',
  'health.activityDays',
  'health.sleepHours',
  'health.disability',
] as const;

export function defineHealthColumns(world: World): void {
  for (const name of HEALTH_COLUMNS) if (!(name in world.components.u8)) defineColumn(world.components, 'u8', name, 0);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Ficha de salud, fase 1a (R-004): horas de sueño y discapacidad de cada persona viva, con el flujo
 * `gen:health/<id>`. Va antes del empleo (la discapacidad limita el trabajo). Los hábitos que salen de la historia
 * (tabaco, alcohol, actividad física) y el peso van en `learnedHabits`, después del desarrollo (041 R-008).
 */
export function generateHabits(world: World, livingIds: readonly EntityId[], P: HealthParams, rng: Rng): void {
  defineHealthColumns(world);
  const c = world.components;
  for (const id of livingIds) {
    const row = idNumber(id);
    const r = rng.fork('gen:health').fork(id);
    const age = ageInYears(c.i32['demo.birthMinute']![row]!, world.now, world.config.epoch);
    const u8 = c.u8;
    u8['health.sleepHours']![row] = age < 13 ? r.int(9, 10) : clamp(Math.round(r.normal(7, 1)), 4, 10);

    // Discapacidad (R-004): prevalencia por edad; dominios independientes, al menos uno.
    if (r.chance(stepAt(P.disabilityByAge, age))) {
      let mask = 0;
      for (const [domain, w] of Object.entries(P.disabilityDomains).sort(([a], [b2]) => (a < b2 ? -1 : 1)))
        if (r.chance(w)) mask |= DISABILITY_BITS[domain] ?? 0;
      u8['health.disability']![row] = mask || DISABILITY_BITS.ver!;
    }
  }
}

/** Fuerza aprendida de una respuesta de la historia (041), o su fuerza de partida si la persona no la vivió. */
const learned = (world: World, id: EntityId, responses: readonly string[]): number => {
  const r = world.citizens.get(id)?.functions?.r ?? [];
  return Math.max(0.1, ...responses.map((k) => r.find((x) => x.r === k && x.c === '')?.w ?? 0.1));
};
/** Valora la salud (038): el dominio vital tiene función apetitiva aprendida. */
const valuesHealth = (world: World, id: EntityId): boolean => (world.citizens.get(id)?.functions?.f.find((f) => f.s === 'dominio.salud')?.v ?? 0) > 0.3;

/**
 * Ficha de salud, fase 1b (031 R-002; 041 R-008, decisión 5): tabaco, alcohol, actividad física y peso, con el flujo
 * `gen:health/habitos/<id>`. La prevalencia es la del perfil (ENS, ENSIN); quién tiene el hábito lo reparte su
 * historia: cada persona pesa por su fuerza aprendida dividida por la media de la población (fumar con los amigos,
 * beber para olvidar, hacer deporte), así que la historia no cambia cuántos, sino quiénes. Valorar la salud (038)
 * baja el tabaco y sube la actividad. Un menor de 15 no fuma ni bebe (R-005, INV-004).
 */
export function learnedHabits(world: World, livingIds: readonly EntityId[], P: HealthParams, rng: Rng): void {
  const c = world.components;
  const ageOf = (id: EntityId) => ageInYears(c.i32['demo.birthMinute']![idNumber(id)]!, world.now, world.config.epoch);
  const relative = (ids: readonly EntityId[], responses: readonly string[]) => {
    const ws = new Map(ids.map((id) => [id, learned(world, id, responses)]));
    const mean = [...ws.values()].reduce((a, w) => a + w, 0) / Math.max(1, ws.size);
    return (id: EntityId) => clamp((ws.get(id) ?? mean) / mean, 0.3, 2.5);
  };
  const teens = livingIds.filter((id) => ageOf(id) >= 15);
  const adults = livingIds.filter((id) => ageOf(id) >= 18);
  const smoke = relative(teens, ['habito.fumar']);
  const drink = relative(teens, ['habito.beber', 'evit.consumir']);
  const move = relative(adults, ['habito.ejercicio']);
  for (const id of livingIds) {
    const row = idNumber(id);
    const r = rng.fork('gen:health/habitos').fork(id);
    const sex = world.citizens.get(id)!.sex!;
    const age = ageOf(id);
    const health = valuesHealth(world, id);
    const u8 = c.u8;
    if (age >= 15) {
      const pCur = P.tobaccoCurrent * P.tobaccoBySex[sex]! * smoke(id) * (health ? 0.7 : 1) * (age > 65 ? 0.6 : 1);
      const pEx = P.tobaccoBySex.exsmokerShare! * (age >= 30 ? 1.5 : 0.5);
      const t = r.next();
      u8['health.tobacco']![row] = t < pCur ? 2 : t < pCur + pEx ? 1 : 0;
      if (r.chance(clamp(P.alcoholLastMonth * P.alcoholLevels[sex]! * drink(id), 0, 0.95))) {
        const a = r.next();
        u8['health.alcohol']![row] = a < P.alcoholLevels.risky! ? 3 : a < P.alcoholLevels.risky! + P.alcoholLevels.frequent! ? 2 : 1;
      }
    }
    // Actividad física: los adultos cumplen la recomendación (≥ 5 días) según ENSIN; los escolares, educación física.
    let days: number;
    if (age >= 18) {
      const pMeet = clamp(P.activityMeets * move(id) * (health ? 1.15 : 1) * (age >= 65 ? 0.7 : 1), 0, 0.95);
      days = r.chance(pMeet) ? r.int(5, 7) : r.int(0, 4);
    } else if (age >= 5) days = r.int(3, 5) + r.int(0, 2);
    else days = 7; // los niños pequeños juegan a diario
    u8['health.activityDays']![row] = days;
    // Peso (índice de masa corporal por categorías): perfil por edad, menos obesidad con actividad.
    const table = age >= 18 ? P.bmiAdult : P.bmiChildren;
    const pObese = table.obese! * (days >= 5 ? 0.8 : 1.15) * (age >= 18 && age < 30 ? 0.7 : 1);
    const pOver = table.overweight!;
    const b = r.next();
    u8['health.bmiClass']![row] = b < pObese ? 3 : b < pObese + pOver ? 2 : b < pObese + pOver + 0.03 ? 0 : 1;
  }
}

/** 031 R-004: la discapacidad para caminar o para el autocuidado limita el empleo. */
export const limitsWork = (world: World, id: EntityId): boolean =>
  ((world.components.u8['health.disability']?.[idNumber(id)] ?? 0) & (DISABILITY_BITS.caminar! | DISABILITY_BITS.autocuidado!)) !== 0;
