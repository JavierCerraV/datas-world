// Enfermedad aguda (spec 010 R-007) y deuda de sueño (R-004). La enfermedad se decide a medianoche; la
// recuperación, cada hora. Sin diagnósticos clínicos: son episodios comunes con duración (R-008).
import { MINUTES_PER_DAY } from '../calendar.ts';
import type { NewEvent } from '../events.ts';
import { formatId } from '../ids.ts';
import type { Patch, System } from '../simulation/system.ts';
import { acuteKeys, needsParams } from './params.ts';

export const illnessSystem: System = {
  id: 'needs.illness',
  phase: 'needs',
  order: 1,
  capability: 'needs',
  cadence: 'hour',
  minLevel: 0,
  run: (view, ctx, rng) => {
    const P = needsParams(view.config.profile!, view.config.epoch.slice(0, 10));
    const keys = acuteKeys(P);
    const f = view.components.f32;
    const i = view.components.i32;
    const u = view.components.u8;
    const patches: Patch[] = [];
    const events: NewEvent[] = [];
    const midnight = ctx.now % MINUTES_PER_DAY === 0;
    for (const row of ctx.citizens) {
      const id = formatId('CIT', row);
      const code = u['health.acute']![row]!;
      if (code > 0) {
        if (ctx.now >= i['health.acuteUntil']![row]!) {
          patches.push({ op: 'set', type: 'u8', column: 'health.acute', row, value: 0 });
          events.push({
            type: 'RECOVERED',
            payload: { citizenId: id, illness: keys[code - 1]! },
            participants: [{ id, role: 'paciente' }],
            causes: [{ state: 'tiempo', value: ctx.now, weight: 1 }],
          });
        }
        continue;
      }
      if (!midnight) continue;
      // Riesgo diario: base del perfil × edad × estrés × deuda de sueño × salud física (031).
      const age = (ctx.now - i['demo.birthMinute']![row]!) / (365.25 * MINUTES_PER_DAY);
      const stress = f['state.stress']![row]!;
      const debt = Math.min(i['state.sleepDebt']![row]!, MINUTES_PER_DAY) / MINUTES_PER_DAY;
      const physical = f['health.physical']?.[row] ?? 1;
      const p = P.acuteDailyP * (age < 5 || age >= 65 ? 1.5 : 1) * (1 + stress) * (1 + debt) * (1.5 - physical);
      const r = rng.fork(id);
      if (!r.chance(Math.min(0.5, p))) continue;
      let x = r.next() * keys.reduce((s, k) => s + P.acuteWeights[k]!, 0);
      const k = keys.find((key) => (x -= P.acuteWeights[key]!) < 0) ?? keys[keys.length - 1]!;
      const days = P.acuteDays[k]!;
      patches.push(
        { op: 'set', type: 'u8', column: 'health.acute', row, value: keys.indexOf(k) + 1 },
        { op: 'set', type: 'i32', column: 'health.acuteUntil', row, value: ctx.now + days * MINUTES_PER_DAY },
      );
      events.push({
        type: 'FELL_ILL',
        payload: { citizenId: id, illness: k, days },
        participants: [{ id, role: 'paciente' }],
        causes: [
          { state: 'estres', entity: id, value: Math.round(stress * 100) / 100, weight: 0.3 },
          { state: 'salud_fisica', entity: id, value: Math.round(physical * 100) / 100, weight: 0.3 },
          { state: 'deuda_de_sueno', entity: id, value: i['state.sleepDebt']![row]!, weight: 0.2 },
          { state: 'rng', weight: 0.2 },
        ],
      });
    }
    return { patches, events };
  },
};

/** R-004: a medianoche, la deuda de sueño suma lo que faltó respecto a las horas de la ficha (031) y se reinicia el día. */
export const sleepSystem: System = {
  id: 'needs.sleep',
  phase: 'end_of_day',
  order: 0,
  capability: 'needs',
  cadence: 'day',
  minLevel: 0,
  run: (view, ctx) => {
    const i = view.components.i32;
    const patches: Patch[] = [];
    for (const row of ctx.citizens) {
      const need = (view.components.u8['health.sleepHours']?.[row] || 8) * 60;
      const debt = Math.max(0, i['state.sleepDebt']![row]! + need - i['state.sleptToday']![row]!);
      patches.push(
        { op: 'set', type: 'i32', column: 'state.sleepDebt', row, value: debt },
        { op: 'set', type: 'i32', column: 'state.sleptToday', row, value: 0 },
      );
    }
    return { patches };
  },
};
