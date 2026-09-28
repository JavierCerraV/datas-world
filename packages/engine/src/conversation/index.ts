// Charla con ciudadanos (spec 043): tono como estímulo, postura por fuentes de control y consolidación en el mundo.
export { CHAT_DEFAULTS, CLAIM_DEFAULTS, STANCE_PREFIX, stanceResponse, visitorStimulus } from './params.ts';
export type { ChatParams, ClaimParams } from './params.ts';
export { areFamily, assessClaim, bondOf, claimsHeard, resolveRelation } from './claims.ts';
export type { ClaimCtx } from './claims.ts';
export { INTENTION_KINDS, awake, canCall, chooseIntention, hasPhone, intentionOptions, placeOf, stratumOf, together } from './intentions.ts';
export type { IntentionChoice, IntentionKind, IntentionOption } from './intentions.ts';
export { RESPONSES, SEVERITY, consequenceSystems, createBondSystem, createCallSystem, createEncounterSystem, respond, tensionNow } from './encounter.ts';
export type { EncounterResponse } from './encounter.ts';
export { citizenAnswered, startConversation, stanceStrength, summarize, toneValue, visitorSaid, visitorValue } from './tone.ts';
export type { LearnerCtx, VisitorTurn } from './tone.ts';
export { motivation, selectStance, stanceOptions } from './stance.ts';
export type { PersonCtx } from './stance.ts';
export { FLEXIBLE_FROM, chatAvailability, openingEvent } from './availability.ts';
export type { Availability } from './availability.ts';
export { consolidateChat } from './consolidate.ts';
export { CHAT_UNTIL, chatInputHandlers, defineChatColumns } from './inputs.ts';
export type { ChatOpenInput } from './inputs.ts';
export type { ChatSessionInput, Consolidation } from './consolidate.ts';
export type {
  ChatCatalog, ChatContribution, ChatSource, ChatSummary, ClaimAssessment, ClaimDef, ConversationState, HeardClaim, LiveState,
  RelationDef, RelationResolve, StanceChoice, StanceDef, StanceOption, ToneDef, TurnRecord,
} from './types.ts';
