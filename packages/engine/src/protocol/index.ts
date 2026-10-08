// Protocolos de intervención (spec 047): guía estructurada y cuenta de lo cubierto en una sesión.
import { ACT_PNR_3 } from './act-pnr-3.ts';
import type { Protocol, ProtocolId } from './types.ts';

export { ACT_PNR_3 };
export const PROTOCOLS: Readonly<Record<ProtocolId, Protocol>> = Object.freeze({ 'act-pnr-3': ACT_PNR_3 });
export type { Mechanism, Protocol, ProtocolComponent, ProtocolId, ProtocolSession, SessionNumber } from './types.ts';
export { coverage, newProgress, recordExchange, sessionOf } from './tracker.ts';
export type { Coverage, SessionProgress } from './tracker.ts';
