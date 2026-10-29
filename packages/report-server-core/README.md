# @formancy/report-server-core

Formancy Report's server core: who may do what to a tenant's reports, as one
actions table over the host's verified identity, the audit port a server
writes its trail through, the wire types a client compiles against, and the
use cases that decide a tenant's drafts and images over a store's port. No
framework and no Node: ES2023's library and no `@types/node`, so a `node:`
import or a `fetch` does not compile. `@formancy/report-server` is the
server over it. What it decides, and why, is decision
[0046](../../docs/decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md),
and for the drafts and images, decision [0049](../../docs/decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md).

## Who may do what

```ts
import { actionsOf, can } from '@formancy/report-server-core'
import type { ReportIdentity, RolePolicy } from '@formancy/report-server-core'

const policy: RolePolicy = { author: ['report-authors'], publisher: ['report-publishers'], admin: ['report-admins'] }
const person: ReportIdentity = { subject: 'u-1', tenant: 'acme', roles: ['report-authors'] }
can(person, 'draft.save', policy) // true
can(person, 'version.publish', policy) // false: no capacity implies another
can(person, 'draft.delete', policy) // false: an action the table does not hold is nobody's
actionsOf(person, policy) // what GET /v1/whoami answers
```

- **`CAPACITIES`** -- `author`, `publisher` and `admin`, which the operator
  gives to the host's roles.
- **`ACTIONS`** -- every action, with the capacities that may take it:
  listing templates, reading and saving a draft, keeping and reading an
  image, reading, publishing, withdrawing and restoring a version, reading
  and setting a template's policy. Frozen; an action not in it is denied to
  everybody, an inherited name such as `toString` among them. The draft
  slice's routes take listing, a draft's read and save and an image's keep
  and read; the routes that take a version's and a policy's arrive with the releases that build them, and
  rendering and downloading are a template's own policy's to grant, and
  join with it.
- **`can(identity, action, policy)`**, **`capacitiesOf`** and
  **`actionsOf`** -- the one question a route that takes an action is to
  ask, and the lists whoami answers, which agree with `can` action by
  action (`src/actions.test.ts`). The use cases below ask it; whoami
  takes no action and lists them. A role is compared as the host spells
  it.

`ReportIdentity` is who is asking, as the server derived it from a verified
token: a subject, a tenant that is never empty, and roles. Nothing a request
carries but that token contributes to it.

## The wire

- **`API_PREFIX`** -- `/v1`, the API's version line (0046, extending
  [0004](../../docs/decisions/0004-three-version-lines-each-refused-when-unknown.md)).
- **`ROUTES`** -- every route the API answers, `METHOD path`, with the name
  its audit event gives it: `GET /v1/whoami`, `whoami`, and the draft
  slice's five, each named by the action it takes: `GET /v1/templates`
  (`template.list`), `GET /v1/templates/:template/draft` (`draft.read`),
  `PUT /v1/templates/:template/draft` (`draft.save`),
  `PUT /v1/assets/:digest` (`asset.keep`) and `GET /v1/assets/:digest`
  (`asset.read`).
- **`WhoAmI`**, **`Health`** -- what those answer.
- **`DRAFT_FORMAT`** -- the stored draft's format number, `1`, which a
  reader compares and refuses another of.
- **`TemplateSummary`**, **`TemplateList`**, **`Draft`**, **`DraftSaved`**,
  **`ImageKept`** -- what the draft slice's routes answer: a template by
  its report's own id, its revision and its title; a draft with the
  report, the revision and the subject that saved it; the revision a save
  wrote; the digest an image is kept under.
- **`isRevision`** -- whether a value is a revision, a positive safe
  integer: the one test, which a route parsing `If-Match` and the use case
  judging what it parsed both ask.
- **`REFUSALS`**, **`Refusal`** -- every refusal, a stable code and a fixed
  sentence that quotes nothing of the request: `unauthenticated`,
  `not-found`, `path-not-plain`, `rate-limited`, `cross-origin-refused`,
  `bad-request`, `internal`, and the draft slice's `forbidden`, `no-draft`,
  `no-asset`, `template-id-invalid`, `template-id-mismatch`,
  `digest-invalid`, `precondition-required`, `draft-changed`,
  `report-too-large`, `image-too-large`, `unsupported-media-type`,
  `report-invalid`, `asset-not-kept`, `image-refused` and `digest-mismatch`.
- **`ServerRefusal`** -- a refusal as that slice gives it: four codes carry
  a field beside the sentence, to the requester alone and never to a log or
  an audit event -- `report-invalid` the `ReportError`s of the report sent,
  `draft-changed` the revision that stands (or `null`), `asset-not-kept`
  the ids of the assets not held, `image-refused` report-spec's reason.
  Narrowing on `code` gives the field, and a refusal of one of the four
  without it is no `ServerRefusal`.
- **`CROSS_ORIGIN_REQUEST_HEADERS`** -- what a page on a listed origin may
  send: the headers the routes read, `authorization`, `content-type`,
  `if-match` and `if-none-match`. **`CROSS_ORIGIN_RESPONSE_HEADERS`** --
  what such a page may read beyond what a browser always shows it: `etag`,
  the revision its next save names.

## The use cases

```ts
import { saveDraft } from '@formancy/report-server-core'
import type { Asking } from '@formancy/report-server-core'

const asking: Asking = { identity: person, roles: policy, store }
const saved = await saveDraft(asking, 'invoice', body, { kind: 'create' })
if (saved.ok) saved.status // 201; saved.body is { template, revision }, saved.revision the ETag's
else saved.body.code // 'forbidden', 'report-invalid', 'draft-changed', ...
```

A route parses its request into these arguments and sends the answer under
the status it carries; it decides nothing of its own. Each returns an
**`Answer`** -- `ok`, a `status` of 200 or 201, a `body`, and a `revision`
where the answer has one, for the route's `ETag` -- or a **`RefusalAnswer`**,
with the status of its refusal and a `ServerRefusal` for a body. Every one
asks `can` first, before it reads the request or asks the store, so that a
refusal for want of a capacity cannot say whether a template, an id or an
image exists.

- **`listTemplates(asking)`** -- the tenant's templates, sorted by id
  whatever order the store gives them in.
- **`readDraft(asking, template)`** -- the newest draft, `404 no-draft`
  where there is none.
- **`saveDraft(asking, template, body, precondition)`** -- checks, in
  this order: the capacity (403 `forbidden`); the id (400
  `template-id-invalid`); a **`Precondition`**, `none`, `create` or
  `replace` with a revision that is a positive safe integer (428
  `precondition-required`); `validateReport` (422 `report-invalid`, with its
  errors); the report's id being the template's (422 `template-id-mismatch`);
  every image it declares kept for the tenant as the kind it declares, and
  no font declared (422 `asset-not-kept`, with the ids, sorted -- an image
  kept as another kind is refused because the runtime would refuse it at
  print, and a font because nothing here keeps one); then the store's swap, which writes the report the
  validator returned and the token's subject as `savedBy`: 201 for a
  `create`, 200 for a `replace`, or 412 `draft-changed` with the revision that
  stands, `null` where there is none, and that revision beside the body too,
  for the `ETag`, where there is one.
- **`keepImage(asking, digestHex, contentType, bytes)`** -- checks: the
  capacity; the digest as 64 lower-case hexadecimal digits, by report-spec's
  `isDigest` with `sha256:` put before them, the rule the store names a
  file by (400 `digest-invalid`); the size against report-spec's `MAX_ASSET_BYTES` (413
  `image-too-large`); `sniffImage` (422 `image-refused`, reason
  `not-an-image`); the request's media type, before any parameter, being the
  sniffed one (415 `unsupported-media-type`); a PNG or JPEG read by
  `imageHeader`, an SVG within `MAX_SVG_BYTES` and accepted by `checkSvg`,
  which takes only the form `cleanSvg` writes (422 `image-refused`, with
  report-spec's code as the reason); the bytes' digest being the path's (422
  `digest-mismatch`). Then the store keeps it, and a second keep of the same
  image answers as the first.
- **`readImage(asking, digestHex)`** -- the image as it was kept, `404
  no-asset` where the tenant has none.

**`TemplateStore`** is the port, and decides nothing: `list`, `newest`,
`save`, `keepImage`, `readImage` and `imageKind`, each taking the tenant
first and a digest in its `sha256:` form. `imageKind` answers the kind an
image was kept as, so that the use case compares it with the kind a draft
declares, once, rather than each store. `save` takes the revision it
replaces, `null` to create, and exactly one of any concurrent saves from one
revision wins. A store has a suite of its own, the one a deployment runs --
the file store's, in `@formancy/report-server`; the use cases' suites run
against a store in memory. `StoredDraft`, `SaveOutcome` and `StoredImage`
are its records.

## The audit port

`AuditEvent` is one request an API route answered: when, which route, its
status, its outcome code, whether it carried a verified identity, and the
tenant and the actor by keyed hash, or `null`. Never a value. `AuditSink`
is where it goes; the server's own writes a log line.

## What it does not do

- **Verify a token.** The server does, with Formancy Data's verifier; this
  package holds only what it derives.
- **Read anything.** No store, no file, no network, no setting: the store
  is a port the host gives it.
- **Depend on anything but the format.** `@formancy/report-spec` is its one
  dependency: its types, and the functions the use cases judge a draft and
  an image with -- `validateReport`, `isIdentifier`, `isDigest`,
  `isFontMediaType`, `sniffImage`, `imageHeader`, `checkSvg`, `assetDigest`
  and the limits.

**Licence.** Source-available, not open source: see
[`LICENSE.md`](../../LICENSE.md).
