/**
 * The report session: one document, its revision and its undo history,
 * shared by every view of it -- the React builder, the Angular builder, a
 * proposal being reviewed.
 *
 * It follows formancy's builder session (`@formancy/builder-core`), and
 * three rules shape it
 * ([0008](../../../docs/decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)):
 *
 * - **It never holds a document the validator refuses.** Every edit is a
 *   command run against the current document; its result is validated
 *   whole, and only a valid result is committed. A refused edit changes
 *   nothing: not the document, not its identity, not the revision, not the
 *   history, and no listener hears of it.
 * - **A committed document is a frozen snapshot**, the same object until
 *   the next commit, so `useSyncExternalStore` and Angular signals can
 *   compare it by identity. What an edit did not change keeps its identity
 *   too, matched by id within its list, so a view of one component redraws
 *   only when that component changed or moved to another list.
 * - **History is snapshots.** Undo puts back the very document that was
 *   there; an edit after an undo clears what could be redone.
 */
import { reportHash, validateReport } from '@formancy/report-spec'
import type { ReportDefinition, ReportError } from '@formancy/report-spec'
import type { CommandDescriptor } from './commands/registry.js'
import { commandOf, drafted, validated } from './draft.js'
import type { Draft, Synchronous } from './draft.js'
import { refuse } from './outcome.js'
import type { Command, CommandOutcome, Refusal } from './outcome.js'
import { settled, thawed } from './snapshot.js'
import type { Mutable } from './snapshot.js'

/**
 * Undo steps a session keeps unless told otherwise; past it, the oldest is
 * dropped. Chosen, not measured: two hundred steps is longer than an
 * editing session's worth of undoing anyone does, and it bounds the
 * history's memory. A step holds a whole snapshot, but a snapshot shares
 * every part its edit did not change with the one before it, so a step
 * costs about what its edit changed -- except a component moved into
 * another list, which is copied with all it holds, and a replaced document,
 * which shares what happens to be equal and nothing else.
 */
export const DEFAULT_HISTORY_LIMIT = 200

/** The label a step gets when the edit was given none and is not a descriptor. */
const UNLABELLED = 'edit'

export interface SessionOptions {
  /** Undo steps to keep; a whole number, 0 for none. DEFAULT_HISTORY_LIMIT when absent. */
  readonly historyLimit?: number
}

export interface EditOptions {
  /** What the toolbar calls this step: "Undo <label>". A descriptor's command name, or 'edit', when absent. */
  readonly label?: string
  /** The hash of the document the edit was made against; an edit made against another is refused as stale. */
  readonly expectedHash?: string
}

export interface ReportSession {
  /** The current document: frozen, and the same object until the next change. */
  document(this: void): ReportDefinition
  /** Counts changes: one per committed edit, undo or redo. A refused edit, or one that changed nothing, is not one. */
  revision(): number
  /** `reportHash` of the current document, what a save or a proposal is bound to. */
  hash(): string
  /**
   * Calls `listener` after every change, synchronously, until the function
   * returned is called. A listener that throws does not stop the others;
   * once all have run, its error is thrown from the call that made the
   * change -- which has been made -- or an AggregateError when several threw.
   */
  subscribe(this: void, listener: () => void): () => void
  /**
   * Runs a command against the document and commits the result if the
   * validator accepts it. A command returns the next report and never edits
   * the session: one that calls the session while it runs throws.
   */
  apply<E extends object>(command: Command<E>, options?: EditOptions): CommandOutcome<E>
  apply(descriptor: CommandDescriptor, options?: EditOptions): CommandOutcome
  /**
   * Runs several commands as one edit: one undo step, one notification,
   * validated once at the end, so the draft may be invalid in between. A
   * refused command, or an invalid end, refuses the whole and changes
   * nothing; an exception thrown by `run` passes through, changing nothing.
   * `run` is synchronous: an async one does not compile, and a promise
   * returned anyway is refused with a TypeError before anything commits.
   * `tryEdit` gives the same verdict without committing.
   */
  transaction<R>(label: string, run: (draft: Draft) => Synchronous<R>, options?: Pick<EditOptions, 'expectedHash'>): CommandOutcome
  /** Takes a whole document -- a paste, an import, a proposal -- as one undoable edit, validated like any other. */
  replaceDocument(next: unknown, options?: EditOptions): CommandOutcome
  canUndo(): boolean
  canRedo(): boolean
  /** Puts back the document before the last step; false when there is none. */
  undo(): boolean
  /** Takes the last undone step again; false when there is none. */
  redo(): boolean
  /** The label of the step undo would take back. */
  undoLabel(): string | undefined
  /** The label of the step redo would take again. */
  redoLabel(): string | undefined
  /** A deep, mutable copy of the document, safe to hand to anything. */
  exportDocument(): Mutable<ReportDefinition>
}

export type SessionOpening = { readonly ok: true; readonly session: ReportSession } | { readonly ok: false; readonly errors: readonly ReportError[] }

/** A document in the history, and the label of the step that leads away from it. */
interface Step {
  readonly document: ReportDefinition
  readonly label: string
}

/** What the session is in the middle of, during which nothing may edit it: its own work is not done. */
const BUSY = {
  transaction: 'the session is in a transaction: edit the draft the transaction was given, and let it commit',
  command: 'the session is running a command: a command returns the next report, and never edits the session',
} as const

/**
 * A session over `document`, or the validator's reasons it is not a report
 * this package reads. Never throws on a bad document: a file a person
 * picked is an expected failure. Throws a RangeError for a history limit
 * that is not a whole number from 0.
 */
export function openReportSession(document: unknown, options: SessionOptions = {}): SessionOpening {
  const limit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT
  if (!Number.isInteger(limit) || limit < 0) throw new RangeError(`a history limit is a whole number of steps from 0, not ${String(limit)}`)
  const opened = validateReport(document)
  if (!opened.valid) return { ok: false, errors: opened.errors }

  let present: ReportDefinition = settled(opened.report, undefined)
  let revision = 0
  const past: Step[] = []
  const future: Step[] = []
  const subscriptions = new Set<{ readonly listener: () => void }>()
  const hashes = new WeakMap<ReportDefinition, string>()
  let busy: keyof typeof BUSY | undefined

  function notify(): void {
    const errors: unknown[] = []
    for (const subscription of [...subscriptions]) {
      // Unsubscribed by an earlier listener in this round: not called.
      if (!subscriptions.has(subscription)) continue
      try {
        subscription.listener()
      } catch (error) {
        errors.push(error)
      }
    }
    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) throw new AggregateError(errors, `${errors.length} session listeners threw`)
  }

  function hash(): string {
    let known = hashes.get(present)
    if (known === undefined) {
      known = reportHash(present)
      hashes.set(present, known)
    }
    return known
  }

  function idle(): void {
    if (busy !== undefined) throw new Error(BUSY[busy])
  }

  /** `work`'s result, with the session refusing to be edited while it runs. */
  function during<T>(what: keyof typeof BUSY, work: () => T): T {
    busy = what
    try {
      return work()
    } finally {
      busy = undefined
    }
  }

  function stale(expectedHash: string | undefined): Refusal | undefined {
    if (expectedHash === undefined || expectedHash === hash()) return undefined
    return refuse('stale-document', 'the edit was made against a version of the report that has since changed')
  }

  /** Validates `candidate`, and commits it as one step unless it is refused or changes nothing. */
  function commit(candidate: unknown, label: string): CommandOutcome {
    const verdict = validated(candidate)
    if (!verdict.ok) return verdict
    const next = settled(verdict.report, present)
    if (next === present) return { ok: true, report: present }
    past.push({ document: present, label })
    if (past.length > limit) past.shift()
    future.length = 0
    present = next
    revision += 1
    notify()
    return { ok: true, report: next }
  }

  /** Moves one step from `from` to `to`, the present going the other way. */
  function step(from: Step[], to: Step[]): boolean {
    idle()
    const taken = from.pop()
    if (taken === undefined) return false
    to.push({ document: present, label: taken.label })
    present = taken.document
    revision += 1
    notify()
    return true
  }

  function apply<E extends object>(command: Command<E> | CommandDescriptor, options: EditOptions = {}): CommandOutcome<E> {
    idle()
    const refusal = stale(options.expectedHash)
    if (refusal !== undefined) return refusal
    const outcome = during('command', () => commandOf(command)(present))
    if (!outcome.ok) return outcome
    const label = options.label ?? (typeof command === 'function' ? UNLABELLED : command.command)
    const committed = commit(outcome.report, label)
    return committed.ok ? { ...outcome, report: committed.report } : committed
  }

  function transaction<R>(label: string, run: (draft: Draft) => Synchronous<R>, options: Pick<EditOptions, 'expectedHash'> = {}): CommandOutcome {
    idle()
    const refusal = stale(options.expectedHash)
    if (refusal !== undefined) return refusal
    const outcome = during('transaction', () => drafted(present, run))
    return outcome.ok ? commit(outcome.report, label) : outcome
  }

  const session: ReportSession = {
    document: () => present,
    revision: () => revision,
    hash,
    subscribe(listener) {
      const subscription = { listener }
      subscriptions.add(subscription)
      return () => {
        subscriptions.delete(subscription)
      }
    },
    apply,
    transaction,
    replaceDocument(next, options = {}) {
      idle()
      return stale(options.expectedHash) ?? commit(next, options.label ?? 'replaceDocument')
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    undo: () => step(past, future),
    redo: () => step(future, past),
    undoLabel: () => past.at(-1)?.label,
    redoLabel: () => future.at(-1)?.label,
    exportDocument: () => thawed(present),
  }
  return { ok: true, session }
}
