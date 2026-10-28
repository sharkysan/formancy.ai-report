# @formancy/report-server-core

Formancy Report's server core: who may do what to a tenant's reports, as one
actions table over the host's verified identity, the audit port a server
writes its trail through, and the wire types a client compiles against. No
framework and no Node: ES2023's library and no `@types/node`, so a `node:`
import or a `fetch` does not compile. `@formancy/report-server` is the
server over it; the use cases and the stores' ports join it with the
releases that build them. What it decides, and why, is decision
[0046](../../docs/decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md).

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
  everybody, an inherited name such as `toString` among them. The routes
  that take these actions arrive with the releases that build them;
  rendering and downloading are a template's own policy's to grant, and join
  with it.
- **`can(identity, action, policy)`**, **`capacitiesOf`** and
  **`actionsOf`** -- the one question a route that takes an action is to
  ask, and the lists whoami answers, which agree with `can` action by
  action (`src/actions.test.ts`). No route takes an action in this
  release; whoami takes none and lists them. A role is compared as the
  host spells it.

`ReportIdentity` is who is asking, as the server derived it from a verified
token: a subject, a tenant that is never empty, and roles. Nothing a request
carries but that token contributes to it.

## The wire

- **`API_PREFIX`** -- `/v1`, the API's version line (0046, extending
  [0004](../../docs/decisions/0004-three-version-lines-each-refused-when-unknown.md)).
- **`ROUTES`** -- every route the API answers, `METHOD path`, with the name
  its audit event gives it: today `GET /v1/whoami`, `whoami`.
- **`WhoAmI`**, **`Health`** -- what those answer.
- **`DRAFT_FORMAT`** -- the stored draft's format number, `1`, which a
  reader compares and refuses another of.
- **`TemplateSummary`**, **`TemplateList`**, **`Draft`**, **`DraftSaved`**,
  **`ImageKept`** -- what the draft slice's routes will answer: a template
  by its report's own id, its revision and its title; a draft with the
  report, the revision and the subject that saved it; the revision a save
  wrote; the digest an image is kept under. The routes arrive with the
  release that builds them, and `ROUTES` lists them then.
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
  send: the token's header, `authorization`.

## The audit port

`AuditEvent` is one request an API route answered: when, which route, its
status, its outcome code, whether it carried a verified identity, and the
tenant and the actor by keyed hash, or `null`. Never a value. `AuditSink`
is where it goes; the server's own writes a log line.

## What it does not do

- **Verify a token.** The server does, with Formancy Data's verifier; this
  package holds only what it derives.
- **Read anything.** No store, no file, no network, no setting.
- **Depend on anything but the format.** `@formancy/report-spec` is its one
  dependency, today for the two types `Draft` and `ServerRefusal` name,
  `ReportDefinition` and `ReportError`, which it imports as types alone.
  The use cases that validate what a server stores join it with the release
  that builds them.

**Licence.** Source-available, not open source: see
[`LICENSE.md`](../../LICENSE.md).
