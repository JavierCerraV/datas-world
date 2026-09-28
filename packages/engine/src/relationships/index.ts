// Relaciones (spec 012 v0.2): la persona como estímulo con función, encuentros con las posturas de la charla,
// familiaridad, tensión, confianza, etiquetas, discusiones, parejas, rupturas y olvido.
import type { ChatParams, ClaimParams } from '../conversation/params.ts';
import type { ChatCatalog } from '../conversation/types.ts';
import type { Ontology } from '../functions/types.ts';
import type { System } from '../simulation/system.ts';
import { createBondDailySystem, createBondLedgerSystem } from './daily.ts';
import { createSocialEncounterSystem } from './encounters.ts';
import type { RelationshipParams } from './params.ts';

export { APPROACH, CLASH, RELATIONSHIP_DEFAULTS, TONE_OF_STANCE, personStimulus } from './params.ts';
export type { RelationshipParams } from './params.ts';
export { affectionFor, bondWith, forgettable, hasPartner, relabel, sameOrg, touch } from './bonds.ts';
export { exchange } from './exchange.ts';
export { attachmentOf } from './attachment.ts';
export type { Attachment } from './attachment.ts';
export type { Exchange, Side } from './exchange.ts';
export { approachOf, createSocialEncounterSystem } from './encounters.ts';
export type { EncounterDeps } from './encounters.ts';
export { createBondDailySystem, createBondLedgerSystem } from './daily.ts';

/** Los tres sistemas de las relaciones, para registrarlos con la vida diaria. */
export const relationshipSystems = (o: { cat: ChatCatalog; onto: Ontology; chat: ChatParams; claim: ClaimParams; p: RelationshipParams }): System[] => [
  createSocialEncounterSystem(o),
  createBondLedgerSystem(),
  createBondDailySystem(o.p, o.claim),
];
