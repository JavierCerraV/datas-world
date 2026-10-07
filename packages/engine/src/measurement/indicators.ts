// Indicadores de la persona (spec 046 R-002, §4 bis): todo sale de su estado, su historia, su aprendizaje y sus valores.
// No lee el temperamento (`pers.*`, `tmp.*`: 009 R-006) ni a otras personas.
import type { WorldEvent } from '../events.ts';
import { DEFAULT_VARIABILITY } from '../functions/history.ts';
import type { FunctionStore } from '../functions/types.ts';
import type { EntityId } from '../ids.ts';
import { idNumber } from '../ids.ts';
import type { DayPoint, EmergentProfile } from '../lifereport/types.ts';
import { MOOD_BASELINE } from '../needs/columns.ts';
import { AVOIDANCE_RESPONSES, AVOIDANCE_W0, SELF_RESPONSE } from '../private/params.ts';
import { kindOf, ruleContribution } from '../rules/rules.ts';
import type { WorldView } from '../simulation/system.ts';

const DAY = 1440;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const mean = (xs: readonly number[], empty = 0) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : empty);

/** Todo en [0,1] (046 §3). */
export interface Indicators {
  mood: number; stress: number; negAffect: number; joy: number; sadness: number; fear: number; anger: number; shame: number;
  energyLack: number; funLack: number; lonely: number; sleepDebt: number;
  /** «Lo habitual» (los 30 días anteriores) y lo de la última semana, con la misma medida (`core`). */
  coreNow: number; coreBase: number;
  avoidance: number; pnrLoad: number; pnrRecent: number; selfFraming: number;
  aversiveBurden: number; approvalValue: number; positiveContact: number;
  pliance: number; tracking: number; sensitivity: number;
  valueImportance: number; valueContact: number; valueGap: number;
  jobStability: number; relationshipStability: number; socialNetwork: number; stressorExposure: number; economicTrajectory: number; resilience: number;
  health: number;
}

export interface IndicatorInput {
  world: WorldView;
  id: EntityId;
  profile: EmergentProfile;
  trajectory: readonly DayPoint[];
  /** Hechos de la persona (participa): se leen `PNR_EPISODE` y `LEISURE_DONE`. */
  events: readonly WorldEvent[];
}

const AVERSIVE_KEYS = ['verbal.abandono', 'verbal.burla', 'verbal.critica', 'verbal.culpa', 'verbal.desprecio', 'verbal.insulto', 'verbal.traicion', 'verbal.despido', 'verbal.deuda', 'verbal.no_pagar', 'verbal.llegar_tarde'];
const APPETITIVE_KEYS = ['verbal.afecto', 'verbal.confidencia', 'verbal.dinero', 'verbal.trabajo', 'rol.pareja', 'cuerpo.disfrute'];

/** Misma medida que `loadOf` (039 PA-116), sobre la vista de solo lectura: suma de lo aversivo activo, con techo 1. */
const pnrLoadOf = (mind: { active: readonly { fn: number }[] } | undefined): number => clamp01((mind?.active ?? []).reduce((s, e) => s + Math.max(0, -e.fn), 0));
const trialsOf = (store: FunctionStore | undefined, key: string): number => store?.f.find((x) => x.s === key)?.n ?? 0;
const valueOf = (store: FunctionStore | undefined, key: string): number => store?.f.find((x) => x.s === key)?.v ?? 0;
const strengthOf = (store: FunctionStore | undefined, r: string, w0: number): number => store?.r.find((x) => x.r === r && x.c === '')?.w ?? w0;
/** Medida común del malestar de fondo (ánimo y estrés), para comparar «ahora» con «lo habitual». */
export const core = (mood: number, stress: number): number => clamp01((0.35 * stress + 0.25 * (1 - mood)) / 0.6);

export function indicatorsOf(input: IndicatorInput): Indicators {
  const { world, id, profile, trajectory, events } = input;
  const row = idNumber(id);
  const f = world.components.f32;
  const col = (name: string, fallback = 0) => f[name]?.[row] ?? fallback;
  const c = world.citizens.get(id);
  const store = c?.functions as FunctionStore | undefined;
  const now = world.now;

  // «Lo habitual»: la semana reciente frente a los 23 días anteriores a ella (si no hay trayectoria, no hay cambio).
  const recent = trajectory.filter((p) => p.day * DAY > now - 7 * DAY);
  const before = trajectory.filter((p) => p.day * DAY <= now - 7 * DAY && p.day * DAY > now - 30 * DAY);

  // Las pruebas preguntan por la última semana o por «cómo es uno»: ánimo y estrés son los de la semana, no los de un instante.
  const mood = recent.length ? mean(recent.map((p) => p.mood)) : col('state.mood', 0.5);
  const stress = recent.length ? mean(recent.map((p) => p.stress)) : col('state.stress');
  // Las emociones son transitorias (casi siempre 0 en una foto): se completan con lo que dicen el ánimo y el estrés de la semana.
  const joy = Math.max(col('emo.joy'), clamp01((mood - 0.5) / 0.35));
  const sadness = Math.max(col('emo.sadness'), clamp01((MOOD_BASELINE - mood) / 0.35));
  const fear = Math.max(col('emo.fear'), 0.6 * pnrLoadOf(c?.mind), 0.5 * clamp01((stress - 0.3) / 0.5));
  const anger = Math.max(col('emo.anger'), 0.5 * clamp01((stress - 0.4) / 0.5));
  const shame = col('emo.shame');
  const negAffect = clamp01(0.35 * stress + 0.25 * (1 - mood) + 0.2 * Math.max(sadness, fear) + 0.1 * shame + 0.1 * anger);

  const coreNow = recent.length ? mean(recent.map((p) => core(p.mood, p.stress))) : core(mood, stress);
  const coreBase = before.length ? mean(before.map((p) => core(p.mood, p.stress)), coreNow) : coreNow;

  const sleepDebt = clamp01((world.components.i32['state.sleepDebt']?.[row] ?? 0) / (2 * DAY));

  const avoidance = clamp01(mean(AVOIDANCE_RESPONSES.map((r) => strengthOf(store, r, AVOIDANCE_W0))));
  const pnrLoad = pnrLoadOf(c?.mind);
  const mine = (type: string) => events.filter((e) => e.type === type && (e.payload as { citizenId?: string }).citizenId === id);
  const pnrRecent = clamp01(mine('PNR_EPISODE').filter((e) => e.at > now - 60 * DAY).length / 6);
  const selfFraming = clamp01(strengthOf(store, SELF_RESPONSE, 0));

  // Lo aversivo vivido pesa por su exposición (ensayos), no solo por su valor, que satura en 1 para casi todas.
  const aversive = AVERSIVE_KEYS.reduce((s, k) => s + Math.max(0, -valueOf(store, k)) * Math.min(1, trialsOf(store, k) / 40), 0);
  const aversiveBurden = clamp01(aversive / 4);
  // Valor de la aprobación: cuánto de su historia verbal fue aprobación frente a desaprobación, y cuánta aprobación acumuló.
  const nApproval = trialsOf(store, 'verbal.aprobacion');
  const nAversive = AVERSIVE_KEYS.reduce((s, k) => s + trialsOf(store, k), 0);
  const approvalValue = nApproval + nAversive === 0 ? 0 : clamp01(0.5 * (nAversive / (nApproval + nAversive)) * 2 + 0.5 * Math.min(1, nApproval / 400)) * clamp01(valueOf(store, 'verbal.aprobacion'));
  const positiveContact = clamp01(APPETITIVE_KEYS.reduce((s, k) => s + Math.max(0, valueOf(store, k)), 0) / 3);

  const rules = c?.rules ?? [];
  const weight = (kind: string) => rules.filter((r) => kindOf(r) === kind).reduce((s, r) => s + Math.max(0, ruleContribution(r)), 0);
  const total = rules.reduce((s, r) => s + Math.max(0, ruleContribution(r)), 0);
  const pliance = total > 0 ? weight('pliance') / total : 0.5;
  const tracking = total > 0 ? weight('tracking') / total : 0.5;
  const trackingRules = rules.filter((r) => kindOf(r) === 'tracking');
  const sensitivity = clamp01(0.6 * (f['hist.variability']?.[row] ?? DEFAULT_VARIABILITY) + 0.4 * mean(trackingRules.map((r) => r.contrast), 0.5));

  // Valores: importancia de sus dominios vitales y contacto reciente con ellos (ocio, trabajo, compañía).
  const domains = (store?.f ?? []).filter((x) => x.s.startsWith('dominio.') && x.v > 0);
  const valueImportance = clamp01(mean([...domains.map((x) => x.v)].sort((a, b) => b - a).slice(0, 4)) * (domains.length ? 1 : 0));
  const leisure = mine('LEISURE_DONE').filter((e) => e.at > now - 30 * DAY).length;
  const employed = c?.occupation && c.occupation.kind !== 'none' ? 1 : 0;
  const valueContact = clamp01(0.4 * Math.min(1, leisure / 8) + 0.3 * employed + 0.3 * col('need.social', 0.5));
  const valueGap = clamp01(valueImportance - valueContact);

  const p = (k: keyof EmergentProfile['values']) => profile.values[k] ?? 0.5;
  const sick = world.components.u8['health.acute']?.[row] ? 1 : 0;
  const uncontrolled = (c?.conditions ?? []).filter((x) => !x.controlled).length;
  const health = clamp01(1 - (0.4 * sick + 0.15 * Math.min(2, uncontrolled) + 0.3 * sleepDebt));

  return {
    mood, stress, negAffect, joy, sadness, fear, anger, shame,
    energyLack: 1 - col('need.energy', 0.7), funLack: 1 - col('need.fun', 0.7), lonely: 1 - col('need.social', 0.7), sleepDebt,
    coreNow, coreBase, avoidance, pnrLoad, pnrRecent, selfFraming, aversiveBurden, approvalValue, positiveContact, pliance, tracking, sensitivity,
    valueImportance, valueContact, valueGap,
    jobStability: p('jobStability'), relationshipStability: p('relationshipStability'), socialNetwork: p('socialNetwork'), stressorExposure: p('stressorExposure'),
    economicTrajectory: p('economicTrajectory'), resilience: p('resilience'), health,
  };
}
