# @formancy/report-spec

The Formancy Report definition format: its name, its version, and the refusal
of a document that is not one this package reads. No framework, no PDF engine,
no Node.

```ts
import { checkSpecVersion, REPORT_SPEC_VERSION } from '@formancy/report-spec'

const outcome = checkSpecVersion(JSON.parse(text))
if (!outcome.ok) throw new Error(outcome.message) // 'not-a-report' or 'unsupported-version'
```

`REPORT_SPEC_VERSION` is `0`, the draft: nothing written under it is promised
to be read by a later release. The model itself -- pages, sections, tables,
bindings -- is not here yet.

Source-available, not open source: see [`LICENSE.md`](../../LICENSE.md).
