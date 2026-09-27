// Entradas externas de la charla en el mundo (spec 043 R-019): `chat_open` abre la charla según la situación de
// la persona y `chat_session` la consolida al cerrar. Las aplica el worker con el registro de manejadores del
// Runner (`inputs`); el replay las reinyecta en su (at, seq) y obtiene el mismo mundo sin llamar al LLM.
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import { defineColumn } from '../components.ts';
import { sensitivityOf } from '../functions/sensitivity.ts';
import type { LearningParams, Ontology } from '../functions/types.ts';
import { formatId, idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import { applyPatches } from '../simulation/patches.ts';
import type { WorldView } from '../simulation/system.ts';
import type { InputHandler } from '../tick.ts';
import type { World } from '../world.ts';
import { chatAvailability, openingEvent } from './availability.ts';
import { consolidateChat } from './consolidate.ts';
import type { ChatSessionInput } from './consolidate.ts';
import type { ChatParams } from './params.ts';
import type { ChatCatalog } from './types.ts';

/** Minuto hasta el que la persona está charlando (0 = no charla). Lo respeta el bucle (021, `simulation/loop.ts`). */
export const CHAT_UNTIL = 'chat.until';

export function defineChatColumns(world: World): void {
  if (!(CHAT_UNTIL in world.components.i32)) defineColumn(world.components, 'i32', CHAT_UNTIL, 0);
}

export interface ChatOpenInput {
  citizenId: string;
  visitorId: string;
  sessionId: string;
}

const personOk = (world: World, id: unknown): id is string =>
  typeof id === 'string' && world.citizens.get(id as never)?.status === 'active';

/** Manejadores `chat_open` y `chat_session` para el Runner (`opts.inputs`). */
export function chatInputHandlers(o: { cat: ChatCatalog; onto: Ontology; P: LearningParams; params: ChatParams }): Record<string, InputHandler> {
  return {
    chat_open: (world, input) => {
      const p = input.payload as ChatOpenInput;
      if (!personOk(world, p?.citizenId) || typeof p.visitorId !== 'string' || typeof p.sessionId !== 'string')
        return { ok: false, reason: 'chat_open: persona, visitante o sesión inválidos' };
      return {
        ok: true,
        apply: (cause, emit) => {
          defineChatColumns(world);
          const view = world as unknown as WorldView;
          const row = idNumber(p.citizenId as EntityId);
          const a = chatAvailability(view, row, world.now, o.params);
          emit(openingEvent(view, row, p.visitorId, p.sessionId, a, cause));
          if (!a.ok) return;
          applyPatches(world, [
            { op: 'set', type: 'i32', column: CHAT_UNTIL, row, value: a.until },
            { op: 'set', type: 'u8', column: ACTIVITY_COLUMN, row, value: ACTIVITY.conversation },
          ], 'chat_open');
        },
      };
    },
    chat_session: (world, input) => {
      const p = input.payload as ChatSessionInput;
      if (!personOk(world, p?.citizenId) || !Array.isArray(p.turns)) return { ok: false, reason: 'chat_session: persona o turnos inválidos' };
      for (const t of p.turns)
        if (!o.cat.tones.some((x) => x.key === t?.tone) || !o.cat.stances.some((x) => x.key === t?.stance))
          return { ok: false, reason: `chat_session: turno inválido (${String(t?.tone)}, ${String(t?.stance)})` };
      return {
        ok: true,
        apply: (cause, emit) => {
          defineChatColumns(world);
          const view = world as unknown as WorldView;
          const row = idNumber(p.citizenId);
          const r = consolidateChat(view, p, o.cat, { onto: o.onto, P: o.P, sens: sensitivityOf(view, row) }, o.params, world.now, cause, emit);
          applyPatches(world, [
            ...r.patches,
            // Vuelve a su día: el bucle la incluye de nuevo y la rutina decide la actividad en el próximo tick.
            { op: 'set', type: 'i32', column: CHAT_UNTIL, row, value: 0 },
            { op: 'set', type: 'u8', column: ACTIVITY_COLUMN, row, value: ACTIVITY.idle },
          ], `chat_session/${formatId('CIT', row)}`);
        },
      };
    },
  };
}
