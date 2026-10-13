// La cuenta de lo cubierto en una sesión (spec 047 R-005b, R-005c). La lleva el motor: lo que el terapeuta declare
// como cubierto no cuenta, solo los intercambios que de verdad ocurrieron.
import type { Protocol, ProtocolSession, SessionNumber } from './types.ts';

export interface SessionProgress {
  /** Intercambios por componente, en orden de aparición. */
  exchanges: Map<string, number>;
}

export interface Coverage {
  covered: string[];
  missing: string[];
  /** Proporción de componentes obligatorios cubiertos, en [0,1]. */
  fidelity: number;
}

export function sessionOf(protocol: Protocol, n: SessionNumber): ProtocolSession {
  const s = protocol.sessions.find((x) => x.n === n);
  if (!s) throw new Error(`El protocolo ${protocol.id} no tiene la sesión ${n}`);
  return s;
}

export const newProgress = (): SessionProgress => ({ exchanges: new Map() });

/** Cuenta un turno del terapeuta que la persona respondió. `false` si el componente no es de esta sesión. */
export function recordExchange(progress: SessionProgress, session: ProtocolSession, componentId: string): boolean {
  if (!session.components.some((c) => c.id === componentId)) return false;
  progress.exchanges.set(componentId, (progress.exchanges.get(componentId) ?? 0) + 1);
  return true;
}

export function coverage(session: ProtocolSession, progress: SessionProgress): Coverage {
  const required = session.components.filter((c) => c.required);
  const done = (id: string, min: number) => (progress.exchanges.get(id) ?? 0) >= min;
  const covered = required.filter((c) => done(c.id, c.minTurns)).map((c) => c.id);
  const missing = required.filter((c) => !done(c.id, c.minTurns)).map((c) => c.id);
  return { covered, missing, fidelity: required.length === 0 ? 1 : covered.length / required.length };
}
