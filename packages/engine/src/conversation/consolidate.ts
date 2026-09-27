// Consolidación de una charla `in_world` (spec 043 R-019.6, R-020 a R-022): la entrada externa `chat_session`
// trae los tonos y las posturas de la charla; se rehace el aprendizaje sobre el almacén actual de la persona (sin
// azar) y se escribe acotado, con el recuerdo y el efecto emocional. El replay obtiene exactamente lo mismo.
import type { NewEvent, WorldEvent } from '../events.ts';
import { storeOf } from '../functions/system.ts';
import { prune } from '../functions/learn.ts';
import type { FunctionStore } from '../functions/types.ts';
import { idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import type { Patch, WorldView } from '../simulation/system.ts';
import type { ChatParams } from './params.ts';
import { STANCE_PREFIX } from './params.ts';
import { citizenAnswered, startConversation, summarize, visitorSaid } from './tone.ts';
import type { LearnerCtx } from './tone.ts';
import type { ChatCatalog, ChatSummary } from './types.ts';

/** Payload de la entrada externa `chat_session` (R-019.6). */
export interface ChatSessionInput {
  sessionId: string;
  citizenId: EntityId;
  visitorId: string;
  /** Turnos en orden: el tono del visitante y la postura con que respondió el ciudadano. */
  turns: { tone: string; stance: string }[];
  /** Resumen ya registrado de la pasarela (`summarize`, 026); si falta, se usa la plantilla. */
  summary?: string;
}

export interface Consolidation {
  patches: Patch[];
  events: WorldEvent[];
  summary: ChatSummary;
  deltas: { key: string; before: number; after: number }[];
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const cap = (before: number, after: number, max: number) => before + Math.max(-max, Math.min(max, after - before));
const round = (x: number) => Math.round(x * 1000) / 1000;

/** R-021: escribe sobre el almacén original los cambios de la charla, cada uno acotado a `max`. */
function cappedStore(orig: FunctionStore, session: FunctionStore, w0: (key: string) => number, max: number) {
  const out = JSON.parse(JSON.stringify(orig)) as FunctionStore;
  const deltas: { key: string; before: number; after: number }[] = [];
  for (const f of session.f) {
    const prev = out.f.find((x) => x.s === f.s);
    const before = prev?.v ?? 0;
    if (Math.abs(f.v - before) < 1e-9) continue;
    const after = cap(before, f.v, max);
    if (prev) Object.assign(prev, { ...JSON.parse(JSON.stringify(f)), v: after });
    else out.f.push({ ...JSON.parse(JSON.stringify(f)), v: after });
    deltas.push({ key: f.s, before: round(before), after: round(after) });
  }
  for (const r of session.r) {
    if (!r.r.startsWith(STANCE_PREFIX)) continue;
    const prev = out.r.find((x) => x.r === r.r && x.c === r.c);
    const before = prev?.w ?? w0(r.r);
    if (Math.abs(r.w - before) < 1e-9) continue;
    const after = cap(before, r.w, max);
    if (prev) Object.assign(prev, { ...JSON.parse(JSON.stringify(r)), w: after });
    else out.r.push({ ...JSON.parse(JSON.stringify(r)), w: after });
    deltas.push({ key: r.r, before: round(before), after: round(after) });
  }
  return { store: out, deltas };
}

const templateSummary = (s: ChatSummary) =>
  `${s.turns} turnos; tono ${s.dominantTones.join(' y ') || 'sin turnos'}; respondió ${s.dominantStances.join(' y ') || 'sin postura'}.`;

/**
 * Aplica la charla al mundo. `emit` crea cada evento (id y minuto) al momento, para que el aprendizaje cite al
 * recuerdo como causa; `cause` es la de la entrada externa.
 */
export function consolidateChat(
  view: WorldView, input: ChatSessionInput, cat: ChatCatalog, lc: LearnerCtx, params: ChatParams, now: number,
  cause: NewEvent['causes'], emit: (e: NewEvent) => WorldEvent,
): Consolidation {
  const row = idNumber(input.citizenId);
  const orig = storeOf(view, row);
  const s = startConversation(orig, input.visitorId);
  for (const t of input.turns) {
    const tone = cat.tones.find((x) => x.key === t.tone);
    if (!tone) throw new Error(`chat_session ${input.sessionId}: tono desconocido (${t.tone})`);
    if (!cat.stances.some((x) => x.key === t.stance)) throw new Error(`chat_session ${input.sessionId}: postura desconocida (${t.stance})`);
    visitorSaid(s, lc, cat, tone, now, params);
    citizenAnswered(s, t.stance);
  }
  const w0 = (key: string) => cat.stances.find((x) => `${STANCE_PREFIX}${x.key}` === key)?.w0 ?? 0;
  const { store, deltas } = cappedStore(orig, s.store, w0, params.maxLearningDelta);
  prune(store, lc.P);

  const summary = summarize(s);
  const f = view.components.f32;
  const mood = f['state.mood']?.[row] ?? 0.5;
  const stress = f['state.stress']?.[row] ?? 0;
  const delta = Math.max(-params.maxMoodDelta, Math.min(params.maxMoodDelta, params.moodK * summary.valence * summary.intensity));
  const patches: Patch[] = [
    { op: 'entity', id: input.citizenId, fields: { functions: store } },
    { op: 'set', type: 'f32', column: 'state.mood', row, value: clamp01(mood + delta) },
    { op: 'set', type: 'f32', column: 'state.stress', row, value: clamp01(stress - delta) },
  ];

  const participants = [{ id: input.citizenId, role: 'persona' }];
  const held = emit({
    type: 'CONVERSATION_HELD',
    payload: {
      citizenId: input.citizenId, visitorId: input.visitorId, sessionId: input.sessionId, turns: summary.turns,
      dominantTones: summary.dominantTones, dominantStances: summary.dominantStances,
      summary: input.summary ?? templateSummary(summary), valence: round(summary.valence), intensity: round(summary.intensity),
    },
    causes: [...cause, ...summary.dominantStances.map((st) => ({ state: `fuente.postura:${st}`, entity: input.citizenId, weight: 0.3 }))],
    participants,
  });
  const events = [held];
  if (deltas.length > 0)
    events.push(emit({
      type: 'LEARNED_FROM_CONVERSATION',
      payload: { citizenId: input.citizenId, sessionId: input.sessionId, deltas },
      causes: [{ event: held.id, weight: 1 }],
      participants,
    }));
  return { patches, events, summary, deltas };
}
