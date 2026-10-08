// Pasarela LLM (spec 026) y capa de charla con ciudadanos (spec 043).
export { DEFAULT_CONFIG, HAIKU, HAIKU_5_5, parseConfig } from './config.ts';
export { Gateway, costMicros, extractJson } from './gateway.ts';
export type { GatewayOptions } from './gateway.ts';
export { recordKey } from './key.ts';
export { MemoryRecordStore } from './records.ts';
export { anthropicAdapter, buildAnthropicParams } from './providers/anthropic.ts';
export { mockAdapter } from './providers/mock.ts';
export type { MockResponder } from './providers/mock.ts';
export { openaiCompatibleAdapter } from './providers/openai.ts';
export type { ProviderAdapter, ProviderCall, ProviderResponse } from './providers/types.ts';
export { EFFORTS, NO_USAGE, PURPOSES } from './types.ts';
export type {
  ChatMessage, Effort, FallbackReason, GatewayConfig, LlmRecord, LlmRequest, LlmResult, ModelConfig, PromptPart, ProviderName, Purpose,
  RecordStore, Source, Usage,
} from './types.ts';

export { chatCatalogs } from './chat/catalog.ts';
export type { ChatCatalogs, ClaimInfo, RelationInfo, StanceInfo, ToneInfo } from './chat/catalog.ts';
export { classifyTone, lexicalClaims, lexicalTone } from './chat/classify.ts';
export type { ClassifyCatalogs, ToneResult, VisitorClaim } from './chat/classify.ts';
export { discloseView, factLevel } from './chat/disclosure.ts';
export { TRANSCRIPT_TURNS, TRUST_TEXT, expressionRequest, instructions, renderView, stancePart } from './chat/prompt.ts';
export type { TranscriptTurn } from './chat/prompt.ts';
export { ChatEndedError, ChatSession, STRANGER_TEMPLATE, TEMPLATES } from './chat/session.ts';
export type { ChatSessionOptions, TurnOptions, TurnOutcome } from './chat/session.ts';
export { verifyReply } from './chat/verify.ts';
export type { Claim, Verdict, Verification } from './chat/verify.ts';
export { buildPersonView } from './chat/view.ts';
export type { FamilyMember, PersonView, ViewFact, ViewInput } from './chat/view.ts';
export { LLM_RANGE, administerBattery, administerInstrument, itemsText } from './psychometrics.ts';
export type { ItemAnswer, ItemPlan, ItemSource, PartPlan } from './psychometrics.ts';
