// API pública del motor.
export { createRng, restoreRng } from './rng.ts';
export type { Rng, RngState } from './rng.ts';

export { ENTITY_KINDS, ID_WIDTH, allocateId, emptyCounters, formatId, idKind, idNumber } from './ids.ts';
export type { Counters, EntityId, EntityKind, WorldId } from './ids.ts';

export {
  MINUTES_PER_DAY,
  ageInYears,
  civilFromDays,
  daysFromCivil,
  formatDate,
  parseDate,
  parseEpoch,
  toCalendar,
} from './calendar.ts';
export type { CalendarView, CivilDate, CivilDateTime, WorldMinute } from './calendar.ts';

export { createScheduler, popDue, schedule, sortedItems } from './scheduler.ts';
export type { ScheduledItem, Scheduler } from './scheduler.ts';

export { EVENT_TYPES, eventText, makeEvent } from './events.ts';
export type { CauseRef, DevelopmentEpisode, EventOrigin, EventType, NewEvent, WorldEvent } from './events.ts';

export {
  CAPABILITIES,
  CAPABILITY_DEPS,
  canEnable,
  isCapability,
  validateCapabilities,
  withCapability,
} from './capabilities.ts';
export type { Capability } from './capabilities.ts';

export { capacityFor, columns, defineColumn, ensureCapacity } from './components.ts';
export type { CitizenComponents, ColumnType } from './components.ts';

export {
  LATE_CLOSE_LIMIT,
  addCitizen,
  addHousehold,
  addOrganization,
  addPerson,
  addPlace,
  completeHousehold,
  createWorld,
  deactivateEntity,
  validateConfig,
} from './world.ts';
export type {
  BaseEntity,
  Belief,
  Bond,
  BondLabel,
  CatalogRef,
  Citizen,
  Debt,
  HealthCondition,
  Household,
  Intention,
  Kinship,
  LeisureInterest,
  KinshipKind,
  NewOrganization,
  NewPerson,
  Occupation,
  NewObject,
  NewPlace,
  NewPosition,
  OpeningHours,
  Organization,
  Place,
  Position,
  Shift,
  World,
  WorldConfig,
  WorldObject,
  WorldStatus,
} from './world.ts';

export {
  TILE,
  createGeoMap,
  doorDistanceMatrix,
  geoFromData,
  geoToData,
  roadDistances,
  setTile,
  tileAt,
} from './geo.ts';
export type { GeoMap, GeoMapData, TileKind, TilePoint } from './geo.ts';

export { canonicalize, hashString } from './hash.ts';
export { deserializeWorld, serializeWorld, stateHash } from './serialize.ts';
export type { WorldSnapshot } from './serialize.ts';

export { applyExternalInput, tick } from './tick.ts';
export type { ExternalInput, InputHandler, InputResult, ScheduledHandler } from './tick.ts';

export { PHASES } from './simulation/system.ts';
export type {
  Account,
  ActionOutcome,
  ActionRequest,
  ActionValidator,
  Cadence,
  DeepReadonly,
  Patch,
  Phase,
  SimLevel,
  System,
  SystemEvent,
  SystemOutput,
  TickCtx,
  WorldView,
} from './simulation/system.ts';
export { EMPTY_REGISTRY, activeSystems, createRegistry } from './simulation/registry.ts';
export type { SystemRegistry } from './simulation/registry.ts';
export { levelOf, runSystems } from './simulation/loop.ts';
export type { LoopOptions } from './simulation/loop.ts';
export { applyPatches } from './simulation/patches.ts';
export { viewOf } from './simulation/view.ts';

export { ENGINE_VERSION } from './version.ts';

export { hire, setOccupation } from './employment.ts';
export { addAncestor, setFoundedAt, setParents } from './history.ts';
export type { NewAncestor } from './history.ts';
export { GIFT_SENTIMENTAL, addObject, loseObject, objectsOf, recordObjectEvent, transferObject } from './objects.ts';
export type { ObjectTransfer } from './objects.ts';

export { checkProfile, profileEntry, profileNumber, profileValue } from './profile.ts';
export type { CountryProfile, ProfileEntry, ProfileScope, ProfileStatus, ProfileValue } from './profile.ts';

export { REAL_TIME, Runner } from './runner.ts';
export type { Speed } from './runner.ts';

export { ACTIVITY, ACTIVITY_COLUMN } from './activity.ts';
export type { ActivityKind } from './activity.ts';

export {
  EMOTIONS,
  EVENT_EMOTIONS,
  NEEDS,
  NEEDS_COLUMNS,
  NEEDS_SYSTEMS,
  acuteKeys,
  defineNeedsColumns,
  emotionPatches,
  illnessSystem,
  initNeeds,
  needsParams,
  needsSystem,
  sleepSystem,
  MOOD_BASELINE,
} from './needs/index.ts';
export type { NeedsParams } from './needs/index.ts';

export {
  ROUTINE_COLUMNS,
  dayInfo,
  defineRoutineColumns,
  initRoutines,
  isEarlyDay,
  planAt,
  routineParams,
  routinesSystem,
  shiftOf,
  worksShiftToday,
} from './routines/index.ts';
export type { DayInfo, Planned } from './routines/index.ts';

export {
  MOBILITY_COLUMNS,
  MODES,
  busWait,
  defineMobilityColumns,
  enterRefusal,
  firstOfKind,
  homeOf,
  initMobility,
  isOpen,
  metersBetween,
  mobilityParams,
  mobilitySystem,
  modeCode,
  networkOf,
  occupancy,
  placeFor,
  planTrip,
  schoolOf,
  travelMinutes,
  travelTo,
  vehiclesOf,
  workplaceOf,
  worksAt,
} from './mobility/index.ts';
export type { MobilityParams, Mode, TripPlan } from './mobility/index.ts';

export {
  ACTION_KINDS,
  DECISION_COLUMNS,
  activityOf,
  buildOptions,
  choose,
  createActionValidator,
  createDecisionSystem,
  defineDecisionColumns,
  explainCauses,
  freeUntil,
  OBLIGATION_DELAY_DAYS,
  pickIndex,
  softmax,
  STRENGTH_REF,
  STRENGTH_SCALE,
  strengthContribution,
  temperatureOf,
} from './decision/index.ts';
export type { ActionParams, ControlSource, DecisionCtx, LeisureActivity, LeisureTable, Option, SourceContribution } from './decision/index.ts';

export {
  ECONOMY_COLUMNS,
  copay,
  defineEconomyColumns,
  economyParams,
  economySystem,
  foodDaily,
  formalWorkers,
  loanTerms,
  monthlyWage,
  quincena,
  totalMoney,
  utilityBill,
} from './economy/index.ts';
export type { EconomyParams } from './economy/index.ts';
export { balanceOf } from './simulation/patches.ts';

export { JobChanges, WORK_COLUMNS, WORK_SYSTEMS, defineWorkColumns, workLateSystem, workMarketSystem, workParams } from './work/index.ts';
export type { WorkParams } from './work/index.ts';

export {
  EVENT_LEARNING,
  LEARNING_DEFAULTS,
  NEUTRAL,
  WORLD_STIMULI,
  createLearningSystem,
  createOntology,
  DEFAULT_K,
  DEFAULT_VARIABILITY,
  discounted,
  discountKOf,
  distance,
  elicitationGain,
  initLearnedStates,
  K_MAX,
  K_MIN,
  leisureResponse,
  leisureStrength0,
  variabilityOf,
  directValue,
  elicited,
  emptyStore,
  gradient,
  isGeneralized,
  learningParams,
  netValue,
  operant,
  ownValue,
  pair,
  prune,
  reinforcingValue,
  sensitivityOf,
  storeOf,
} from './functions/index.ts';
export type {
  FunctionEntry,
  FunctionStore,
  Inhibition,
  LearningParams,
  LearningRule,
  Ontology,
  ResponseEntry,
  Sensitivity,
  StimulusClass,
  Trial,
} from './functions/index.ts';

export {
  ATTENUATION,
  CFUNC_DEFAULT,
  COMP_FACTOR,
  EVENT_TEACHING,
  INVERSE,
  MAX_DEPTH,
  MAX_RELATIONS,
  compose,
  derive,
  emptyNetwork,
  functionalValue,
  networkMetrics,
  relationalNetworkOf,
  relationsSystem,
  teach,
  transformFactor,
} from './relations/index.ts';
export type { Derived, FunctionalValue, NetworkMetrics, Relation, RelationType, RelationalNetwork, Teaching, TeachingRule } from './relations/index.ts';

export {
  DOMAIN_PREFIX,
  JOB_SEARCH_CONTRAST_RATE,
  LAB_CONTRAST_RATE,
  MAX_RULES,
  PLIANCE_DISCOUNT,
  ROUTINE_RULES,
  SPEAKER_APPROVAL_BONUS,
  THOUGHT_THRESHOLD,
  addRule,
  applicable,
  initRules,
  kindOf,
  observe,
  routineResponse,
  ruleContribution,
  rulesOf,
  rulesSystem,
  thoughtAppears,
  valueContribution,
} from './rules/index.ts';
export type { NewRule, Rule, RuleKind } from './rules/index.ts';

export {
  CHAT_DEFAULTS,
  CHAT_UNTIL,
  CLAIM_DEFAULTS,
  FLEXIBLE_FROM,
  INTENTION_KINDS,
  RESPONSES,
  SEVERITY,
  areFamily,
  assessClaim,
  bondOf,
  canCall,
  chatInputHandlers,
  chooseIntention,
  claimsHeard,
  consequenceSystems,
  createBondSystem,
  createCallSystem,
  createEncounterSystem,
  hasPhone,
  intentionOptions,
  resolveRelation,
  respond,
  stratumOf,
  tensionNow,
  defineChatColumns,
  STANCE_PREFIX,
  chatAvailability,
  citizenAnswered,
  consolidateChat,
  motivation,
  openingEvent,
  selectStance,
  stanceOptions,
  stanceResponse,
  stanceStrength,
  startConversation,
  summarize,
  toneValue,
  visitorSaid,
  visitorStimulus,
  visitorValue,
} from './conversation/index.ts';
export type {
  Availability,
  ChatCatalog,
  ChatContribution,
  ChatOpenInput,
  ChatParams,
  ChatSessionInput,
  ChatSource,
  ChatSummary,
  ClaimAssessment,
  ClaimCtx,
  ClaimDef,
  ClaimParams,
  Consolidation,
  ConversationState,
  EncounterResponse,
  HeardClaim,
  IntentionChoice,
  IntentionKind,
  IntentionOption,
  LearnerCtx,
  LiveState,
  PersonCtx,
  RelationDef,
  RelationResolve,
  StanceChoice,
  StanceDef,
  StanceOption,
  ToneDef,
  TurnRecord,
  VisitorTurn,
} from './conversation/index.ts';

export {
  AVOIDANCE_RESPONSES,
  AVOIDANCE_W0,
  PRIVATE_DEFAULTS,
  SELF_RESPONSE,
  activate,
  applyStep,
  avoidanceOf,
  consolidate,
  createPrivateSystem,
  derivationStep,
  fade,
  focusOf,
  loadOf,
  mindTick,
  responseStrength,
  scale,
  seedResponse,
  stepMind,
} from './private/index.ts';
export type { AvoidanceResponse, EpisodeEnd, MindCtx, MindState, MindTick, PnrEpisode, PrivateEvent, PrivateParams, StepResult } from './private/index.ts';
// Relaciones (spec 012 v0.2): encuentros, vínculos, etiquetas, discusiones, parejas, rupturas y olvido.
export {
  APPROACH,
  CLASH,
  RELATIONSHIP_DEFAULTS,
  TONE_OF_STANCE,
  affectionFor,
  approachOf,
  attachmentOf,
  bondWith,
  createBondDailySystem,
  createBondLedgerSystem,
  createSocialEncounterSystem,
  exchange,
  forgettable,
  hasPartner,
  personStimulus,
  relabel,
  relationshipSystems,
  sameOrg,
  touch,
} from './relationships/index.ts';
export type { Attachment, EncounterDeps, Exchange, RelationshipParams, Side } from './relationships/index.ts';
// Causalidad hasta el origen (spec 019 v0.2).
export { ORIGIN_RULES, STRESS_KEYS, WHY_DEFAULTS, createOriginsSystem, originCause, sleepCauses, walk, why, whyLines } from './causality/index.ts';
export type { OriginKey, StateOrigins, WhyNode, WhyOptions } from './causality/index.ts';
// Conocimiento, creencias y rumores (spec 025 v0.2).
export { KNOWLEDGE_DEFAULTS, SEEN, TELL, beliefTruth, closeness, createKnowledgeSystem, hear, learnBelief, tellInEncounter, topicOf, topicsOf } from './knowledge/index.ts';
export type { Hearing, KnowledgeCatalog, KnowledgeDeps, KnowledgeParams, Listener, TellDeps, TellSide, TopicDef } from './knowledge/index.ts';
// Informe de vida (spec 020 v0.3).
export { TURNING_POINTS, concerns, divergences, emergentProfile, lifeReport, objectiveChapters, turningCandidates, turningPoints } from './lifereport/index.ts';
export type { DayPoint, Divergence, EmergentProfile, LifeChapter, LifeReport, ProfileKey, ReportInput, TurningPoint } from './lifereport/index.ts';
// Instrumentos psicológicos (spec 045).
export {
  INDICATORS,
  INDICATORS_VERSION,
  INDICATOR_PARAMS,
  RESPONSE_NOISE,
  ageGroup,
  answerInstrument,
  candidatesOf,
  categoryOf,
  checkInstrument,
  cohenD,
  cronbachAlpha,
  describeScores,
  groupStats,
  indicatorValues,
  isIndicator,
  pearson,
  resolveSelection,
  responseRng,
  samplingRng,
  scoreOf,
} from './instruments/index.ts';
export type {
  Answer,
  Candidate,
  Cutoff,
  Descriptive,
  ExclusionReason,
  GroupRow,
  IndicatorInput,
  IndicatorKey,
  Instrument,
  InstrumentItem,
  InstrumentOption,
  ResolvedSelection,
  ResponseResult,
  Selection,
} from './instruments/index.ts';
// Memoria autobiográfica (spec 013 v0.3).
export {
  CHAT_RECALL,
  MEMORY_DEFAULTS,
  MEMORY_KINDS,
  addMemory,
  consolidateMemory,
  createMemorySystem,
  distortion,
  emptyMemory,
  encodeEvent,
  episodeValue,
  memoryDecayDay,
  openChapter,
  peopleOf,
  themeOf,
  recall,
  rehearse,
  remembererOf,
  retention,
  trimMemory,
  updateChapters,
} from './memory/index.ts';
export type { Chapter, FnOf, Memory, MemoryKind, MemoryParams, MemoryStore, RecallContext, SchemaChange } from './memory/index.ts';

export { FORBIDDEN_TERMS, MECHANISMS, isMechanism } from './temperament/mechanisms.ts';
export type { MechanismId } from './temperament/mechanisms.ts';
export { POLICY, checkArchitecture, doneTasks } from './architecture/rules.ts';
export type { ArchitecturePolicy, SourceFile, Violation } from './architecture/rules.ts';
