# @formancy/report-client

Formancy Report's client for its server: what a host's page, or its own
server, calls to keep a template's draft and the images it declares on
[`@formancy/report-server`](../report-server/README.md). It lists the
tenant's templates, reads a template's draft, saves one from the revision
it was opened at, and keeps and reads an image by its digest, through the
routes report-server-core's `ROUTES` names, by their own keys, so a route
renamed there does not compile here. No framework and no Node: the DOM's
globals and no `@types/node`, so a `node:` import does not compile, and the
install gate bundles what it exports for a browser. The server it talks to
is decision
[0046](../../docs/decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md)'s;
the draft it keeps there, decision 0049's.

## Save and reopen a draft

```ts
import { createReportClient } from '@formancy/report-client'
import { emptyReport } from '@formancy/report-spec'
const reports = createReportClient({ server: at, token: () => token })
const saved = await reports.saveDraft('invoice', emptyReport('invoice', 'Invoice', 'en'), null)
if (!saved.ok) throw new Error(`the first save was refused: ${saved.refusal.code}`)
const opened = await reports.readDraft('invoice')
if (!opened.ok) throw new Error(`the draft could not be read: ${opened.refusal.code}`)
const mine = await reports.saveDraft('invoice', emptyReport('invoice', 'Mine', 'en'), opened.value.revision)
```

The install gate runs these lines from the packed packages, against the
packed server in a host that holds the two and what they declare, and they
are held to it (`scripts/readme-example.test.mjs`). `at` is the server's
base URL and `token` the host's current token. Where another author saved
between the read and `mine`, `mine` is refused `draft-changed`, nothing is
written, and `mine.refusal.revision` is the revision that stands.

- **`createReportClient({ server, token, fetch? })`** -- `server` is the
  base URL, `http:` or `https:`, with no credentials, query, fragment or
  trailing slash, since a route's path follows it as written; any other is
  refused when the client is made, by a sentence that never quotes it.
  `token` is asked before every request, a string or a promise of one, and
  sent as a bearer, so a token the host renews is the one the next request
  carries. `fetch` is the host's, or the global one, and is called as a
  function, as a browser's own fetch must be.
- **`listTemplates()`** and **`readDraft(template)`** -- the tenant's
  templates by id, and a template's newest draft with its revision.
- **`saveDraft(template, report, from)`** -- from `null`, a template not
  yet saved, sent with `If-None-Match: *`; from a revision, the draft that
  revision is, sent with `If-Match` naming it. The revision is read from the
  answer's body; the `ETag` beside it is not needed.
- **`keepImage(bytes, digest, mediaType)`** and **`readImage(digest)`** --
  `digest` as a report names an asset's, `sha256:` and the hexadecimal
  digits of its bytes; the path carries the digits. A digest in any other
  form is thrown before any request. `readImage` answers the bytes and the
  media type they were kept as.

Each answers an **`Answered<T>`**: `{ ok: true, value }`, the route's
answer as report-server-core's wire types say -- `TemplateList`, `Draft`,
`DraftSaved`, `ImageKept`, `StoredImage`, re-exported here with
`TemplateSummary` and `ServerRefusal` -- or `{ ok: false, status, refusal }`,
a `ServerRefusal`: a code `REFUSALS` holds, its fixed sentence, and the
field one of the four carries. Narrowing on `code` gives the field.

## What it throws

A refusal the API gives is answered, never thrown: a stale save, an
expired token, a report the format refuses and an image not kept are each
the host's to show. Thrown:

- **An answer that is not the API's** -- a status outside 2xx whose body is
  no refusal `REFUSALS` holds as its own (a gateway's page, an inherited
  name such as `toString`, one of the four without its field), a 2xx whose
  body is no JSON object, an image under a media type no image asset is, or
  under none. The `Error` names the route by its pattern --
  `GET /v1/templates/:template/draft` -- and the status, never the id or
  the digest the request carried.
- **A network error**, as fetch gave it, a redirect among them: the client
  follows none, so nothing it sends reaches an address but the server's.

## What it does not do

- **Judge a draft or an image.** The server does, through
  report-server-core's use cases; the client sends what the host gives it.
  A template id is escaped into one segment of the path, so no id reaches
  another route, and is not checked here.
- **Check a value's shape.** A 2xx's JSON object is taken for the wire type
  its route answers; the server is what holds it to that.
- **Keep anything.** Every call is a request, and the server answers each
  `no-store`. The images a preview resolves from are the host's to keep.
- **Read configuration, or reach the network** but through the `fetch` it
  is given, at the `server` it is given.

**Licence.** Source-available, not open source: see
[`LICENSE.md`](../../LICENSE.md).
