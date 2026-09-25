// Ficha de salud, fase 1 (spec 031 R-002, R-004, R-005): hábitos, peso y discapacidad. Va antes del empleo,
// porque la discapacidad para caminar o para el autocuidado baja la probabilidad de trabajar (R-004).
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
 * Hábitos (R-002), peso y discapacidad (R-004) de cada persona viva, con el flujo `gen:health/<id>`.
 * La personalidad (009) modula: impulsividad → tabaco y alcohol; responsabilidad → actividad física; el valor
 * "salud" → más actividad y menos tabaco. Un menor de 15 no fuma ni bebe (R-005, INV-004).
 */
export function generateHabits(world: World, livingIds: readonly EntityId[], P: HealthParams, rng: Rng): void {
  defineHealthColumns(world);
  const c = world.components;
  for (const id of livingIds) {
    const row = idNumber(id);
    const r = rng.fork('gen:health').fork(id);
    const p = world.citizens.get(id)!;
    const sex = p.sex!;
    const age = ageInYears(c.i32['demo.birthMinute']![row]!, world.now, world.config.epoch);
    const impulsivity = c.f32['pers.impulsivity']?.[row] ?? 0.5;
    const conscientiousness = c.f32['pers.conscientiousness']?.[row] ?? 0.5;
    const valuesHealth = (c.f32['val.health']?.[row] ?? 0.5) > 0.7;
    const u8 = c.u8;

    // Tabaco y alcohol: prevalencia del perfil × sexo × personalidad (media 1 con la impulsividad de 009).
    const mood = 0.6 + 0.8 * impulsivity;
    if (age >= 15) {
      const pCur = P.tobaccoCurrent * P.tobaccoBySex[sex]! * mood * (valuesHealth ? 0.7 : 1) * (age > 65 ? 0.6 : 1);
      const pEx = P.tobaccoBySex.exsmokerShare! * (age >= 30 ? 1.5 : 0.5);
      const t = r.next();
      u8['health.tobacco']![row] = t < pCur ? 2 : t < pCur + pEx ? 1 : 0;
      if (r.chance(clamp(P.alcoholLastMonth * P.alcoholLevels[sex]! * mood, 0, 0.95))) {
        const a = r.next();
        u8['health.alcohol']![row] = a < P.alcoholLevels.risky! ? 3 : a < P.alcoholLevels.risky! + P.alcoholLevels.frequent! ? 2 : 1;
      }
    }

    // Actividad física: los adultos cumplen la recomendación (≥ 5 días) según ENSIN; los escolares, educación física.
    let days: number;
    if (age >= 18) {
      const pMeet = clamp(P.activityMeets * (0.6 + 0.8 * conscientiousness) * (valuesHealth ? 1.15 : 1) * (age >= 65 ? 0.7 : 1), 0, 0.95);
      days = r.chance(pMeet) ? r.int(5, 7) : r.int(0, 4);
    } else if (age >= 5) days = r.int(3, 5) + r.int(0, 2);
    else days = 7; // los niños pequeños juegan a diario
    u8['health.activityDays']![row] = days;
    u8['health.sleepHours']![row] = age < 13 ? r.int(9, 10) : clamp(Math.round(r.normal(7, 1)), 4, 10);

    // Peso (índice de masa corporal por categorías): perfil por edad, menos obesidad con actividad.
    const table = age >= 18 ? P.bmiAdult : P.bmiChildren;
    const pObese = table.obese! * (days >= 5 ? 0.8 : 1.15) * (age >= 18 && age < 30 ? 0.7 : 1);
    const pOver = table.overweight!;
    const b = r.next();
    u8['health.bmiClass']![row] = b < pObese ? 3 : b < pObese + pOver ? 2 : b < pObese + pOver + 0.03 ? 0 : 1;

    // Discapacidad (R-004): prevalencia por edad; dominios independientes, al menos uno.
    if (r.chance(stepAt(P.disabilityByAge, age))) {
      let mask = 0;
      for (const [domain, w] of Object.entries(P.disabilityDomains).sort(([a], [b2]) => (a < b2 ? -1 : 1)))
        if (r.chance(w)) mask |= DISABILITY_BITS[domain] ?? 0;
      u8['health.disability']![row] = mask || DISABILITY_BITS.ver!;
    }
  }
}

/** 031 R-004: la discapacidad para caminar o para el autocuidado limita el empleo. */
export const limitsWork = (world: World, id: EntityId): boolean =>
  ((world.components.u8['health.disability']?.[idNumber(id)] ?? 0) & (DISABILITY_BITS.caminar! | DISABILITY_BITS.autocuidado!)) !== 0;
