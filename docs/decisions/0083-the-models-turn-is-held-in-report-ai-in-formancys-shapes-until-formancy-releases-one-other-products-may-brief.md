# 0083 — The model's turn is held in report-ai, in formancy's shapes, until formancy releases one other products may brief

- **Status:** accepted; narrows [0002](0002-depend-on-upstream-never-copy-it.md) for `packages/report-ai/src/turn/` alone, as [0050](0050-every-typescript-and-javascript-file-is-linted-and-formatted-by-the-rules-the-four-repositories-share.md) narrowed it for the lint rules until `@formancy/code-style` was released; its `REQUEST_KINDS`, empty here, given the translation by [0085](0085-a-model-is-asked-only-for-the-words-a-language-lacks-and-its-answer-is-one-batch-held-to-the-format-and-the-compiler-before-a-person-sees-it.md), under which the start page's guard holds "No changes described in words in the builders" to it, and report-ai depends on report-core and report-spec outside `src/turn/`, which still imports neither
- **Date:** 2026-11-27
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **Held to formancy's released turn.**
    `packages/report-ai/src/turn/against-formancy.test.ts`, with
    `@formancy/builder-core` at exactly 0.14.0 as a devDependency of
    report-ai's suite alone. Report's types, instantiated for formancy's
    three kinds, are held equal to formancy's own -- the prompt, the ask,
    the turn, the stop, the relay, its turn and its answers, a run's
    failure, the busy error, and the signatures of the four functions
    formancy exports, `createStop`, `declinedAnswer`, `relayMessage` and
    `createRelay` -- by `expectTypeOf`, which `pnpm typecheck` checks
    through report-ai's `tsconfig.test.json`, beside a `@ts-expect-error`
    that fails it should the matcher ever take an optional member for a
    required one. `askChecked` and `readAnswer` have no exported
    counterpart, so nothing compares their types. The same scripted host -- an answer that passes
    at once or after two that fail, every attempt failing, a decline on the
    first turn and after a failure, a decline with no reason asked again,
    no object, a host that rejects with an error, a nameless error, a blank
    message, a string, a blank string, nothing, an object of another realm
    or one with no prototype, a host that throws before it returns, a
    busy error of either package or one with the name alone, a stop before
    the run, in its first turn and in its second, and one, none and five
    attempts -- is asked by Report's `askChecked` and by formancy's
    `authorForm`, the one run formancy exports, and both end alike: how,
    after how many turns, with the same reason or none, the same last
    answer and problems of the same kinds, each turn numbered alike, each
    follow-up carrying the problem just before it in both, and the same
    turns told of the stop. Every text of a list of answers,
    as an answer, ends both runs alike, the same document where it holds
    formancy's working form; and every paste handed to both relays answers
    the same, `'no-object'` exactly where Report's `readAnswer` finds no
    object, which is how Report's reader meets formancy's, which formancy
    does not export. formancy's run asks Report's relay under Report's
    stop, and Report's run formancy's under formancy's, each answered and
    each stopped. A stop's and a relay's members, `ModelBusyError`,
    `declinedAnswer`, its refusal of a blank reason and `relayMessage` are
    formancy's byte for byte. And the formancy compared with is the
    release report-ai and report-spec take `@formancy/spec` at, so a bump
    that left this suite's behind fails it. Seen failing on 27 November
    2026, each fault
    planted and put back: `followUp` typed `string | undefined` fails the
    typecheck on every type the prompt reaches; `relayMessage` joined by
    one line break fails three cases, two of them here; `declinedAnswer`
    trimming its reason fails the text case; `build(problems[0])` in place
    of the latest fails three, two of them here; this suite's
    `@formancy/builder-core` at 0.13.0 beside `@formancy/spec` at 0.14.0
    fails the release case; and a pair the matcher takes leaves the
    `@ts-expect-error` unused, which fails the typecheck (TS2578).
  - **The turn.** `turn/ask.test.ts`: a run ends one of six ways and only
    an answer that passed is a success; `build` is handed the latest
    problem alone, of answers that failed in two ways; a `build` or a
    `check` that throws rejects the run, where a host's error ends it; a
    stop before a turn asks nothing, one during a turn
    ends it at once whether or not the host listens, a host registering
    after the stop is told at once, a stop in the second turn counts both,
    and an answer after the stop is never held; a host that throws before
    it returns a promise ends the run `unreachable`, its reason read by
    shape and absent where it has none; a busy error, by its name, ends it
    `busy` with no reason; a decline ends it on its turn and one with no
    reason is asked again. `turn/relay.test.ts`: the turn waiting is the
    prompt the run asked, one turn at a time, a paste with no object kept
    waiting unless sent anyway, a stop clearing the turn, and a cancel told
    late leaving the next. Seen failing, each planted and put back: the
    stop's race removed (eight cases, three of them the differential's), a
    latest problem replaced by the list (thirty), a reason taken with
    `String()` (eleven), the relay queueing a second turn (two, one the
    differential's), the first problem handed on in place of the latest
    (three, two the differential's), and a `check` that throws read as an
    unreachable model (one).
  - **Ready to move.** `turn/generic.test.ts` fails on any file under
    `src/turn/`, at any depth, that imports anything but `@formancy/spec`
    and the folder's own modules, a relative import resolved from where its
    file stands -- a `@formancy/report-*` package, or report-ai's
    `kinds.ts`, through which alone a kind typed as Report's list could
    come in; a test may import vitest, Node and formancy's builder-core
    besides. Seen failing with `relay.ts` importing report-core's
    `ReportSession`, and with a file a level down, `deep/held.ts`,
    importing it.
  - **The decline is formancy's.** `turn/ask.test.ts` reads a decline
    built from `@formancy/spec`'s `DECLINE_KEY`;
    `scripts/upstream-deps.test.mjs` holds both upstream packages at an
    exact version.
  - **Nothing is asked yet.** `apps/pages/src/limits.test.ts` holds the
    start page's "No changes proposed by an AI" to report-ai's built
    `REQUEST_KINDS` being empty and to no published package but report-ai
    taking `@formancy/report-ai`, in place of the check that no published
    package's name held `report-ai`, which this package's arrival failed;
    seen failing with a kind written into the built list, and with
    report-builder-core's manifest declaring `@formancy/report-ai`.

## Context

Report's first AI feature -- a report's missing words proposed by a
model, reviewed and applied in one undo step -- needs what formancy's
builders already have: ask a model, read a JSON object out of what it
wrote, ask again with the latest complaint, let a person stop the run, let
a model decline, and let a person carry the turn by hand where no model may
be called
(formancy.ai [0056](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0056-agents-get-the-checks.md),
[0157](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0157-a-models-turn-can-be-stopped.md),
[0158](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0158-a-model-may-decline.md),
[0160](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0160-a-person-carries-the-models-turn.md)).
The rule here is to depend on it, never copy it (0002).

It cannot be depended on. Read at formancy's v0.14.0, which Report pins
since 27 November 2026, and unchanged on formancy.ai's main that day:

- `MODEL_REQUEST_KINDS` (`packages/builder-core/src/model-requests.ts`) is
  a closed list of formancy's three requests, and `AuthoringPrompt.kind`
  must be one of them, so every prompt formancy's loop asks claims one;
- `askChecked` and `readAnswer` (`answers.ts`) are not exported from
  `@formancy/builder-core`, whose `exports` map has `.` alone, so a
  product cannot run the loop at all;
- `completeBuilderRequest` (`packages/server-core/src/model.ts`) refuses
  every kind but formancy's as `unknown_kind`, by design
  (formancy.ai [0165](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0165-a-deployments-model-is-asked-through-its-server.md)),
  and `@formancy/server-core` would bring `@formancy/builder-core`,
  `@formancy/core`, `@formancy/challenge` and `recheck` into Report's
  server for three types.

Opening them is a change to formancy.ai: the turn moved into a package of
its own, generic over a product's kinds, and a server's use case taking a
table of briefings registered at start. That needs the owner's yes to a
public pull request, a review, a merge and a formancy release.
formancy.ai [0163](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0163-a-models-run-belongs-to-the-host.md)
declined to guess a generic run holder from one run, and extracted one
only when three used it (formancy.ai 0164): a turn opened to other products
before a second product has used it would be guessed the same way.

## Decision

**Report holds the turn in `@formancy/report-ai`'s `src/turn/` until
formancy releases one that other products may brief, in formancy's shapes
and names, and held to formancy's released behaviour by a test.**

- `turn/ask.ts` holds `askChecked`, `createStop`, `readAnswer`,
  `declinedAnswer` and `ModelBusyError`, with `AskModel`, `AskTurn`,
  `AskOptions`, `Stop`, `Verdict`, `Asked`, `Reading`, `Checkable` and
  `ModelPrompt`, formancy's `AuthoringPrompt` under the name its
  generalisation would take; `turn/relay.ts` holds `createRelay` and
  `relayMessage`, with `Relay`, `RelayTurn` and `RelayAnswer`. They behave
  as formancy's do. The prompt, the ask and the relay are generic over the
  kind, `K extends string`, which defaults to `string`, so an `AskModel`
  written for any kind serves every request; `askChecked` takes it last,
  `askChecked<T, P, K>`, so a call written as formancy's `askChecked<T, P>`
  means the same here. `src/kinds.ts`'s `REQUEST_KINDS`, empty in this
  change, is Report's list, and nothing under `turn/` reads it.
- Not taken: `authorForm` and its form checks, which are formancy's own
  request; `relayLeaves`, `RelayChat` and the catalogue, which say what a
  builder shows and are the builders' to write when a builder draws a
  turn; and the run holders (formancy.ai 0163, 0164), since where Report's
  run is held is decided with the first request a builder draws.
- A callback, not an `AbortSignal`, tells a host a turn was stopped:
  report-ai has ES2023's library and no `@types/node` or DOM, as formancy's
  builder-core has
  ([formancy.ai 0008](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0008-layered-packages.md)),
  so a `fetch` or a `node:` import in it does not compile.
- A decline is read with `DECLINE_KEY` from `@formancy/spec`, which
  report-spec already pins, so its shape is formancy's to the byte;
  `@formancy/spec` 0.14.0 is report-ai's one dependency.
- Nothing under `src/turn/` imports a Report package, or a module of
  report-ai outside the folder, so the folder can be deleted for an import
  the day formancy releases its own.
- `turn/against-formancy.test.ts` runs both on the same types, scripted
  turns and pastes, against `@formancy/builder-core` at exactly 0.14.0,
  and fails when they disagree.
- The change formancy would make is drafted outside this repository, and
  opened on formancy.ai only with the owner's yes. When formancy releases
  it, a pull request here deletes `src/turn/`, depends on that release at
  an exact version, and marks this record superseded.

What stays Report's whatever formancy does: the kinds, their briefings,
the readers of their answers, and what the builders show of a run.

## Consequences

**What it buys.** That feature starts on formancy 0.14.0, not on a
formancy release. Report's use of the turn is to be the second product's,
the evidence formancy.ai 0163 and 0164 waited for before cutting a generic
version from one. The decline, the stop, the relay and their order are formancy's,
so a person who used one product's builder recognises the other's. With
`REQUEST_KINDS` empty, nothing published asks a model for anything yet,
and the start page still says so.

**What it costs.** **A copy, which 0002 forbids**, narrowed here to one
folder and for as long as formancy has no turn to depend on. It is
formancy's code itself, not a pattern written again from its records: the
loop, the race against the stop, the reading of an error by its shape, the
reader and the relay are formancy 0.14.0's `answers.ts` and `relay.ts`
nearly line for line, made generic over the kind, with the comments that
spoke of forms reworded, most of the two files comments.

formancy.ai publishes this code under Apache-2.0. Its rightsholder is
Report's, and authored every commit to `answers.ts` and `relay.ts` up to
v0.14.0, and to `authoring.ts`, from which `answers.ts` was split in
formancy.ai #222, read with `git log --follow` on 27 November 2026. So he
publishes it here under Report's licence himself, not as a licensee of
Apache-2.0, and none of its section 4's conditions apply; Report's
`NOTICE` says so of `src/turn/`. formancy's copy keeps Apache-2.0, and
anyone may still take it from there on those terms. A change to
formancy's turn that someone else authored is carried here only under
formancy's CLA, whose section 2 grants the project the right to
sublicense it
([formancy.ai 0069](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0069-contributions-under-a-cla.md)),
and is otherwise not carried: nothing here checks what Apache-2.0 would
ask of a copy made under its terms instead.

The differential holds what formancy exports and what `authorForm` shows
of its loop, not every internal path of `askChecked`: where an answer
holds an object that is not formancy's working form, it sees only that
both found an object, never which, so a reader that took another object
of the same text passes it; and the prompt's words differ by
construction, so only a turn's number, its limit and whether it carried a
follow-up are compared. Each improvement formancy makes to its turn reaches
Report only when someone reads formancy's changelog and makes it here, or
when the test fails after a bump; a fix made here first has to be offered
upstream by hand. `@formancy/builder-core` 0.14.0 enters the lockfile as a
devDependency, with `@formancy/core` 0.14.0, and has to move with every
formancy bump, or the test compares with a release nobody runs. And the
types are held by `pnpm typecheck` alone: vitest runs `expectTypeOf` as
nothing, so a shape that drifts fails `verify` and passes report-ai's
`test` job.

**What it forecloses.** Nothing in `src/turn/` may use a Report type; a
shortcut through report-core there fails `generic.test.ts`.

## Alternatives considered

**formancy.ai first, then an exact dependency.** The right end state, and
drafted. Lost as the first step because nothing of that feature could start
before the owner opens it publicly and formancy releases it, and because
the API would be guessed from one product.

**Depend on `@formancy/builder-core` 0.14.0 for what it exports.**
`createStop`, `declinedAnswer`, `ModelBusyError` and `createRelay` are
exported; `askChecked` and `readAnswer`, the half that matters, are not,
and `createRelay`'s turn types its prompt with formancy's closed kinds.
Half formancy's and half Report's is the worst of both, and it would bring
formancy's whole form builder model into Report's editor for four
functions. It is a devDependency of one suite instead, the one that
compares the two.

**Claim formancy's `translation` kind for Report's translation.** It would
type-check, and lie: formancy's relay would say what a form's translation
carries, a server of formancy's would brief it as a form's, and changes
described in words and a diagnostic explained have no formancy kind to
claim.

**Write Report's own turn with no tie to formancy's.** The same code with
nothing to say when the two disagree, and nothing to make moving it
upstream the deletion it is meant to be.
