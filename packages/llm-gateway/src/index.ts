// Pasarela LLM (spec 026) y capa de charla con ciudadanos (spec 043).
export { DEFAULT_CONFIG, HAIKU, parseConfig } from './config.ts';
export { Gateway, costMicros, extractJson } from './gateway.ts';
export type { GatewayOptions } from './gateway.ts';
export { recordKey } from './key.ts';
export { MemoryRecordStore } from './records.ts';
export { anthropicAdapter, buildAnthropicParams } from './providers/anthropic.ts';
export { mockAdapter } from './providers/mock.ts';
export type { MockResponder } from './providers/mock.ts';
export { openaiCompatibleAdapter } from './providers/openai.ts';
export type { ProviderAdapter, ProviderCall, ProviderResponse } from './providers/types.ts';
export { NO_USAGE, PURPOSES } from './types.ts';
export type {
  ChatMessage, FallbackReason, GatewayConfig, LlmRecord, LlmRequest, LlmResult, ModelConfig, PromptPart, ProviderName, Purpose,
  RecordStore, Source, Usage,
} from './types.ts';

export { chatCatalogs } from './chat/catalog.ts';
export type { ChatCatalogs, StanceInfo, ToneInfo } from './chat/catalog.ts';
export { classifyTone, lexicalTone } from './chat/classify.ts';
export type { ToneResult } from './chat/classify.ts';
export { TRANSCRIPT_TURNS, expressionRequest, instructions, renderView, stancePart } from './chat/prompt.ts';
export type { TranscriptTurn } from './chat/prompt.ts';
export { ChatEndedError, ChatSession, TEMPLATES } from './chat/session.ts';
export type { ChatSessionOptions, TurnOptions, TurnOutcome } from './chat/session.ts';
export { verifyReply } from './chat/verify.ts';
export type { Claim, Verdict, Verification } from './chat/verify.ts';
export { buildPersonView } from './chat/view.ts';
export type { FamilyMember, PersonView, ViewFact, ViewInput } from './chat/view.ts';
