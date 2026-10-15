/**
 * Several commands as one edit: the draft they run against, and the verdict
 * on where they leave it -- what a session's transaction commits, and what a
 * proposal's review shows before anybody applies it (plan 16).
 *
 * One draft and one verdict for both, so a preview and the commit that
 * follows it cannot disagree about what a proposal does
 * ([0008](../../../docs/decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)).
 */
import { validateReport } from '@formancy/report-spec'
import type { ReportDefinition, ReportError } from '@formancy/report-spec'
import { describedCommand } from './commands/registry.js'
import type { CommandDescriptor } from './commands/registry.js'
import { refuse } from './outcome.js'
import type { Command, CommandOutcome, Refusal } from './outcome.js'

/** The working document inside a transaction, and the way to edit it. */
export interface Draft {
  /** The document as the edits so far have left it, which need not be valid. */
  document(): ReportDefinition
  /** Runs a command against the draft. After a refusal nothing more runs: each later call gives that refusal. */
  apply<E extends object>(command: Command<E>): CommandOutcome<E>
  apply(descriptor: CommandDescriptor): CommandOutcome
}

/**
 * Whatever a draft's callback returns, so long as it is not a promise. An
 * await inside the callback would end the edit with half its steps run, so
 * an async callback does not compile, and a promise that reaches the edit
 * anyway is refused when it runs.
 */
export type Synchronous<R> = R & (R extends PromiseLike<unknown> ? never : unknown)

export function commandOf<E extends object>(command: Command<E> | CommandDescriptor): Command<E> {
  return typeof command === 'function' ? command : (describedCommand(command) as Command<E>)
}

function thenable(value: unknown): boolean {
  return (typeof value === 'object' || typeof value === 'function') && value !== null && typeof (value as { then?: unknown }).then === 'function'
}

/**
 * Runs `run` against a draft of `report`: where its commands leave the
 * report, not yet validated, or the first refusal. The draft ends when
 * `run` returns or throws, and reading or editing it after that throws.
 * Throws a TypeError, having run nothing to completion, when `run` returns
 * a promise.
 */
export function drafted<R>(report: ReportDefinition, run: (draft: Draft) => Synchronous<R>): CommandOutcome {
  let working = report
  let refused: Refusal | undefined
  let open = true
  const live = (): void => {
    if (!open) throw new Error('this edit has ended: its draft cannot be read or edited any more')
  }
  const draft: Draft = {
    document: () => {
      live()
      return working
    },
    apply: <E extends object>(command: Command<E> | CommandDescriptor): CommandOutcome<E> => {
      live()
      if (refused !== undefined) return refused
      const outcome = commandOf(command)(working)
      if (outcome.ok) working = outcome.report
      else refused = outcome
      return outcome
    },
  }
  let returned: unknown
  try {
    returned = run(draft)
  } finally {
    open = false
  }
  if (thenable(returned)) throw new TypeError('an edit runs synchronously: await before it, not inside it')
  return refused ?? { ok: true, report: working }
}

/** The refusal for a result the validator refused, pointing at its first error; it gives at least one. */
function invalid(errors: readonly ReportError[]): Refusal {
  const first = errors[0] as ReportError
  return { ...refuse('invalid-document', `the edit would leave a report that is not valid: ${first.message}`, { path: first.path, componentId: first.componentId }), errors }
}

/** `candidate` as the validator's copy of it, or the refusal that carries the validator's errors. */
export function validated(candidate: unknown): CommandOutcome {
  const verdict = validateReport(candidate)
  return verdict.valid ? { ok: true, report: verdict.report } : invalid(verdict.errors)
}

/**
 * Runs several commands against `report` as a transaction would, and gives
 * the validated result -- the validator's copy -- or the first refusal, or
 * the validator's errors for an invalid end. Nothing is committed anywhere,
 * and `report` is left as it was. Throws as `drafted` does.
 */
export function tryEdit<R>(report: ReportDefinition, run: (draft: Draft) => Synchronous<R>): CommandOutcome {
  const outcome = drafted(report, run)
  return outcome.ok ? validated(outcome.report) : outcome
}
