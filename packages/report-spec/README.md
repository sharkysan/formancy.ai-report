# @formancy/report-spec

The Formancy Report definition: what a report template is, whether a document
is a valid one, and the hash that names it. No framework, no PDF engine, no
Node. Why a report is a document of its own, and what it holds, is decision
[0007](../../docs/decisions/0007-a-report-definition-is-its-own-versioned-document.md).

## Validate

```ts
import { validateReport } from '@formancy/report-spec'

const outcome = validateReport(JSON.parse(text))
if (!outcome.valid) {
  for (const error of outcome.errors) {
    // error.code is stable ('unknown-field', 'misplaced-detail-field', ...),
    // error.path a JSON Pointer, error.componentId the component it is in.
    console.warn(`${error.path}: ${error.message}`)
  }
} else {
  render(outcome.report) // a ReportDefinition, read once, sharing nothing with the input
}
```

`validateReport` takes anything and never throws. It refuses:

- a formancy form, named as one, and a report of another version;
- anything a shape does not have, and every reference to something the
  report does not declare;
- a value standing where it has none: a detail field outside the table's
  cells, a page number outside the page header and footer;
- a fixed size the page cannot hold.

It reports up to `MAX_ERRORS` errors and says when there were more. It
checks structure only: whether an expression compiles, and whether the
rendered output fits, are the runtime's and the renderer's questions.

## Hash

```ts
import { reportHash } from '@formancy/report-spec'

const hash = reportHash(outcome.report) // 64 lower-case hex digits
```

`reportHash` is `@formancy/spec`'s `schemaHash` over an envelope that names
the format, so key order never changes it and a form never shares one with a
report. It validates first, and throws a `RangeError` for a report the
validator refuses: only a valid report has a hash.

## Start, find and measure

```ts
import { componentAt, emptyReport, mmToPt, printableArea, walkComponents } from '@formancy/report-spec'

const blank = emptyReport('site-visit', 'Site visit', 'de-CH') // A4 portrait, 20 mm margins
const margin = mmToPt(15) // 42.52: lengths are points, stored to the hundredth
const { width } = printableArea(blank.page) // what the margins leave
for (const { component, path, depth } of walkComponents(blank)) console.log(depth, path, component.id)
componentAt(blank, 'title') // where a component is, by id: the path its errors use
```

`REPORT_SPEC_VERSION` is `0`, the draft: nothing written under it is promised
to be read by a later release.

Source-available, not open source: see [`LICENSE.md`](../../LICENSE.md).
