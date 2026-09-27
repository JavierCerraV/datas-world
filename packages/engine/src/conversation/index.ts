// Charla con ciudadanos (spec 043): tono como estímulo, postura por fuentes de control y consolidación en el mundo.
export { CHAT_DEFAULTS, STANCE_PREFIX, stanceResponse, visitorStimulus } from './params.ts';
export type { ChatParams } from './params.ts';
export { citizenAnswered, startConversation, stanceStrength, summarize, toneValue, visitorSaid, visitorValue } from './tone.ts';
export type { LearnerCtx, VisitorTurn } from './tone.ts';
export { motivation, selectStance, stanceOptions } from './stance.ts';
export type { PersonCtx } from './stance.ts';
export { FLEXIBLE_FROM, chatAvailability, openingEvent } from './availability.ts';
export type { Availability } from './availability.ts';
export { consolidateChat } from './consolidate.ts';
export type { ChatSessionInput, Consolidation } from './consolidate.ts';
export type {
  ChatCatalog, ChatContribution, ChatSource, ChatSummary, ConversationState, LiveState, StanceChoice, StanceDef,
  StanceOption, ToneDef, TurnRecord,
} from './types.ts';
