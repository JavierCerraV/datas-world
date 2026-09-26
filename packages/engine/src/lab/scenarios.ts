// Escenarios de la batería de validación conductual (spec 042, bloque MF2: V-1, V-2, V-3 y V-6). Cada uno usa
// solo los mecanismos de la 036 con sus parámetros por defecto (042 R-002) y devuelve sus métricas.
import { createOntology } from '../functions/sensitivity.ts';
import { elicited, netValue, operant, pair } from '../functions/learn.ts';
import { LEARNING_DEFAULTS, NEUTRAL, emptyStore } from '../functions/types.ts';
import type { FunctionStore, LearningParams, Sensitivity, StimulusClass } from '../functions/types.ts';
import { createRng } from '../rng.ts';

const DAY = 1440;
const P: LearningParams = LEARNING_DEFAULTS;
const cls = (key: string, x: number, primary?: 1 | -1): StimulusClass => ({ key, kind: 'verbal_term', features: [x], ...(primary ? { primary } : {}) });

/** V-1: 30 emparejamientos y 30 presentaciones solo del estímulo. Fuerza neta tras cada ensayo. */
export function acquisitionExtinction(sens: Sensitivity = NEUTRAL, lambda = 1): { acquisition: number[]; extinction: number[] } {
  const onto = createOntology([cls('luz', 0), cls('comida', 1, 1)]);
  const s = emptyStore();
  let t = 0;
  const acquisition: number[] = [];
  const extinction: number[] = [];
  for (let k = 0; k < 30; k++) {
    pair(s, onto, { stim: 'luz', ctx: 'A', now: t++, lambda, us: 'comida' }, P, sens);
    acquisition.push(netValue(s, onto, 'luz', 'A', t, P));
  }
  for (let k = 0; k < 30; k++) {
    pair(s, onto, { stim: 'luz', ctx: 'A', now: t++, lambda: 0 }, P, sens);
    extinction.push(netValue(s, onto, 'luz', 'A', t, P));
  }
  return { acquisition, extinction };
}

/**
 * V-2: adquisición en el contexto A, extinción en B y pruebas: en B justo después, en B a los 7 días
 * (recuperación espontánea) y en A (renovación ABA).
 */
export function recoveryRenewal(): { endExtinctionB: number; laterB: number; renewalA: number; acquired: number } {
  const onto = createOntology([cls('tono', 0), cls('descarga', 1, -1)]);
  const s = emptyStore();
  let t = 0;
  for (let k = 0; k < 30; k++) pair(s, onto, { stim: 'tono', ctx: 'A', now: t++, lambda: -1, us: 'descarga' }, P, NEUTRAL);
  const acquired = netValue(s, onto, 'tono', 'A', t, P);
  for (let k = 0; k < 40; k++) pair(s, onto, { stim: 'tono', ctx: 'B', now: t++, lambda: 0 }, P, NEUTRAL);
  return {
    acquired,
    endExtinctionB: netValue(s, onto, 'tono', 'B', t, P),
    laterB: netValue(s, onto, 'tono', 'B', t + 7 * DAY, P),
    renewalA: netValue(s, onto, 'tono', 'A', t, P),
  };
}

/**
 * V-3: nueve tonos en una dimensión (rasgo i/8). Entrenamiento simple con S+ = tono.4, y discriminativo con S+ y
 * S− = tono.6 intercalados. Devuelve los dos gradientes (valor neto de cada tono).
 */
export function generalizationGradient(): { simple: number[]; discriminative: number[] } {
  const tones = Array.from({ length: 9 }, (_, i) => cls(`tono.${i}`, i / 8));
  const onto = createOntology([...tones, cls('comida', 1, 1)]);
  const gradientOf = (s: FunctionStore) => tones.map((c) => netValue(s, onto, c.key, 'A', 1000, P));
  const simple = emptyStore();
  for (let k = 0; k < 60; k++) pair(simple, onto, { stim: 'tono.4', ctx: 'A', now: k, lambda: 0.4, us: 'comida' }, P, NEUTRAL);
  const disc = emptyStore();
  for (let k = 0; k < 200; k++)
    pair(disc, onto, k % 2 === 0 ? { stim: 'tono.4', ctx: 'A', now: k, lambda: 0.4, us: 'comida' } : { stim: 'tono.6', ctx: 'A', now: k, lambda: 0 }, P, NEUTRAL);
  return { simple: gradientOf(simple), discriminative: gradientOf(disc) };
}

/**
 * V-6: evitación con aviso (teoría de dos factores). Cada ensayo presenta el aviso; la persona responde (evita) con
 * probabilidad 0,05 + 0,9·fuerza de la respuesta [M]. Si evita, el aviso cesa enseguida: alivio (reforzamiento
 * negativo = la aversión elicitada por el aviso) y la exposición es tan breve que no extingue (conservación de la
 * ansiedad, Solomon y Wynne, [T]). Si no evita: en la adquisición recibe la descarga y la respuesta la termina
 * (escape, reforzado); en la extinción, el aviso solo. La adquisición sigue hasta el criterio clásico de
 * `criterion` evitaciones seguidas (máximo 300 ensayos). Devuelve las evitaciones de la fase sin descargas.
 */
export function avoidancePersistence(sens: Sensitivity = NEUTRAL, seed = 42, criterion = 5, extinctionTrials = 100): { avoidedInExtinction: number; acquisitionTrials: number } {
  const onto = createOntology([cls('aviso', 0), cls('descarga', 1, -1)]);
  const s = emptyStore();
  const rng = createRng(seed).fork('lab:evitacion');
  let t = 0;
  let avoided = 0;
  let streak = 0;
  let acquisition = 0;
  let extinction = 0;
  while (extinction < extinctionTrials) {
    const inExtinction = streak >= criterion || acquisition >= 300;
    const w = s.r.find((x) => x.r === 'evitar')?.w ?? 0;
    if (rng.next() < 0.05 + 0.9 * Math.max(0, w)) {
      operant(s, 'evitar', 'lab', -Math.min(0, elicited(s, onto, 'aviso', 'lab', t, P, sens)), t, P, sens);
      if (inExtinction) avoided++;
      else streak++;
    } else {
      pair(s, onto, { stim: 'aviso', ctx: 'lab', now: t, lambda: inExtinction ? 0 : -1, us: 'descarga' }, P, sens);
      if (!inExtinction) {
        operant(s, 'evitar', 'lab', 1, t, P, sens);
        streak = 0;
      }
    }
    if (inExtinction) extinction++;
    else acquisition++;
    t += 5;
  }
  return { avoidedInExtinction: avoided, acquisitionTrials: acquisition };
}
