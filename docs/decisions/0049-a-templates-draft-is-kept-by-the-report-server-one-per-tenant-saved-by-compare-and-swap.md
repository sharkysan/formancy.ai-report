# 0049 — A template's draft is kept by the report server, one per template of a tenant, saved by compare-and-swap: a save names the revision it replaces in `If-Match`, or `If-None-Match: *` for the first, and one from a revision no longer the newest is refused 412 `draft-changed` with nothing written; every revision a numbered file written to a temporary name, flushed and hard-linked, as Formancy Data's versions, under a directory named by the SHA-256 of the tenant claim; the template's id the report's own `id`; a draft checked by report-spec on the way in and served as it was saved, by a digest of its text; `savedBy` the token's subject; images the tenant's, kept by digest once report-spec has read them, and a draft that declares a font refused; `@formancy/report-client` over the host's fetch; the cross-origin grant widened to the headers the routes read; per-person drafts, a 409, the revision in the body, `reportHash` as the record's digest, images per template, the tenant's directory by the audit key's HMAC, a store-wide index and builders drawing Save lost

- **Status:** accepted; extends [0046](0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md), whose server it gives its first records and five routes, [0033](0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md), whose `ImageStore` a host may now wire to the server, and [0004](0004-three-version-lines-each-refused-when-unknown.md), whose fourth line, through 0046, now has its first record
- **Date:** 2026-10-28
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The use cases.** `packages/report-server-core/src/drafts.test.ts`
    and `images.test.ts`, against a store in memory that records every
    call made on the port: the list sorted by id whatever order the store
    gives; a draft read with its revision, `savedBy` and report, 404
    `no-draft` without one; a save created 201 at revision 1 and replaced
    200 at the next, `savedBy` the token's subject and the report stored a
    copy of what the validator returned, never the object handed in; a
    second create and a stale replace 412 `draft-changed` naming the
    revision that stands, `null` where none does, nothing written; no
    precondition, or a revision that is no positive safe integer, 428
    before the body is looked at; a report report-spec refuses 422 with
    its errors; a report whose `id` is not the path's 422
    `template-id-mismatch`; an image the asking tenant has not kept, and
    any font whatever the store holds under its digest, 422
    `asset-not-kept`, the ids sorted; who may and may not, each refusal
    for want of a capacity made before the store is asked; another
    tenant's drafts and images neither read nor taken as kept; a path's
    digest refused exactly where `isDigest` refuses it with `sha256:`
    before it; and a keep judged in the order the code states, a PNG, a JPEG and a cleaned SVG
    kept, everything else refused by its code. Twenty-five single-point
    mutations of `drafts.ts` and `images.ts` were each killed; two
    survived the first run -- the tenant hard-coded on `hasImage` and on
    `readImage` -- because the cases used that same tenant, and were
    killed once they used another. The path's digest held to `isDigest`
    was watched failing with a pattern of the use cases' own that admitted
    capitals ("expected [ false, false ] to deeply equal [ true, true ]").
  - **The store.** `packages/report-server/src/file-store.test.ts`,
    against a real directory made for each case, since what it proves is
    the file system's: saves 1, 2 and 3 read back as saved; a save from 1
    after 2 not written, saying 2 stands; of twenty concurrent saves from
    1, exactly one wins and no temporary file remains; eleven saves read
    as revision 11, not as text; a template directory holding only a
    crash's temporary file neither listed nor read; a record edited by
    hand, of format 2, of format `'1'`, without `savedBy`, or not JSON,
    thrown as `StoredRecordError` naming its file and its path inside the
    tenant's directory; `Acme`, `acme` and `é` in NFC and in NFD four
    tenants that cannot see each other; a tenant claim with no UTF-8 form,
    a template id that is not report-spec's identifier, a digest that is
    not a SHA-256 refused before any file operation, a digest refused
    exactly where report-spec's `isDigest` refuses it, and a revision past
    the safe integers neither read nor written; an image kept twice, or by several at once, one file
    read back as its bytes and media type, and never kept or served under
    a digest that is not its bytes; a directory the store cannot read or
    write thrown as `StoreFileSystemError` by Node's code, the operation
    and the path inside the tenant, never read as empty; and a root that
    is a file, relative, missing or not writable refused naming no
    setting, and one gone after it opened failing every call and not made
    again. Watched failing, one mutation at a time, with the tenant named
    by `encodeURIComponent` of its claim ("expected { saved: false,
    revision: 1 } to deeply equal { saved: true, revision: 1 }": `acme`
    merged into `Acme` on the APFS volume the case ran on), with `rename`
    for `link` (the twenty concurrent saves), with the record's digest or
    format unchecked (the hand-edited record), with the newest revision
    compared as text (the eleven saves), with every directory a read
    could not open read as empty, and with a digest pattern of the store's
    own that admitted capitals ("expected 'read' to be 'refused'").
  - **The routes.** `packages/report-server/src/drafts.test.ts`, through
    `inject` with tokens the host signs and the verifier a deployment
    runs, on the file store, and over a socket where only a socket shows
    it: a draft created 201, replaced 200, read and listed, each answer's
    `ETag` its revision; JSON alone, with a charset or none, any other
    type 415 and nothing written; a body one byte past `MAX_REPORT_BYTES`
    413 `report-too-large` and one at it read; a malformed precondition 400
    `bad-request` and nothing written; an image kept, read back and
    declared by a draft that then saves; each use case's refusal reaching
    the client with its status, code and field; every route without a
    token the one 401; an unauthenticated keep that declares 20,000,000
    bytes and sends none answered 401 at once and its connection closed,
    and a cross-site save from an unlisted origin 403 likewise; a keep
    declaring more than `MAX_ASSET_BYTES` 413 `image-too-large` at once; a
    chunked save refused once it is read past the limit; an upload the
    client abandons halfway leaving nothing in the store; no log line or
    audit event of an ordinary request, answered or refused, holding a
    subject, a title, a template id or a digest; and a record the store
    did not write, or the file system failing it, logged by why or by code
    and operation, its path inside the tenant -- the only lines that name a
    template's id or a digest, which the operator needs to find the file --
    and the tenant by keyed hash, and answered 500. `parsePrecondition`'s own
    cases hold what is a create, a replace, none and malformed. Watched
    failing with the identity hook back in `preHandler` (the 20,000,000
    bytes: no answer within a second), with the 401, the 403 or the 415
    leaving its connection open, with the draft's route on Fastify's own
    mebibyte (the chunked save), with the `text/plain` parser kept, with no
    `ETag` on a refusal, and with Node's error rethrown by the store (the
    log case). `packages/report-server/src/cors.test.ts` holds the
    preflight granting a save's and a keep's headers, refusing any other,
    and `ETag` exposed to a listed origin and to nobody else;
    `packages/report-server-core/src/wire.test.ts` the five routes, each
    audited by the name of the action it takes, the refusals, `DRAFT_FORMAT`,
    `isRevision`, the two header lists exactly, and a fielded refusal
    narrowed by its code, which `pnpm typecheck` proves. `app.test.ts`
    holds a `store` that lacks a method of the port refused before
    anything is built.
  - **The limit.** `packages/report-corpus/src/report-size.test.ts`: every
    report the corpus holds within `MAX_REPORT_BYTES`, and the limit at
    least sixteen times the largest. Watched failing with the limit at
    200,000 ("expected 200000 to be greater than or equal to 260064") and
    at 16,000 ("expected 16254 to be less than or equal to 16000", for the
    XRechnung sample, and for the next).
  - **The settings and the composition.** `settings.test.ts`:
    `FORMANCY_REPORT_STORE_DIR` required, empty read as unset, a relative
    path refused, no sentence repeating the value. `serve.test.ts`: a root
    that does not open refused in the store's sentence beginning with the
    setting's name, taken from `SETTINGS`' key. `composition.test.ts`:
    `file-store.ts` alone reaches the file system, and through
    `node:fs/promises` and nothing else; watched failing with `node:fs`
    added (`[ 'node:fs', 'node:fs/promises' ]`) and with `process.env`
    (`[ 'node:fs/promises', 'process' ]`). `dockerfile.test.ts`: report-spec
    copied into the image, derived from the manifests, and
    `FORMANCY_REPORT_STORE_DIR` set to the directory the image gives
    `node`.
  - **The client.** `packages/report-client/src/client.test.ts`, against
    report-server itself on a directory of its own: a draft created, read
    back and replaced from the revision read; a save from a revision no
    longer the newest answered `draft-changed` with the revision that
    stands, nothing written; an image kept and read back by the digest a
    report names it by; an expired token answered `unauthenticated` and
    the host asked again before the next request; a template id one
    segment of the path; no redirect followed and nothing reaching the
    address one names. Against what is not report-server: an answer that
    is not the API's thrown, naming the route by its pattern and the
    status and nothing the request carried; a fielded code without its
    field thrown; an image under no image's media type thrown; a network
    error let through; and a token no bearer header carries, a save from
    what is no revision and a digest that does not begin with `sha256:`
    thrown before anything is sent. Watched failing with `redirect:
    'follow'`, with `in` for `Object.hasOwn` on the refusal's code, with
    the field unchecked, with the id unescaped, with fetch called as a
    method of the options, and with the token asked once.
  - **The image, run.** The container gate's three checks,
    `scripts/container.mjs` as gates.yml's `container` job: "a draft an
    author saves is read back after the container restarts on the same
    volume", a named volume, the first container stopped before the
    second starts, the report read back deep-equal at revision 1; "an
    image an author keeps is read back by its digest", a PNG of the
    repository's compared byte for byte; and "on a read-only root, it
    saves a draft into its store", the store's directory a volume.
    `scripts/container.test.mjs` fails when the gate stops planning them,
    watched failing before they were added ("1 failed | 2 passed"), and
    the release report fails a run whose gate did not make a check it
    plans (0046). **They had not run on Docker when this record was
    written**: Docker did not answer on the machine the slice was built
    on, so their request helpers were driven against the built server
    under Node, across a restart on one store directory, and CI's
    container job is their first run in a container.
  - **From outside.** The install gate's `server` host saves a draft
    through the packed client, reads it back at the revision it was saved
    at with `savedBy` the token's subject, and has a save from that
    revision refused `draft-changed` once another has saved, the trail
    holding one event for each of the client's requests
    (`scripts/install-fixture/server.ts`); its `client` host type-checks
    the packed client against the DOM's types alone, refuses
    `@types/node` there, and bundles what it exports for a browser
    (`client.ts`). The getting-started guide's section 6 is compiled and
    bundled with the React page (0015). `scripts/readme-example.test.mjs`
    holds the two READMEs' examples to the fixture that runs them.
  - **Not mechanically enforced:** that the guide's draft host behaves as
    its prose says, which the gate type-checks and bundles and never
    renders; a `link` that fails other than by the name existing, which no
    case reaches, being the file store's one uncovered line; that a store
    an embedder writes keeps an absolute path out of its own errors, which
    the server logs as any other error of its own; that the permission
    cases mean what they say, which needs a user that is not root, as the
    machine they were written on and GitHub's hosted runners give them; and
    that the hard link decides a race on the
    operator's volume, which the suite proves on whatever volume its
    temporary directory is on.

## Context

The server answered `/health` and whoami and nothing else
([0046](0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md)).
Its actions table already named what a tenant's people do to a template --
list the templates, read and save a draft, keep and read an image -- with
no route taking any of it; 0046 said that the client arrives with the
draft's route, that the store that arrives next is files on one volume, as
Formancy Data's (SV-Q1), that every record carries a `format` a reader
refuses when unknown, and that Fastify's mebibyte stands until the draft's
route sets a limit from report-spec's. Gate G5 was open for all of it.

What the slice is for: an author, working in a host application's admin in
either builder, opens a template, edits it, saves it, and the next person
to open it gets what was saved. Publication, versions, policies and render
jobs, the releases after this one, all start from a draft the server holds.
Two authors saving one template at once must never silently lose each
other's work.

Three things stood fixed. A report already carries an `id` under
report-spec's identifier rule, lower-case letters, digits and hyphens,
starting with a letter, at most 64 characters, which the builders do not
edit, and a `title`, which they do. report-builder-core's `ImageStore`
hands a host an image's bytes under the SHA-256 of exactly those bytes, an
SVG's as `cleanSvg` wrote them (0033). And report-runtime's
`AssetResolver` is synchronous, so a preview cannot ask a server for an
image while it prints.

The choices below were agreed with the user on 28 October 2026 where the
record says so, and are otherwise the builder's, each open to correction.

## Decision

**One draft per template of a tenant** (agreed). Every author of the tenant edits
the same draft; there is no draft per person. A template comes into being
with its first save, and nothing deletes a draft, a template or an image:
`draft.delete` is not in the actions table, and `actions.test.ts` holds it
denied. Saving is explicit, one request per Save, and nothing saves by
itself.

**Five routes, each an action.** Under `/v1`, each in `ROUTES` with the
name of the action it takes as its audit name:

| Route | Action | Answers |
|---|---|---|
| `GET /v1/templates` | `template.list` (author, publisher, admin) | `{ templates }`, each `{ template, revision, title }`, sorted by id, the title read from each template's newest draft |
| `GET /v1/templates/{template}/draft` | `draft.read` (author, publisher) | `{ format, template, revision, savedBy, report }`, `ETag: "<revision>"` |
| `PUT /v1/templates/{template}/draft` | `draft.save` (author) | `{ template, revision }`, 201 for the first and 200 after, with its `ETag` |
| `PUT /v1/assets/{digest}` | `asset.keep` (author) | `{ digest }`, the same for a second keep of the same bytes |
| `GET /v1/assets/{digest}` | `asset.read` (author, publisher) | The bytes, under the media type they were kept as |

`{digest}` is the 64 lower-case hexadecimal digits of a SHA-256, without
the `sha256:` a report writes before them. Each route is an adapter over a
use case of report-server-core's of the same name, which decides who may,
what a draft and an image must be, and the status of every answer; the
route parses its request into the use case's arguments and sends what it
answers. Every use case asks `can` first, before it reads the request or
asks the store, so that a refusal for want of a capacity says nothing of
whether a template or an image exists. Three answers are the adapter's and
come before the use case, so before `can`: a malformed precondition, 400; a
body past the route's limit, 413; a body of a media type the route does not
read, 415. A publisher's malformed save is therefore answered 400 rather
than 403, and an identified person without the capacity has a body read up
to the route's limit before the use case refuses them, 20 MiB for a keep:
the route parses the headers and the body before it asks the use case, and
deferring either until `can` had answered would move HTTP's parsing into
report-server-core, which has no HTTP.

**The template's id is the report's own `id`.** The path's `{template}` is
report-spec's identifier, else 400 `template-id-invalid`, and a save whose
report names another `id` is 422 `template-id-mismatch`. One id, decided in
one place, and already lower case, so a volume that folds case cannot merge
two templates. A host that copies a report to a new template gives the copy
a new `id`.

**A save names the revision it replaces.** By RFC 9110's preconditions:
`If-None-Match: *` creates the template; `If-Match` holding exactly one
strong entity tag of a revision, `"3"`, replaces that revision; neither is
428 `precondition-required`. Anything else -- a weak tag, a list, a
revision without its quotes, revision 0 or one past the safe integers,
`If-Match: *`, both headers at once -- is 400 `bad-request`, since read as
some revision or none it would save over what its author never named. A
save from a revision that is no longer the newest, or a create of a
template that exists, is 412 `draft-changed`, nothing written, with the
revision that stands in the refusal and in its `ETag`, or `null` and no
`ETag` where the template has none. A revision is report-server-core's
`isRevision`, a positive safe integer, the first save 1 and each save the
next; the route that parses the header and the use case that judges what it
parsed ask the same function.

**The swap is a hard link, as Formancy Data's versions.** A draft is a
directory of numbered files, `1.json`, `2.json` and on, and its revision is
the newest number. A save from revision *n* writes *n + 1* to a temporary
name in that directory, flushes the file to disk and links it to its final
name; the link fails when the name exists, atomically, so of any number of
saves from *n* exactly one wins, and the others are told the revision that
stands (formancy.ai-data 0013). A final name appears only once its bytes
are on disk, and a crash leaves a temporary file no read takes for a draft,
since the store reads only the names it writes. Every revision stays on
disk; a read serves the newest. Pruning the older ones is a retention
decision for a later record.

**What a save checks, in order.** The route: the body is JSON, else 415; it
is at most report-spec's `MAX_REPORT_BYTES`, refused by the length it
declares before a byte is read, or once it is read past the limit where it
declares none, 413 `report-too-large`; the preconditions it names are
`If-None-Match: *` alone or one strong `If-Match` of a revision, else 400
`bad-request`. Then the use case: the capacity, 403
`forbidden`; the template id, 400; a precondition, 428; `validateReport`,
422 `report-invalid` carrying report-spec's own errors; the report's `id`,
422 `template-id-mismatch`; every image it declares kept for the tenant
under its digest, and no font declared, 422 `asset-not-kept` naming the
assets by id, sorted; and last the swap. Expression diagnostics do not
block a save: a draft may be unfinished. What is stored is the report the
validator returned, which shares no object with the body.

**`MAX_REPORT_BYTES`, report-spec's.** 262,144 bytes, the UTF-8 length of
the report's JSON, which a client sends and a server can count before it
parses anything: the least power of two at least sixteen times the largest
report the corpus holds, the XRechnung sample's 16,254 bytes, measured on
28 October 2026 on an Apple M2 under Node 22.23.3, and a quarter of the
mebibyte Fastify reads by default. The factor is chosen; the format's
bounds allow far larger reports, which validate and preview and are not
kept as drafts. `report-size.test.ts` holds every report there to the
limit, and the limit to the factor. This is what 0046's bodies waited for.

**A draft is served as it was saved.** A record is
`{ "format": 1, "digest": …, "savedBy": …, "report": … }`, where `digest`
is the SHA-256 of the report's JSON text exactly as the store wrote it
there. A read checks the record's `format`, that it parses, and that
digest, and does not validate the report again: a later report-spec that
would refuse an old draft, or a report version a later release migrates,
is the migration's to meet where a draft is opened or published, never a
template stuck behind a read that refuses it (0004, 0007). A record that
fails a check is not served: the store throws `StoredRecordError`, and the
server answers `internal` and logs it. A record of another `format` is
refused naming the number, as 0004 names a version it does not read.
`DRAFT_FORMAT` is 1, and a draft record whose shape changes takes the next
number.

**Where the store keeps it.**

```
<FORMANCY_REPORT_STORE_DIR>/
  tenants/<SHA-256 of the tenant claim's UTF-8>/
    templates/<template>/draft/<revision>.json
    assets/<64 hex>.<png|jpg|svg>
```

The tenant's directory is the SHA-256 of its claim: any claim a host signs
becomes a safe, lower-case name of one length, and two claims that differ
only by case or by Unicode normalisation stay two tenants. The store
checks a template id and a digest again before any file operation, so that
no caller can make it name a path outside a tenant's directory, refuses a
tenant claim that has no UTF-8 form, and lists only names a template id
can be. It checks them by the rules the use cases judge by, report-spec's
`isIdentifier` and `isDigest`, which a report's declarations are validated
by too, so that nothing a save or a keep lets through is a name the store
throws on, which would be answered 500 rather than refused.

**No error names the root.** A path under the root holds the tenant's
directory, the unkeyed hash of its claim, which whoever reads a log
reverses for a tenant they can guess. `StoredRecordError` carries the
absolute path, for an embedder that reads the store itself, and the path
inside the tenant's directory -- `templates/<id>/draft/<n>.json` or
`assets/<hex>.<ext>` -- which is what the server's log names, beside why
the record was refused and the tenant by its keyed audit reference (0046).
A failure of the file system inside the store -- a permission taken away, a
volume full -- is `StoreFileSystemError`, by Node's code, the operation and
the path inside the tenant's directory, and Node's own error, whose message
names the absolute path, is never handed on. The guarantee is the file
store's: a store an embedder writes for itself answers for its own errors,
which the server logs as any error of its own.

**The store is opened by whoever knows where its root came from.**
`FORMANCY_REPORT_STORE_DIR` is a required setting with no default: the
absolute path of a directory that exists and the process can write, which
the server opens before it is made and never makes, so outside the image a
directory that does not exist stops it at start with one sentence. The
image sets it to `/var/lib/formancy-report`, a directory the image makes
and gives `node`: without a volume there the server starts, and the drafts
live in the container and go with it; only under `--read-only`, where the
directory cannot be written, does a missing volume stop it.
`openFileTemplateStore(root)`, which an embedder calls, says what is wrong
with a root in a sentence that names no setting, since an embedder set
none, and `serve.ts` begins that sentence with the setting's name, taken
from `SETTINGS`. `createReportServer` takes the store it is handed and
refuses one that lacks a method of the port, `TemplateStore`, which
report-server-core declares so that a database can be a second store
later.

**`savedBy`, the token's subject** (the user's decision). The audit trail
cannot say who saved a draft: an event names the route, the outcome and a
keyed hash of the tenant and the person, never the template or the
revision (0046). So each revision's record carries the verified token's
`sub`, and a read answers it, so that the release that publishes can hold
a rule such as formancy.ai-data 0065's -- a publisher who did not author a
draft approves it -- over every draft this release stored, and a host can
show who saved last. It never reaches a log line, an audit event or a
refusal.

**The images are the tenant's, kept by digest.** Not a template's: a
digest names the same bytes wherever they are declared, a report copied to
a new template keeps reading them, and `ImageStore` is given no template.
A keep checks, in order: the capacity; the digest, by `isDigest` with
`sha256:` put before the path's digits, 400 `digest-invalid`;
the size against `MAX_ASSET_BYTES`, 413 `image-too-large`; `sniffImage`,
422 `image-refused` with the reason `not-an-image`; the request's media
type, its essence trimmed and in any case, being the kind the bytes sniff
as, 415; a PNG or a JPEG read by `imageHeader`, an SVG within
`MAX_SVG_BYTES`, 413, and accepted by `checkSvg`, which takes only the form
`cleanSvg` writes, 422 `image-refused` with report-spec's code as the
reason; and `assetDigest` of the bytes being the path's, 422
`digest-mismatch`. Then the store keeps it by temporary file and link, as a
draft, and a second keep of the same digest finds it there and answers as
the first. A read answers the bytes, checked against their digest as they
are read, under the kind they were kept as. This is what 0033's `ImageStore`
can be wired to.

**A draft that declares a font is refused.** A font is a host-approved
asset too (0043), but `asset.keep` keeps an image a builder adds, and no
store here keeps a font. A draft that names one could be saved and never
printed in the face it names, so `asset-not-kept` names it, whatever the
store holds under its digest. Keeping fonts is a later record's.

**No body is read before the identity.** The cross-origin refusal and the
token's verification move from the API's `preHandler` to `preParsing`, so
nobody unidentified has a byte of a body read; both still run after the
rate limit's count. A refusal answered before the body -- the 401, the
cross-origin 403, a preflight that carries one, a 415 -- closes the
connection of a request that carries a body, so that Node does not read the
rest to keep the connection open.

**Across origins, the headers the routes read.** 0046 let a listed origin
send `authorization` alone, which was every header its one route read. A
`PUT` with a JSON or an image body and a precondition is not a simple
request, so `CROSS_ORIGIN_REQUEST_HEADERS` becomes exactly `authorization`,
`content-type`, `if-match` and `if-none-match`, each path's preflight grants
the methods that path answers, and `CROSS_ORIGIN_RESPONSE_HEADERS`, `etag`,
is exposed to a listed origin, so that a page can read the revision its
next save names. 0046's rule -- grant what the routes read and nothing
more -- is extended, not reversed.

**What a refusal carries.** These codes join `REFUSALS`, each a fixed
sentence that quotes nothing of the request: `forbidden`, `no-draft`,
`no-asset`, `template-id-invalid`, `template-id-mismatch`,
`digest-invalid`, `precondition-required`, `draft-changed`,
`report-too-large`, `image-too-large`, `unsupported-media-type`,
`report-invalid`, `asset-not-kept`, `image-refused` and `digest-mismatch`.
Four carry a field beside the sentence, to the requester alone and never
to a log, an audit event or another answer: `report-invalid` the
`ReportError`s of the report sent, `draft-changed` the revision that stands,
`asset-not-kept` the asset ids, and `image-refused` report-spec's reason.
`ServerRefusal` types them so that narrowing on `code` gives the field and
a refusal of the four without it does not compile.

**`@formancy/report-client`**, which 0046 said arrives with the draft's
route. `createReportClient({ server, token, fetch? })`: the server's base
URL, a function the host answers the current token with, asked before
every request, and the host's fetch or the global one. `listTemplates`,
`readDraft`, `saveDraft(template, report, from)`, `keepImage(bytes, digest,
mediaType)` and `readImage(digest)`, asking the routes by `ROUTES`' own
keys, each answering `{ ok: true, value }` or `{ ok: false, status, refusal
}`, a refusal the API gives answered and never thrown. Thrown: an answer
that is not the API's, naming the route by its pattern and the status and
nothing the request carried; and, before anything is sent, what the host
gave that no request could carry as it means it -- a token that is empty or
no RFC 6750 bearer token, a save from what is no revision, a digest that
does not begin with `sha256:`, whose digits the server judges; and a
network error, as fetch gave it. It
follows no redirect, sending `redirect: 'error'`. It has the DOM's globals
and no `@types/node`, and depends on report-server-core, for the routes and
the wire types, and on report-spec, whose `ReportDefinition` and
`AssetMediaType` its signatures name and whose media types it holds an
image's answer to; never on the server, a builder or the runtime. It
exports `createReportClient`, `ReportClientOptions`, `ReportClient` and
`Answered`, and no wire type: a host names `Draft` or `ServerRefusal` from
report-server-core, where each is defined, since a re-export added later
breaks nobody and one removed after a release breaks every host that used
it.

**The host draws Save and the conflict, not the builders** (the user's
decision). The getting-started guide's section 6 shows a React host's Save,
which waits for the server and offers nothing while a save is in flight;
its message when someone saved since; and its reload, which opens the
newest draft in a new session and never replaces the document of the old
one, whose undo would bring the stale text back and let a save from the
new revision overwrite the other author's work. The preview's images are
the host's cache: the page reads every image a draft declares when it opens
it, and puts an image a person adds in the cache before `keep` resolves,
which is when the builder declares it (0033). A Save in both builders, with
its scenarios, words and parity, is a later step.

**The image.** It sets `FORMANCY_REPORT_STORE_DIR` to the directory it has
always given `node`, and copies report-spec, which report-server-core now
depends on, into its build. Without a volume there, the drafts live in the
container and go with it; on a read-only root file system the directory
must be a volume for the server to start.

## Consequences

**What it buys.**
- **No save lost unseen.** Two authors saving from one revision cannot both
  succeed, by the file system's own atomic operation rather than a lock the
  server keeps, and the one who lost is told the revision to read.
- **A draft every later release can start from.** Each stored draft is one
  report-spec accepted when it was saved, whose every image the tenant
  keeps and which names no font, by a subject the host signed; a
  publication can be held to who saved what.
- **A draft that outlives its format's next version.** It is served as it
  was saved, so a stricter report-spec, or a migration, meets it where it
  is opened and does not lock it away.
- **One decision for each question.** Who may, what a draft and an image
  must be, and every status are report-server-core's use cases', so the
  routes, a second store or a second server cannot disagree about them.
- **A client a host compiles against.** A route renamed, or a refusal's
  field changed, fails the host's build rather than its users.

**What it costs.**
- **Every revision is kept.** Nothing prunes a draft's older revisions, so
  a template's directory grows by one file per save, for good, and a
  tenant's store with it; nothing measured how fast. Explicit saves keep
  the count to what authors press.
- **`savedBy` is a claim's value at rest.** Each revision keeps the token's
  subject beside the tenant's documents, often an email address or an
  identity provider's object id, which the operator's backup of the volume
  holds too. It reaches no log, audit event or refusal, and a host that
  must not have it at rest signs a pseudonymous subject.
- **The record's digest covers the report, not `savedBy`.** A record whose
  `savedBy` was edited by hand is served as edited; one whose report was
  edited is refused. The store is held against a torn or tampered report,
  not against whoever can write the volume.
- **A tenant's directory is an unkeyed hash of its claim.** Whoever can
  list the volume finds which directory is a tenant they can guess, one
  SHA-256 away; the log names a tenant by its keyed reference alone, and
  a key in the name would move every tenant when it rotated.
- **A draft that declares a font is refused**, so a report mapped to a
  host's fonts (0043) cannot be kept on the server until fonts are.
- **Every host writes the image cache.** The runtime's resolver is
  synchronous, so a host fetches every image a draft declares before its
  preview prints, and keeps each one a person adds; the guide carries the
  code, and the client has no helper, which would make it depend on
  report-runtime's types. A host whose drafts declare many images fetches
  them one request each when a draft opens.
- **An acknowledged save can lose its name on power loss.** The file is
  flushed before it is linked, but its directory is not flushed after the
  link or a new directory is made, as Formancy Data's store does not; a
  power cut after a 201 can leave the revision unnamed on a file system
  that does not order those writes.
- **A volume without hard links starts and saves nothing.** The store does
  not probe the link when it opens, so a server on such a volume answers
  every save `internal` until the volume is changed.
- **One instance, on a volume the operator chose.** The link is atomic on
  a local file system; over NFS a client can be told the wrong outcome
  after a retransmission, and nothing here ran the store on one. Two
  instances are not a supported deployment (0046).
- **The list reads every template's newest draft.** No index: listing a
  tenant's templates opens one file per template, in time linear in them,
  unmeasured, and a record that is not what the store wrote fails the
  whole list `internal` rather than leaving one template out.
- **A body before the capacity.** A malformed precondition, a body past its
  limit and a media type the route does not read are answered before
  `can`, so a publisher's malformed save is 400 rather than 403, and a
  person who may not keep an image still has up to 20 MiB of one read
  before the 403; an unidentified one has nothing read.
- **Nothing deletes.** A draft, a template and an image stay until the
  operator removes their files by hand, and no route takes back a
  template made by mistake.
- **A new required setting.** An installation that runs the server outside
  the image, or overrides its environment, stops at start until
  `FORMANCY_REPORT_STORE_DIR` names a directory that exists and is
  writable; under `docker run --read-only` the directory must be a volume.
- **A larger closure, and report-spec in the server.** report-server-core
  depends on report-spec, where 0046 and 0047 said it depended on nothing,
  so the image ships report-spec and what it brings: the server's
  production closure was 56 packages that are no repository's own, walked
  by `scripts/dependency-licences.mjs`'s closure on 28 October 2026, 54
  without what report-spec brings: `@formancy/spec` 0.7.0 under Apache-2.0
  and `@noble/hashes` 2.4.0 under MIT, the ajv it brings being Fastify's
  already. A report-spec release is now a server release, and the image's size was not measured again: Docker did
  not answer on the machine this record was written on.
- **The client's refusals of its own.** An empty token, or one a bearer
  header cannot carry, is thrown before anything is sent, so a host that
  counted on the server's 401 to send a signed-out person to sign in maps
  the throw instead. "Follows no redirect" holds for a fetch that honours
  `redirect`, as browsers' and Node's do, and refuses a redirect from
  `http:` to `https:` on the same host too, so `server` names the address
  the server answers at.
- **A served SVG is sent as itself.** It carries no
  `X-Content-Type-Options: nosniff` and no sandboxing content policy, a
  defence in depth not taken: the route needs the token, and `checkSvg`
  admits drawing elements alone.
- **The guide's draft host is compiled, not run.** The install gate
  type-checks and bundles section 6 and starts no server for it, so its
  Save waiting, its conflict and its reload are held by review and by
  the client's own suite, not by a page that ran.

**What it forecloses.**
- A draft per person, merging two authors' edits, locking and autosave.
- A template named otherwise than by its report's `id`.
- A store that validates what it serves, or a read that refuses a draft
  the save accepted.
- A tenant named by anything but the verified token, in a path, a query or
  a store's layout.

## Alternatives considered

**A draft per person.** Rejected (agreed): every author of a tenant would
keep a copy, nothing would say which copy is the template, and the
conflict the shared draft makes visible would come back at publication as
two drafts to choose between. The compare-and-swap makes one shared draft
safe instead.

**A 409 for a lost swap.** Rejected: the conversation said 409, and RFC
9110 says a failed precondition is 412. The save names the revision it
expects in `If-Match`, so a different newest revision is that precondition
failing, and 428 is what a save that names none gets.

**The revision in the body.** Rejected: it would not spare a page on
another origin the preflight, which a `PUT` and a JSON body need already,
and the precondition headers are what HTTP, caches and every client
library already read. The revision is in the body of each answer as well,
so a client that cannot read `ETag` does not need it.

**`reportHash` as the record's digest.** Rejected: it validates the report
first and throws on one it refuses, so a draft that a later report-spec
would refuse could not even be checked for damage, and the read would
refuse it, which is what serving a draft as it was saved exists to avoid.
The record's digest is the SHA-256 of the text it holds, which no
validator stands between.

**Images per template.** Rejected: a digest names the same bytes wherever
a report declares them, a report copied to a new template would lose its
images, and the builder's `ImageStore` is given no template to key by.

**The tenant's directory by the audit key's HMAC.** Rejected: rotating the
key would move every tenant's directory, and a store opened without one
would have no name for any tenant. The unkeyed hash's cost is above.

**A store-wide index for the list.** Rejected until it is measured slow: a
second file to keep in step with every save, by a second write a crash can
separate from the first, for a list that reads one file per template.

**Builders drawing Save.** Rejected for this release (the user's
decision): a Save in both builders needs its scenarios, its words in three
languages and its parity across the two frameworks, and a host already
knows where its page saves and what it tells a person on a conflict. The
host draws it, and the guide shows how.
