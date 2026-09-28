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
import type { RelationalNetwork } from '../relations/types.ts';
import { variabilityOf } from '../functions/history.ts';
import { createRng } from '../rng.ts';
import type { Belief, Intention } from '../world.ts';
import { claimsHeard } from './claims.ts';
import { canCall, chooseIntention, intentionOptions, together } from './intentions.ts';
import type { ChatParams, ClaimParams } from './params.ts';
import { CLAIM_DEFAULTS, STANCE_PREFIX } from './params.ts';
import { citizenAnswered, startConversation, summarize, visitorSaid } from './tone.ts';
import type { LearnerCtx } from './tone.ts';
import type { ChatCatalog, ChatSummary, ClaimAssessment, HeardClaim } from './types.ts';

/** Payload de la entrada externa `chat_session` (R-019.6). */
export interface ChatSessionInput {
  sessionId: string;
  citizenId: EntityId;
  visitorId: string;
  /**
   * Turnos en orden: el tono del visitante, sus afirmaciones sobre terceros ya validadas (044 R-001, R-010) y la
   * postura con que respondió el ciudadano.
   */
  turns: { tone: string; stance: string; claims?: HeardClaim[] }[];
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
  `${s.turns} ${s.turns === 1 ? 'turno' : 'turnos'}; tono ${s.dominantTones.join(' y ') || 'sin turnos'}; respondió ${(s.dominantStances.map((x) => x.replace(/_/g, ' ')).join(' y ')) || 'sin postura'}.`;

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
  const cp = params.claims ?? CLAIM_DEFAULTS;
  const person = view.citizens.get(input.citizenId);
  const ctx = { ...lc, net: person?.network as RelationalNetwork | undefined };
  const heard: { seq: number; a: ClaimAssessment }[] = [];
  input.turns.forEach((t, seq) => {
    const tone = cat.tones.find((x) => x.key === t.tone);
    if (!tone) throw new Error(`chat_session ${input.sessionId}: tono desconocido (${t.tone})`);
    if (!cat.stances.some((x) => x.key === t.stance)) throw new Error(`chat_session ${input.sessionId}: postura desconocida (${t.stance})`);
    visitorSaid(s, lc, cat, tone, now, params);
    if (t.claims?.length) for (const a of claimsHeard(s, ctx, view, input.citizenId, cat, t.claims, now, cp)) if (!a.discarded) heard.push({ seq, a });
    citizenAnswered(s, t.stance);
  });
  const w0 = (key: string) => cat.stances.find((x) => `${STANCE_PREFIX}${x.key}` === key)?.w0 ?? 0;
  const { store, deltas } = cappedStore(orig, s.store, w0, params.maxLearningDelta);
  prune(store, lc.P);

  const summary = summarize(s);
  const f = view.components.f32;
  const mood = f['state.mood']?.[row] ?? 0.5;
  const stress = f['state.stress']?.[row] ?? 0;
  const delta = Math.max(-params.maxMoodDelta, Math.min(params.maxMoodDelta, params.moodK * summary.valence * summary.intensity));
  // 044 R-005: una revelación creída pesa más que un mal tono, con su propio tope.
  const believed = heard.filter((h) => h.a.credibility >= cp.beliefMin);
  const claimStress = Math.min(cp.maxClaimStressDelta, cp.stressK * believed.reduce((acc, h) => acc + (h.a.value < 0 ? h.a.impact : 0), 0));

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

  // 044 §5: lo que oyó de cada tercero y, si lo cree, la creencia con sus fuentes (función, red o valor).
  const beliefs: Belief[] = [...(person?.beliefs ?? [])].map((b) => ({ ...b }));
  const strongest = new Map<EntityId, { a: ClaimAssessment; believedId: EntityId }>();
  for (const { seq, a } of heard) {
    const about = a.about as EntityId;
    const both = [...participants, { id: about, role: 'tercero' }];
    const e = emit({
      type: 'CHAT_CLAIM_HEARD',
      payload: { citizenId: input.citizenId, about, predicate: a.predicate, seq, sessionId: input.sessionId },
      causes: [{ event: held.id, weight: 1 }],
      participants: both,
    });
    events.push(e);
    if (a.credibility < cp.beliefMin) continue;
    const stim = cat.claims?.find((x) => x.key === a.predicate)?.stimulus ?? a.predicate;
    const b = emit({
      type: 'CHAT_CLAIM_BELIEVED',
      payload: { citizenId: input.citizenId, about, predicate: a.predicate, credibility: a.credibility, impact: a.impact },
      causes: [
        { event: e.id, weight: 1 },
        { state: a.valueSource === 'derived' ? `fuente.red:${a.derivedFrom}` : `fuente.funcion:${stim}`, entity: input.citizenId, weight: 0.5 },
        ...(a.opposedValue ? [{ state: `fuente.valor:${a.opposedValue}`, entity: input.citizenId, weight: 0.3 }] : []),
      ],
      participants: both,
    });
    events.push(b);
    const i = beliefs.findIndex((x) => x.about === about && x.predicate === a.predicate);
    const belief: Belief = { about, predicate: a.predicate, source: input.visitorId, credibility: a.credibility, at: now, cause: b.id };
    if (i >= 0) beliefs[i] = belief;
    else beliefs.push(belief);
    if (a.value < 0 && a.impact >= cp.intentThreshold) {
      const prev = strongest.get(about);
      if (!prev || a.impact > prev.a.impact) strongest.set(about, { a, believedId: b.id });
    }
  }

  // 044 R-006: una intención por tercero, por la afirmación que más le pegó.
  const intentions = formIntentions(view, input.citizenId, store, [...strongest.values()], cat, cp, now, participants, emit);
  events.push(...intentions.events);

  const patches: Patch[] = [
    {
      op: 'entity', id: input.citizenId,
      fields: { functions: store, ...(heard.length > 0 ? { beliefs } : {}), ...(intentions.events.length > 0 ? { intentions: intentions.list } : {}) },
    },
    { op: 'set', type: 'f32', column: 'state.mood', row, value: clamp01(mood + delta) },
    { op: 'set', type: 'f32', column: 'state.stress', row, value: clamp01(stress - delta + claimStress) },
  ];
  return { patches, events, summary, deltas };
}

/**
 * 044 R-006: forma las intenciones. El azar (poder llamar ahora, la elección) sale del flujo `intent:<CIT>` de la
 * semilla del mundo en ese minuto: el replay lo reproduce sin guardar nada más (R-010).
 */
function formIntentions(
  view: WorldView, citizenId: EntityId, store: FunctionStore, claims: readonly { a: ClaimAssessment; believedId: EntityId }[],
  cat: ChatCatalog, cp: ClaimParams, now: number, participants: { id: EntityId; role: string }[], emit: (e: NewEvent) => WorldEvent,
): { list: Intention[]; events: WorldEvent[] } {
  const person = view.citizens.get(citizenId);
  const list: Intention[] = [...(person?.intentions ?? [])].map((x) => ({ ...x }));
  const events: WorldEvent[] = [];
  const rng = createRng(view.config.seed).fork(`intent:${citizenId}`).fork(now);
  const variability = variabilityOf(view, idNumber(citizenId));
  for (const { a, believedId } of [...claims].sort((x, y) => (x.a.about! < y.a.about! ? -1 : 1))) {
    const target = a.about as EntityId;
    const r = rng.fork(target);
    const call = canCall(view, citizenId, cat, r.fork('call'));
    const options = intentionOptions(store, cat, a.impact, a.credibility, call, together(view, citizenId, target), cp);
    const choice = chooseIntention(options, variability, r.fork('choice'));
    const e = emit({
      type: 'INTENTION_FORMED',
      payload: { citizenId, kind: choice.kind, target, urgency: a.impact, expiresAt: now + cp.intentTtlMin, topic: a.predicate },
      causes: [
        { event: believedId, weight: 1 },
        ...choice.sources.slice(0, 2).map((s) => ({ state: `fuente.${s.source}:${s.ref ?? ''}`, entity: citizenId, weight: 0.3 })),
      ],
      participants: [...participants, { id: target, role: 'tercero' }],
    });
    events.push(e);
    const next: Intention = { kind: choice.kind, target, topic: a.predicate, urgency: a.impact, expiresAt: now + cp.intentTtlMin, cause: e.id };
    const i = list.findIndex((x) => x.target === target);
    if (i >= 0) list[i] = next;
    else list.push(next);
  }
  return { list, events };
}
