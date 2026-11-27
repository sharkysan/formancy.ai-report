// The model's turn, in formancy's shapes and names until formancy releases one
// other products may brief (0083): ask, read, ask again, stop, decline.
export { askChecked, createStop, declinedAnswer, ModelBusyError, readAnswer } from './turn/ask.js'
export type { AskModel, AskOptions, Asked, AskTurn, Checkable, ModelPrompt, Reading, Stop, Verdict } from './turn/ask.js'

// A person carrying the turn: the request copied out, the answer pasted back.
export { createRelay, relayMessage } from './turn/relay.js'
export type { Relay, RelayAnswer, RelayTurn } from './turn/relay.js'

// The requests Report makes of a model: none yet.
export { REQUEST_KINDS } from './kinds.js'
export type { RequestKind } from './kinds.js'
