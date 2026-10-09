// El protocolo en el mundo (spec 047 §5): tres entradas externas validadas (CLAUDE.md regla 4; 023 R-004). El estudio
// las envía; el motor decide la dosis con lo que pasó en la sesión y deja un evento con causas. Nada de lo que escribió
// un LLM entra aquí: solo qué componente se trabajó en cada turno y la postura que el motor ya había elegido (INV-001).
import { storeOf } from '../functions/system.ts';
import { learningParams } from '../functions/system.ts';
import { sensitivityOf } from '../functions/sensitivity.ts';
import { prune } from '../functions/learn.ts';
import type { Ontology } from '../functions/types.ts';
import { idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import { createRng } from '../rng.ts';
import { applyPatches } from '../simulation/patches.ts';
import type { WorldView } from '../simulation/system.ts';
import type { InputHandler } from '../tick.ts';
import type { World } from '../world.ts';
import { NO_DOSE, PROTOCOL_PARAMS, applyDose, hasValue, practiceProbability, sessionDose } from './dose.ts';
import type { Dose, Exchange } from './dose.ts';
import { ACT_PNR_3 } from './act-pnr-3.ts';
import type { Protocol } from './types.ts';

const PROTOCOLS_BY_ID: Readonly<Record<string, Protocol>> = { [ACT_PNR_3.id]: ACT_PNR_3 };

/** Tipos de entrada cuyos eventos deben llegar a los sistemas en el tick siguiente (`Runner` `feedKinds`, 028 R-003). */
export const PROTOCOL_FEED_KINDS: ReadonlySet<string> = new Set(['protocol_session', 'protocol_practice', 'protocol_end']);

export interface ProtocolSessionInput {
  citizenId: string;
  protocol: string;
  session: number;
  attended: boolean;
  /** Proporción de componentes cubiertos (R-005c); se registra, no multiplica: la dosis ya sale de lo que se trabajó. */
  fidelity: number;
  exchanges: Exchange[];
  /** Análisis de sensibilidad (R-009); por defecto 1. */
  scale?: number;
}

export interface ProtocolPracticeInput {
  citizenId: string;
  /** Ensayos de una práctica: 1 por cada mecanismo que las sesiones ya trabajaron. */
  trials: Dose;
}

const person = (world: World, id: unknown): id is EntityId => typeof id === 'string' && world.citizens.get(id as EntityId)?.status === 'active' && !world.citizens.get(id as EntityId)?.ancestor;
const round = (x: number) => Math.round(x * 1000) / 1000;
const isDose = (d: unknown): d is Dose => typeof d === 'object' && d !== null && (['yo', 'extincion', 'valores'] as const).every((k) => Number.isInteger((d as Dose)[k]) && (d as Dose)[k] >= 0);
const f32 = (world: World, column: string, row: number, fallback: number): number => world.components.f32[column]?.[row] ?? fallback;

/** Manejadores `protocol_session`, `protocol_practice` y `protocol_end` para el Runner (`opts.inputs`). */
export function protocolInputs(o: { onto: Ontology }): Record<string, InputHandler> {
  const learn = (world: World, id: EntityId, dose: Dose, strength: number, source: string) => {
    const view = world as unknown as WorldView;
    const row = idNumber(id);
    const store = storeOf(view, row);
    const P = learningParams(world.config.profile, world.config.epoch.slice(0, 10));
    const effect = applyDose(store, o.onto, P, sensitivityOf(view, row), dose, strength, world.now, source);
    if (dose.yo + dose.extincion + dose.valores > 0) {
      prune(store, P);
      applyPatches(world, [{ op: 'entity', id, fields: { functions: store }, owned: true }], `protocol/${id}`);
    }
    return { yo: { from: round(effect.yo.from), to: round(effect.yo.to) }, avoidance: { from: round(effect.avoidance.from), to: round(effect.avoidance.to) }, domains: effect.domains };
  };
  return {
    protocol_session: (world, input) => {
      const p = input.payload as Partial<ProtocolSessionInput>;
      if (!person(world, p?.citizenId)) return { ok: false, reason: 'protocol_session: persona inexistente o inactiva' };
      const session = PROTOCOLS_BY_ID[String(p.protocol)]?.sessions.find((s) => s.n === p.session);
      if (!session) return { ok: false, reason: `protocol_session: protocolo o sesión desconocidos (${String(p.protocol)}, ${String(p.session)})` };
      if (typeof p.attended !== 'boolean' || typeof p.fidelity !== 'number' || !Array.isArray(p.exchanges) || p.exchanges.some((x) => typeof x?.component !== 'string' || typeof x?.stance !== 'string'))
        return { ok: false, reason: 'protocol_session: asistencia, fidelidad o intercambios inválidos' };
      const id = p.citizenId;
      const exchanges = p.exchanges;
      return {
        ok: true,
        apply: (cause, emit) => {
          const { dose, engagement } = p.attended ? sessionDose(session, exchanges, p.scale ?? 1) : { dose: NO_DOSE, engagement: 0 };
          const effect = learn(world, id, dose, 1, `protocol:${session.n}`);
          emit({
            type: 'PROTOCOL_SESSION',
            payload: { citizenId: id, protocol: p.protocol, session: session.n, attended: p.attended, turns: exchanges.length, engagement: round(engagement), fidelity: round(p.fidelity!), dose, ...effect },
            causes: [...cause, { state: 'protocolo.compromiso', entity: id, value: round(engagement), weight: 0.5 }],
            participants: [{ id, role: 'persona' }],
          });
        },
      };
    },
    protocol_practice: (world, input) => {
      const p = input.payload as Partial<ProtocolPracticeInput>;
      if (!person(world, p?.citizenId)) return { ok: false, reason: 'protocol_practice: persona inexistente o inactiva' };
      if (!isDose(p.trials)) return { ok: false, reason: 'protocol_practice: ensayos inválidos' };
      const id = p.citizenId;
      const trials = p.trials;
      return {
        ok: true,
        apply: (cause, emit) => {
          // R-006: que practique hoy lo decide el motor con su estado; el azar es un flujo propio de la persona y el día.
          const row = idNumber(id);
          const store = storeOf(world as unknown as WorldView, row);
          const prob = practiceProbability({ stress: f32(world, 'state.stress', row, 0), energy: f32(world, 'need.energy', row, 1), hasValue: hasValue(store) });
          if (!createRng(world.config.seed).fork(`protocol:practice:${id}:${world.now}`).chance(prob)) return;
          const effect = learn(world, id, trials, PROTOCOL_PARAMS.practiceStrength, 'protocol:practice');
          emit({
            type: 'PRACTICE_DONE',
            payload: { citizenId: id, probability: round(prob), dose: trials, ...effect },
            causes: [...cause, { state: 'protocolo.adherencia', entity: id, value: round(prob), weight: 0.5 }],
            participants: [{ id, role: 'persona' }],
          });
        },
      };
    },
    protocol_end: (world, input) => {
      const p = input.payload as { citizenId?: string; reason?: unknown };
      if (!person(world, p?.citizenId)) return { ok: false, reason: 'protocol_end: persona inexistente o inactiva' };
      if (typeof p.reason !== 'string' || p.reason.length === 0) return { ok: false, reason: 'protocol_end: falta el motivo' };
      const id = p.citizenId;
      const reason = p.reason;
      return { ok: true, apply: (cause, emit) => void emit({ type: 'PROTOCOL_ENDED', payload: { citizenId: id, reason }, causes: cause, participants: [{ id, role: 'persona' }] }) };
    },
  };
}
