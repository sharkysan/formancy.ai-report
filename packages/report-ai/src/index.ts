// The model's turn, in formancy's shapes and names until formancy releases one
// other products may brief (0083): ask, read, ask again, stop, decline.
export { askChecked, createStop, declinedAnswer, ModelBusyError, readAnswer } from './turn/ask.js'
export type { AskModel, AskOptions, Asked, AskTurn, Checkable, ModelPrompt, Reading, Stop, Verdict } from './turn/ask.js'

// A person carrying the turn: the request copied out, the answer pasted back.
export { createRelay, relayMessage } from './turn/relay.js'
export type { Relay, RelayAnswer, RelayTurn } from './turn/relay.js'

// The requests Report makes of a model, the briefing each is asked under, and
// the bound a turn's request is held to; a host's server asked through its
// own `complete` (0085).
export { briefingDigest, isRequestKind, modelBriefing, REQUEST_KINDS } from './kinds.js'
export type { RequestKind } from './kinds.js'
export { MAX_MODEL_REQUEST_BYTES, requestBytes } from './limits.js'
export { askThrough } from './ask-through.js'
export type { Complete, ModelCompletion, ModelRequest } from './ask-through.js'

// A language's missing words: asked for, read back by key, and held to the
// format and the compiler as one batch before a person sees it (0085).
export { MAX_PLACES, translationRequest } from './translation/request.js'
export type { AskedEntry, EntryKind, TranslationRequest, TranslationRequesting } from './translation/request.js'
export { TRANSLATION_COMPLAINTS, translationBriefing } from './translation/briefing.js'
export type { TranslationProblem, TranslationProblemKind } from './translation/briefing.js'
export { checkTranslation, translateMissing } from './translation/reader.js'
export type { NotAsked, TranslationAnswer, TranslationResult, WrittenEntry } from './translation/reader.js'
export { proposeTranslation } from './translation/proposal.js'
export type { DroppedEntry, DropReason, RefusalReason, RefusedEntry, TranslationProposal, TranslationRow } from './translation/proposal.js'
