# @formancy/report-data-provider

Formancy Report's Formancy Data provider. It reads a report's data from a
[Formancy Data](https://github.com/sharkysan/formancy.ai-data) server
through `@formancy/data-client` at exactly 0.1.0, as the person whose token
the client carries. It reads the header's one record, the detail rows a
page at a time and each lookup's label, and hands over the data
`@formancy/report-runtime` renders from, or every reason it will not. No
framework and no Node. It is the one package of this repository that may
depend on Data's contracts; the report server depends on Data's identity
verifier alone, and reads no record
([0047](../../docs/decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)).
What it decides, and why, is decision
[0016](../../docs/decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md).

**Best-effort.** Data 0.1.0 has no snapshot export, so the header, each
page and each label are read at different moments. The data says so in
its `consistency`, and the render's manifest carries it. A row changed
between two pages can be printed twice or not at all, and a total can mix
moments.

**Its source.** The data names the published form each dataset was read
from, by the id the binding addressed it by -- `{ provider:
'formancy-data', forms: { header: 'quotation', detail: 'quotation-line' }
}` -- and the render's manifest carries it as `source`
([0041](../../docs/decisions/0041-a-renders-manifest-names-where-its-data-came-from-by-identifiers-alone.md)).
Data 0.1.0 publishes a form only under its own id, so a form answered
under another is refused, below. A report that reads no dataset names no
source. It names no record: a record's token spells the record's key
(formancy.ai-data 0012), and a key can be the customer's own data. Nor
which publication of a form answered, which Data 0.1.0 does not say.

## Read a report's data

```ts
import { createDataClient } from '@formancy/data-client'
import { readReportData } from '@formancy/report-data-provider'
import type { DataBinding, ProviderRead } from '@formancy/report-data-provider'
import { resolveReport } from '@formancy/report-runtime'

const client = createDataClient({ token: () => session.token(), base: dataServer })
const binding: DataBinding = { header: { form: 'quotation', record: quotationToken }, detail: { form: 'quotation-line', parent: 'header' } }
const provided: ProviderRead = await readReportData(client, quotation, binding, { cap: 5000 })
if (!provided.ok) throw new Error(provided.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
const resolution = resolveReport(quotation, provided.data, { mode: 'final', images, creationDate: '2026-10-16T08:00:00Z' })
```

The install gate runs these lines from the packed packages, against a
server that answers Data 0.1.0's routes, and they are held to it
(`scripts/readme-example.test.mjs`). Data hands over the data and nothing
else: `images` is the host's own lookup of its approved assets, as in
[the repository's README](../../README.md#render-a-report), here for the
quotation's mark, which the template names and no record holds.

**The binding** says which published form each dataset reads:

- `header` is one record, by the token Data gave for it.
- `detail` is a form's records in Data's order, or in `sort`'s.
- `parent: 'header'` narrows the detail rows to the header record's
  children, by the lookup field the person's menu names between the two
  forms. A field and a token can also be given outright.

A report field reads the form field with the same key.

**The checks before any record is read:**
- every dataset is bound, and nothing else;
- each form Data answers is published under the id the binding names,
  a formancy form id, or it is refused as `unexpected-form`;
- every field the report declares is one the form lets this person read;
- no field is an image, since Data 0.1.0 holds no approved asset;
- the detail form offers this person a list;
- the menu names the parent exactly once.

**The values** are Data's, as Data gives them (formancy.ai-data 0008):
- decimals and large integers as canonical strings;
- dates as `YYYY-MM-DD`;
- a timestamp with a zone as an instant, `…Z`. Declare it `instant`.

Whether each value fits its field is the runtime's to say, once. It
refuses a decimal with more digits than the report's scale, for example,
and nothing here rounds. Two translations are made:
- a nullable yes-or-no, which a Data form holds as the strings `"true"` and
  `"false"`, becomes a boolean;
- a lookup becomes its label, asked of Data at most 50 tokens a request.

**The cap** is the most detail rows to read, at most the runtime's
`MAX_DETAIL_ROWS`, which is the default. Past it, the data says it is
incomplete: a final render refuses it, and a preview prints it labelled.

**A refusal** from Data hands over nothing. That covers a record that is
gone, a policy that says no and a server that is down, on any page. Data's
own sentence, status and code travel in the error.

## What it does not do

- **Give anyone more than their token.** Every request carries the token
  the host's `token()` returns, and Data's policy decides what it answers.
  A report rendered in a browser is exactly as authorised as that token.
- **Read consistently.** See above. Formancy Data's snapshot export, which
  a consistent capture needs, is not built.
- **Print a label the person may not see.** Data leaves it out of its
  answer, and the provider refuses the data, naming the field and never
  the token, rather than print nothing or the token.
- **Read a float as a decimal.** A float column is a JavaScript number in a
  Data form, and the runtime takes a decimal only as a string, so it
  refuses one. A time of day, `HH:MM`, can be printed as a `string`.
- **Read a repeater's rows.** A report field reads an answer at the top of
  a record, or inside a group or a page.
- **Speak to any other Data release.** It is built against 0.1.0's routes,
  and a Data upgrade reaches it only through a release of this package
  (0002).

**Licence.** Source-available, not open source: see
[`LICENSE.md`](../../LICENSE.md). It depends on Formancy Data's
`@formancy/data-client`, which is under the Formancy Data Source-Available
Licence on the same terms. Running it in production needs a production
licence for both.
