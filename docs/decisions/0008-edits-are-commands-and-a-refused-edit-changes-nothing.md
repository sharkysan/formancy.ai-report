# 0008 — Edits are commands, and a refused edit changes nothing

- **Status:** accepted
- **Date:** 2026-10-15
- **Deciders:** Daniel Bacher
- **Verified by:** the tests of `@formancy/report-core`, run by its
  `test:coverage` job in CI:
  - `session.test.ts` holds atomicity. Each of these leaves the same document
    object, the same revision and the same history, and notifies nobody:
    - a command refused for its own reasons;
    - an edit the validator refuses;
    - a stale `expectedHash`;
    - a transaction with a refused step;
    - a transaction whose callback returns a promise;
    - a command that edits the session while it runs.

    It also holds that the session keeps its own frozen copy, that an edit
    which changes nothing commits nothing, and that a transaction is one
    step validated once.
  - `draft.test.ts` holds `tryEdit`: the verdict a transaction's commit would
    get, from the same draft, with nothing committed.
  - `session-history.test.ts` holds exact undo. Fifty edits drawn from a
    seeded generator, under three seeds -- inserts, removes, moves across
    regions, duplicates, style, page, column and parameter edits, some
    refused -- are undone and redone in full, and every step gives back the
    very snapshot it committed and an equal export. It also holds the labels
    and the history limit.
  - `session-listeners.test.ts` holds that a listener which throws or
    unsubscribes during a notification breaks neither the session nor the
    other listeners.
  - `snapshot.test.ts` holds that a snapshot is deeply frozen, and that every
    component, table column and declaration an insert, a remove, a move or a
    duplicate did not change keeps its object.
  - `commands/registry.test.ts` holds descriptors as data:
    - one descriptor per command, typed over the command names, does the same
      read back from JSON as in memory;
    - every command, given too few or too many arguments, or a value of every
      JSON type in each position, refuses or reaches the validator and never
      throws.
  - `outcome.test.ts` holds one edit per refusal code that is refused with
    it, typed over the codes, so a code without a case does not compile.
  - `locations.test.ts` holds that the valid locations are exactly the
    places where the validator accepts the component, and that a move to a
    component's own location changes nothing.
  - Each command's tests run it on a deeply frozen report, so a command
    that wrote to its input would throw there.
  - `tsc --noEmit` holds that an async transaction callback does not compile:
    an `@ts-expect-error` line in `session.test.ts` and one in
    `draft.test.ts` fail it when the type allows one.

  On 15 October 2026 each guarantee below was reverted on its own, with one
  suite run per revert. Each revert failed at least one test, and each file
  was byte-identical afterwards:
  - validating before a commit;
  - catching a listener's error;
  - skipping a listener unsubscribed mid-notification;
  - the history limit;
  - clearing redo on a new edit;
  - sharing unchanged lists;
  - refusing a transaction after a refused step;
  - refusing a callback's promise;
  - refusing an edit from inside a running command;
  - matching list items by id;
  - `null`, not `undefined`, as the removal;
  - checking a descriptor's argument count, its objects and its locations;
  - validating each candidate place in `validLocations`.

  What holds nothing yet: what validating every commit costs. No benchmark
  is committed; R04 brings the one that holds it.

## Context

The editor the plan describes (plan 8) has undo and redo in its toolbar, a
keyboard path beside every pointer gesture -- select, nudge, delete,
duplicate, edit a property -- and errors that link to the component they
are about. Several things shaped how its edits work:

- **One session under two frameworks** (plan 11.4, plan 21). One report
  session owns the document, the revision and the undo history. React reads
  it with `useSyncExternalStore` over stable snapshots, Angular with signals
  and `OnPush`. The critical integration test edits in Angular, switches to
  React, undoes and switches back, so neither framework may hold the
  document or the history itself.
- **Proposals** (plan 16). An AI proposes a bounded list of report
  operations with a base revision. They go through the same validators and
  commands as manual editing. The review shows their validation results
  before anybody applies them. Applying them is one undo step, a stale base
  is refused, and a failed operation leaves the live report unchanged. A
  proposal arrives as JSON from a model, so nothing in it was type-checked.
- **Concurrency** (plan 17). A draft has optimistic concurrency: saving an
  outdated revision is a conflict, never a last write that wins. Undo works
  within the editing session.
- **Drop targets** (plan 21). The builders share core tests for valid drop
  destinations, and every drag has a keyboard path.
- **A strict format**
  ([0007](0007-a-report-definition-is-its-own-versioned-document.md)). A
  report with one wrong property is refused whole, so an editor has to keep
  the document valid at every step; 0007 names that as this package's job,
  and plans for the core to validate on every command.
- **formancy's builder session.** `@formancy/builder-core` (formancy.ai) has
  solved this for forms, and plan 11.2 says to follow its architecture with
  report-specific implementations rather than reuse its form commands. Its
  `BuilderSession` never holds a document the validator rejects: it applies
  a command to a copy, validates, and commits. It freezes what it holds,
  keeps past and future stacks of whole snapshots, counts a revision,
  notifies synchronously, and takes a replaced document as one undoable
  step. A proposal is bound to the `schemaHash` of the document it was
  written against.

## Decision

`@formancy/report-core` changes a report only through **commands**, and a
**session** commits a command's result only when the validator accepts the
whole of it.

- **What it may import.** `@formancy/report-spec`, and
  `@formancy/expressions` 0.5.0 at that exact version (0002), for the
  expressions ([0009](0009-an-expression-is-checked-and-bound-member-by-member.md)).
  No DOM, no Node, no framework: its TypeScript library is ES2023 only, with
  no `@types/node`, so a global of either does not compile
  ([formancy.ai 0008](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0008-layered-packages.md)).
- **Commands.** A command is a pure function from a report and its
  arguments to the next report or a refusal with a stable code. It never
  writes to the report it is given. It checks only its own preconditions: the
  thing it names exists, the location it names is a location, and the kind
  it was told to expect is the kind there. An index outside its list is
  refused, never clamped. A component's patch is typed by its kind, and its
  id and kind never change in place.
- **Commands as data.** Every command is also data: a descriptor names it
  and its arguments, which is what a proposal carries.
  - A removal is `null`, never `undefined`, so a descriptor means the same
    once it has been through JSON.
  - A descriptor's arguments are checked against the command's argument
    shapes before it runs. Too few, too many, or a value of a type the
    command cannot read is refused with `invalid-arguments`. A descriptor
    never throws.
- **Commit.** The session runs the command against the current document,
  validates the result with `validateReport`, and keeps the validator's copy
  of it. That copy is deeply frozen. It shares every part that did not
  change with the snapshot before it, matching a list's items by id where
  they have one, so an insert or a move does not make what follows it look
  changed. A refused edit changes nothing:
  - not the document or its identity;
  - not the revision or the history;
  - no listener hears of it.

  An edit whose result equals the current document commits nothing.
- **History.** The past and the future are stacks of whole snapshots, each
  with a label. Undo puts back the very snapshot that was there. A new edit
  clears the future. The session keeps `DEFAULT_HISTORY_LIMIT` steps, 200
  unless told otherwise, and drops the oldest past it.
- **Transactions.** Several commands are one edit: one undo step, one
  notification, validated once at the end, so the steps in between may be
  invalid. A refused step, or an invalid end, refuses the whole.
  - A transaction runs synchronously. An async callback does not compile,
    and a promise returned anyway is refused before anything commits.
  - `tryEdit` runs the same draft against any report and gives the verdict
    without committing: what a proposal's review shows.
- **Nothing edits a session while it is working.** A command it is running,
  or a transaction's callback, that calls the session throws. Its own edit
  would otherwise be lost under the result computed before it.
- **Concurrency.** An edit, a transaction or a replaced document may carry
  the `reportHash` of the document it was made against. When that is no
  longer the session's, it is refused as stale.
- **Listeners.** Each is called synchronously after every change. One that
  throws does not stop the others. Its error is thrown, once all have run,
  from the call that made the change, which stands.
- **Where a component may go** is asked of the validator: `validLocations`
  tries each place with the command and keeps those whose result it accepts.

## Consequences

**What it buys.**
- **A session never holds an invalid report**, by construction. The
  builders, the preview and the review of a proposal all read a report the
  runtime will accept, and none of them re-implements a rule of the
  validator.
- **One path for every edit.** A key press, a drop, a property field, a
  paste and an AI proposal run the same commands through the same
  validation; a proposal and a click cannot do one thing two ways. A
  proposal's preview and its commit come from the same draft.
- **An untrusted proposal is refused, not thrown.** Whatever a model writes,
  a descriptor gives an outcome with a code a reviewer can show, so a
  proposal fails whole rather than half-applied by a caller's error
  handling.
- **Exact undo.** Undo restores the snapshot by identity, so every
  memoised view of it is valid again, in either framework.
- **Cheap rendering.** An unchanged component keeps its object across a
  commit, so a view of it redraws only when it changed -- also when an
  insert or a move shifted it within its list.
- **No lost work.** A proposal or a save computed from an older document
  is refused rather than written over what was edited since.
- **Drop targets the session accepts.** A builder that offers only
  `validLocations` never offers a drop the session then refuses, and there
  is no second copy of the placement rules to fall behind the validator.

**What it costs.**
- **Whole-document snapshots cost memory.** Each undo step holds a whole
  document. Sharing unchanged parts makes a step cost about what its edit
  changed. Two kinds of step share less:
  - a component moved into another list is a new object, with everything it
    holds;
  - a replaced document shares only what happens to be equal, so a history
    of replacements holds that many whole documents.

  The limit bounds the memory and loses the oldest steps; 200 is chosen, not
  measured.
- **Every commit validates and compares the whole report.** Its cost grows
  with the report, and a keystroke in a property field pays it. No benchmark
  is committed yet. If it proves too slow, the remedy is cheaper validation
  in `report-spec`, not skipping it here.
- **Finding drop targets validates once per place.** `validLocations` costs
  the report's size times its number of places. A builder asks it when a
  drag starts, not on every pointer move. It is not measured either.
- **Two copies per commit.** The validator's copy, then the frozen snapshot
  built from it. That is chosen over freezing the caller's objects in place,
  which would freeze what the caller still holds, and would keep an object
  whose answers could change after it was checked.
- **Some edits need a transaction.** One command cannot pass through an
  invalid state. Renaming a style that components use is a new style, the
  components changed and the old style removed, in one transaction; no
  single command renames.
- **`null` is the removal.** A host writing a patch by hand has to know that
  `undefined` changes nothing; tsc refuses it in a typed patch.
- **The argument shapes are a second description of each signature.** A
  test holds their count to each command's, not their types.
- **A listener's error surfaces from the edit.** The edit has happened when
  its caller sees the exception, so the outcome it would have returned is
  lost.
- **No merging.** Snapshots do not merge, so two people editing one draft
  conflict, and the second save is refused by its hash.

**What it forecloses.** Nothing permanently. Collaborative editing needs
operations that merge, and can derive them from two snapshots when it comes.

## Alternatives considered

**Operational transforms or patch-based history** -- each step stored as
the operations that undo it. Smaller history, and the basis of real-time
collaboration. Rejected for now:
- **A second implementation.** Every command would need its exact inverse,
  and an inverse that is slightly wrong corrupts history silently.
- **Merging.** It needs a transform for every pair of operation kinds.

Snapshots make undo exact by construction. When collaboration comes,
patches can be derived from two snapshots.

**A mutable model with observers** -- the builder edits the document in
place and the model announces what changed. No copying. Rejected:
- **Undo.** It needs every mutation recorded and reversed, by every caller.
- **Validation.** A document edited in place cannot be validated before it
  changes; an invalid edit is visible before it is caught.
- **Identity.** A changed document that is the same object defeats
  `useSyncExternalStore` and `OnPush`.

builder-core's own reason holds too: a projection that can reach in and
mutate the model is how undo stops working.

**Validating per command instead of per commit** -- each command checks
the rules its change touches, and the session trusts it. Cheaper. Rejected:
- **A second validator.** Every command would carry part of the validator's
  rules, and the two would drift.
- **Cross-references.** A style removed or a column renamed affects places
  the command does not look at, which only a whole-report check sees.

0007 makes the validator the one place a valid report is defined.
Transactions are the per-commit rule applied to several commands: they
validate once, at the end, so a multi-step edit may pass through invalid
states.

**Clamping an index into range.** Rejected. A keyboard "move down" on the
last item and a drop past the end would then do different things for the
same request, and a builder's off-by-one would go unnoticed.

**Freezing the command's result in place** instead of building a snapshot
from the validator's copy. One copy fewer per commit. Rejected: it freezes
objects the caller still holds, and what is kept would not be exactly what
was checked.

**Catching what a descriptor's command throws** and calling it a refusal.
Rejected: it would hide a command's own bug as bad arguments. The shapes are
checked before the command runs, and a command that throws on arguments of
the right shape is a defect the tests see.

**Placement rules in the core**, to offer drop targets without asking the
validator. Faster. Rejected: a second copy of the rules the validator
holds, which nothing would hold to the first.

**Matching list items by position** when sharing unchanged parts. Simpler.
Rejected: an insert at the top of the body would make every component after
it a new object, and every view of them would redraw.
