// Apego como métrica (spec 012 §9 bis, P4): no es un rasgo ni una entrada del motor; se calcula de la historia para
// la capa clínica. Seguridad: la función aprendida de quienes le criaron (041). Evitación: cuánto pesa evadir frente
// a abrirse en su repertorio de conversación (043). Ningún sistema lo lee para decidir.
import type { FunctionStore } from '../functions/types.ts';
import type { DeepReadonly } from '../simulation/system.ts';
import { personStimulus } from './params.ts';

export interface Attachment {
  /** [0,1]: 0,5 + 0,5 × afecto medio por sus cuidadores (o por el rol si no viven en el mundo). */
  security: number;
  /** [0,1]: fuerza de evadir / (evadir + abrirse). */
  avoidance: number;
  /** [M] Lectura por umbrales: seguro, evitativo o ansioso. */
  style: 'seguro' | 'evitativo' | 'ansioso';
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round = (x: number) => Math.round(x * 100) / 100;

export function attachmentOf(store: DeepReadonly<FunctionStore> | undefined, caregivers: readonly string[]): Attachment {
  const fn = (s: string) => store?.f.find((f) => f.s === s)?.v;
  const w = (r: string, w0: number) => store?.r.find((x) => x.r === r && x.c === '')?.w ?? w0;
  const known = caregivers.map((id) => fn(personStimulus(id))).filter((v): v is number => v !== undefined);
  const roles = ['rol.madre', 'rol.padre', 'rol.cuidador'].map(fn).filter((v): v is number => v !== undefined);
  const pool = known.length ? known : roles;
  const mean = pool.length ? pool.reduce((a, b) => a + b, 0) / pool.length : 0;
  const security = round(clamp01(0.5 + 0.5 * mean));
  const evade = w('conv.evadir', 0.4);
  const open = w('conv.abrirse', 0.5);
  const avoidance = round(evade / (evade + open || 1));
  const style = avoidance >= 0.5 ? 'evitativo' : security >= 0.5 ? 'seguro' : 'ansioso';
  return { security, avoidance, style };
}
