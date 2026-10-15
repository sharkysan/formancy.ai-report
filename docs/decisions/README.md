# Architecture decision records

Every decision here was actually made, in the order the numbers suggest, while
building Formancy Report. Where a decision was reversed or narrowed later, the
record says so and points at the one that superseded it. Where a decision rests
on one made in formancy.ai or in Formancy Data, the record cites it as
`formancy.ai NNNN` or `formancy.ai-data NNNN` with a link, and does not restate
it.

## Why these exist

Two audiences:

1. **Contributors**, who need to know why the obvious simpler thing was not
   done, so they do not helpfully undo it.
2. **Customers and evaluators**, deciding whether to build on this module, who
   want the reasoning and not just the result — especially about the licence
   and about what the module refuses to do with their data and their documents.

## Format

The format is formancy.ai-data's:
[MADR](https://adr.github.io/madr/)-shaped, trimmed to what is load-bearing.

```markdown
# NNNN — Title in the imperative

- **Status:** accepted | superseded by NNNN | reversed
- **Date:** YYYY-MM-DD
- **Deciders:** who
- **Verified by:** the tests, gates or files that hold this decision in place

## Context

The forces. What was true when the decision was made.

## Decision

What was decided, in one or two sentences.

## Consequences

What this buys, what it costs, and what it forecloses. The cost paragraph is
not optional: a record with no downside is marketing, not a decision.

## Alternatives considered

Each with the reason it lost.
```

**Verified by** is the field that distinguishes a decision record from an
opinion. If a decision is load-bearing, something in the repository fails when
it is violated — a test, a CI gate, a script the workflow runs. A record whose
only enforcement is "we remember" says so plainly.

## Index

| # | Decision | Status |
|---|---|---|
| [0001](0001-a-paid-module-in-its-own-repository.md) | A paid module lives in its own repository, under Formancy Data's terms, in force before a lawyer has read them | accepted |
| [0002](0002-depend-on-upstream-never-copy-it.md) | Depend on released upstream packages at exact versions; never copy them | accepted |
| [0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md) | A rendered report is proved on the PDF it produced, read back with PDF.js; never on the engine's input, never through a mocked engine | accepted |
| [0004](0004-three-version-lines-each-refused-when-unknown.md) | Three version lines -- formancy's form spec, Report's format, Formancy Data's contract -- each refused when unknown; package versions alone establish nothing | accepted |
| [0005](0005-pdfmake-renders-reports-behind-one-adapter.md) | pdfmake renders version 1's reports, behind one adapter that refuses rather than truncates; pdfme lost on the corpus, and HTML engines and Prince were not trialled | accepted |
| [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md) | Every production dependency and every font a published package ships is under a permissive licence; GPL, AGPL, non-commercial and unlicensed are refused | accepted |
| [0007](0007-a-report-definition-is-its-own-versioned-document.md) | A report definition is its own versioned document, with a flowing body, one detail table, declared aggregates and print styles as tokens | accepted |
| [0008](0008-edits-are-commands-and-a-refused-edit-changes-nothing.md) | Edits are commands, and a refused edit changes nothing | accepted |
| [0009](0009-an-expression-is-checked-and-bound-member-by-member.md) | An expression is checked and bound member by member, by one compilation the editor and the runtime share | accepted |
| [0012](0012-the-builders-are-native-and-share-one-session.md) | The builders are native, share one session through one editor model, and are held to each other by shared scenarios | accepted |
