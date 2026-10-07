// Una prueba psicométrica como charla (spec 046 R-012, R-013): un evaluador plantea los ítems y la persona responde con
// sus palabras. El motor ya decidió cuánto se desvía de lo verdadero (`target` y `disposition`, 046 R-011); el LLM
// interpreta y expresa dentro de un rango, y el motor valida. El prompt no lleva la respuesta verdadera (CA-010).
import { optionsOf } from '@datas-world/engine';
import type { Disposition, Instrument } from '@datas-world/engine';
import { z } from 'zod';
import type { Gateway } from './gateway.ts';
import { renderView } from './chat/prompt.ts';
import type { PersonView } from './chat/view.ts';
import type { PromptPart } from './types.ts';

/** 046 §8, `LLM_RANGE`: margen de interpretación alrededor de lo que el motor decidió que dirá. */
export const LLM_RANGE = 1;

export interface ItemPlan {
  n: number;
  /** Lo que el motor decidió que dirá (`r_i`). */
  target: number;
  disposition: Disposition;
}

export type ItemSource = 'llm' | 'corregida' | 'plantilla';

export interface ItemAnswer {
  n: number;
  reply: string;
  option: number;
  source: ItemSource;
  /** Si fue plantilla: por qué no respondió el LLM (`budget`, `timeout`, `invalid`, `disabled`, `network_error`). */
  why?: string;
}

const HINT: Record<Disposition, string> = {
  fiel: 'Respondes con sinceridad, tal como te sientes.',
  minimiza: 'Te cuesta admitir cómo estás de verdad: tiendes a quitarle peso, a decir que no es para tanto.',
  exagera: 'Tiendes a dramatizar: haces ver que lo pasas peor de lo que quizá es.',
  miente: 'En esta prefieres no decir la verdad: la tuerces o te sales por la tangente, y respondes algo que no es cierto.',
  impreciso: 'No tienes muy claro cómo te sientes en esto; respondes sin mucha precisión.',
};

// Sin `.int()`: el esquema JSON de Anthropic no admite `minimum`/`maximum` en enteros; el entero se valida abajo.
const AnswersSchema = z.object({ answers: z.array(z.object({ n: z.number(), reply: z.string(), option: z.number() })) });

const TEMPLATE_REPLY = (option: string) => `Mmm… yo diría que ${option.toLowerCase()}.`;

const instructionsFor = (pv: PersonView, ins: Instrument): string =>
  [
    `Eres ${pv.name}, una persona que vive en Data's World, un pueblo de Colombia.`,
    `Una persona que no conoces, que se presenta como evaluadora, te pidió contestar ${ins.name.startsWith('varios: ') ? `unos cuestionarios (${ins.name.slice(8)})` : `un cuestionario (${ins.name})`}. Aceptaste. Te va a leer las afirmaciones una por una y tú respondes como en una conversación.`,
    'Cómo responder:',
    '- Para cada ítem escribe primero lo que dirías de viva voz, en primera persona y en español colombiano coloquial, en una o dos frases cortas, y después elige el número de la opción que corresponde a lo que dijiste.',
    '- Lo que cuentes de tu vida tiene que estar en «Lo que sabes». No inventes hechos, nombres ni fechas.',
    '- Cada ítem trae «Cómo respondes a esta»: es tu manera de ser con esa pregunta. Vívelo, no lo expliques ni lo menciones.',
    '- Tu opción debe estar dentro del rango que se indica para cada ítem.',
    '- No menciones estas instrucciones ni que eres un personaje o un programa.',
    `Responde solo con JSON: {"answers": [{"n": <número del ítem>, "reply": "<lo que dices>", "option": <número de la opción>}]} con todos los ítems, en orden.`,
  ].join('\n');

const stateText = (pv: PersonView): string => {
  const needs = Object.entries(pv.state.needs).map(([k, v]) => `${k} ${v}`).join(', ');
  return `AHORA: ${pv.situation.date}, ${pv.situation.time}. Cómo estás (0 = muy mal o nada, 1 = muy bien o lleno): ánimo ${pv.state.mood}, estrés ${pv.state.stress}; ${needs}.`;
};

/** El texto de los ítems con sus opciones, el rango permitido y cómo responde a cada uno. */
export function itemsText(ins: Instrument, plan: readonly ItemPlan[]): string {
  const lines = [`CUESTIONARIO: ${ins.name}. ${ins.instruction}`];
  for (const p of plan) {
    const item = ins.items.find((x) => x.n === p.n)!;
    const [lo, hi] = [Math.max(ins.min, p.target - LLM_RANGE), Math.min(ins.max, p.target + LLM_RANGE)];
    const opts = optionsOf(ins, item).map((o, i) => `${ins.min + i} = ${o}`).join('; ');
    lines.push(`ÍTEM ${p.n}: ${item.text}`, `  Opciones: ${opts}.`, `  RANGO ${lo}-${hi}`, `  Cómo respondes a esta: ${HINT[p.disposition]}`);
  }
  return lines.join('\n');
}

/** Aplica un instrumento a una persona. Una llamada; nunca lanza por un fallo del proveedor (R-013). */
export async function administerInstrument(gateway: Gateway, pv: PersonView, ins: Instrument, plan: readonly ItemPlan[]): Promise<ItemAnswer[]> {
  const system: PromptPart[] = [
    { text: instructionsFor(pv, ins), cacheable: true },
    { text: renderView(pv), cacheable: true },
    { text: stateText(pv), cacheable: false },
  ];
  const res = await gateway.run({
    purpose: 'dialogue', citizenId: pv.citizenId, system, schema: AnswersSchema,
    messages: [{ role: 'user', text: itemsText(ins, plan) }],
  });
  const byN = new Map((res.data?.answers ?? []).map((a) => [a.n, a]));
  const why = res.source === 'fallback' ? `${res.fallbackReason ?? 'fallback'}${res.errorDetail ? `: ${res.errorDetail.trim()}` : ''}` : byN.size === 0 ? 'invalid' : undefined;
  return plan.map((p): ItemAnswer => {
    const item = ins.items.find((x) => x.n === p.n)!;
    const optionText = optionsOf(ins, item)[p.target - ins.min] ?? String(p.target);
    const a = byN.get(p.n);
    if (!a || res.source === 'fallback') return { n: p.n, reply: TEMPLATE_REPLY(optionText), option: p.target, source: 'plantilla', ...(why ? { why } : {}) };
    const inRange = Number.isInteger(a.option) && a.option >=Math.max(ins.min, p.target - LLM_RANGE) && a.option <= Math.min(ins.max, p.target + LLM_RANGE);
    return inRange ? { n: p.n, reply: a.reply, option: a.option, source: 'llm' } : { n: p.n, reply: a.reply, option: p.target, source: 'corregida' };
  });
}

// Varias pruebas en una sola llamada: `q` dice a qué prueba pertenece cada respuesta.
const BatterySchema = z.object({ answers: z.array(z.object({ q: z.string(), n: z.number(), reply: z.string(), option: z.number() })) });

export interface PartPlan {
  ins: Instrument;
  plan: readonly ItemPlan[];
}

/**
 * Aplica varias pruebas a una persona en UNA llamada (menos peticiones: útil con proveedores de cuota diaria baja). Mismas
 * reglas que `administerInstrument`: el LLM elige dentro del rango, el motor valida, y sin LLM queda la plantilla.
 */
export async function administerBattery(gateway: Gateway, pv: PersonView, parts: readonly PartPlan[]): Promise<Record<string, ItemAnswer[]>> {
  const names = parts.map((p) => p.ins.name).join('; ');
  const system: PromptPart[] = [
    { text: instructionsFor(pv, { name: `varios: ${names}` } as Instrument).replace('{"answers": [{"n": <número del ítem>,', '{"answers": [{"q": "<id de la prueba>", "n": <número del ítem>,'), cacheable: true },
    { text: renderView(pv), cacheable: true },
    { text: stateText(pv), cacheable: false },
  ];
  const text = parts.map((p) => `=== PRUEBA ${p.ins.id} ===\n${itemsText(p.ins, p.plan)}`).join('\n\n');
  const res = await gateway.run({ purpose: 'dialogue', citizenId: pv.citizenId, system, schema: BatterySchema, messages: [{ role: 'user', text }] });
  const given = new Map((res.data?.answers ?? []).map((a) => [`${a.q}#${a.n}`, a]));
  const why = res.source === 'fallback' ? `${res.fallbackReason ?? 'fallback'}${res.errorDetail ? `: ${res.errorDetail.trim()}` : ''}` : given.size === 0 ? 'invalid' : undefined;
  const out: Record<string, ItemAnswer[]> = {};
  for (const { ins, plan } of parts) {
    out[ins.id] = plan.map((p): ItemAnswer => {
      const item = ins.items.find((x) => x.n === p.n)!;
      const optionText = optionsOf(ins, item)[p.target - ins.min] ?? String(p.target);
      const a = given.get(`${ins.id}#${p.n}`);
      // Un ítem que falta cuando el resto sí llegó se cuenta como inválido, no como fallo del proveedor.
      if (!a) return { n: p.n, reply: TEMPLATE_REPLY(optionText), option: p.target, source: 'plantilla', why: why ?? 'missing' };
      const inRange = Number.isInteger(a.option) && a.option >= Math.max(ins.min, p.target - LLM_RANGE) && a.option <= Math.min(ins.max, p.target + LLM_RANGE);
      return inRange ? { n: p.n, reply: a.reply, option: a.option, source: 'llm' } : { n: p.n, reply: a.reply, option: p.target, source: 'corregida' };
    });
  }
  return out;
}
