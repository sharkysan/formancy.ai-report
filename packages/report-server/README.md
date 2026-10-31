# @formancy/report-server

Formancy Report's server: a Fastify server that verifies the host's token
offline, takes the person's tenant from a required claim, and says what the
actions table allows them. In this release it answers `GET /health`;
`GET /v1/whoami`, which says who the server takes the token's holder to be
-- subject, tenant and roles -- and which actions the operator's role
settings give them, so a wrong issuer, audience, tenant claim or role
mapping shows before any template depends on it; and a template's draft:
the tenant's templates listed (`GET /v1/templates`), a template's newest
draft read and saved (`GET` and `PUT /v1/templates/{template}/draft`), and
the images a draft declares kept and read by their digest (`PUT` and
`GET /v1/assets/{digest}`), in files on one volume. Publication, render
jobs and artifacts arrive with the releases that build them, each a route
of its own under `/v1`. What it decides, and why, is decision
[0046](../../docs/decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md),
and for the drafts and images, decision [0049](../../docs/decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md);
`@formancy/report-client` is what a host asks it with.

**Identity is the host's.** The host signs a short-lived JWT for a person;
the server verifies it with Formancy Data's own verifier,
`@formancy/data-identity` at exactly 0.3.0
([0047](../../docs/decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)),
under Data's rules: the algorithm pinned by the key's kind, `sub` and `exp`
required, a key set selected by `kid` and read again on SIGHUP, nothing
fetched (formancy.ai-data 0014, 0059). Report adds the tenant: the claim
`FORMANCY_REPORT_ATTRIBUTES` names is required on every token, and a token
without it is refused like any bad token. A single-tenant host puts one
constant in that claim. A tenant, a role or a permission a browser sends is
never read.

**Every bad token is the same 401**, `unauthenticated`: a wrong signature,
issuer or audience, an expired token, one with no `exp` or no `sub`, `alg:
none`, HS256 signed with a public key's text, and a token without its
tenant. Which check failed is in the log, by the verifier's reason, never
the token.

**Nothing else answers.** Every other method and path is the one 404,
`not-found`, whose body quotes nothing of the request; it is answered
before any body is read, counted by the rate limit, and its connection
closed. `HEAD /health` is answered as GET, without a body, for a monitor
that probes with HEAD; HEAD is answered nowhere else. A path with anything
a proxy in front could normalise before it forwards -- an escape, a dot or
an empty segment, a trailing slash, `/` alone -- is the one 400,
`path-not-plain`, before any route's work (formancy.ai-data 0037's rule;
`src/paths.ts`). A request Node's parser cannot read -- a malformed header,
a header block past 16 KiB, headers sent too slowly -- is the fixed
`bad-request` refusal with the parser's status and `no-store`; the one
answer outside the refusals is Fastify's 503 to a request that arrives
while the server closes. A request that takes longer than 300 s to arrive,
Node's own default, which Fastify turns off, is cut.

**A save names the draft it replaces.** `If-None-Match: *` creates a
template, and `If-Match: "<revision>-<64 hex>"`, the `ETag` a read or a
save answered, the draft's revision and the digest of its stored report,
replaces that draft; a save with neither is 428 `precondition-required`,
one with anything else -- a weak tag, a list, the bare revision, both
headers -- 400 `bad-request`, and one from a draft that is no longer the
newest, by its revision or by its digest, where a restore let another save
take its number, 412 `draft-changed`, with nothing written, the revision
that stands in its body and no `ETag`. Who may, what a draft and an image
must be, and the status of every answer are report-server-core's use
cases', and the routes send what those answer. A draft's body is JSON of
at most report-spec's `MAX_REPORT_BYTES`, an image's a PNG, a JPEG or an
SVG as `cleanSvg` wrote it, under its own media type, of at most
`MAX_ASSET_BYTES`; a body past its route's limit is 413,
`report-too-large` or `image-too-large`, refused by the length it declares
before it is read, or once it is read past the limit where it declares
none, and one of a media type the route does not read is 415
`unsupported-media-type`, unread. No body is read before the request's
origin and its token are: the cross-origin refusal and the one 401 come
first, and a refusal answered before a body closes the connection that
carried it.

## Run it

The image is built from the repository root, as the container gate builds
it; it is not published by this release:

```sh
docker build -f packages/report-server/Dockerfile -t formancy/report-server .
docker run --rm -p 4392:4392 \
  -e FORMANCY_REPORT_ISSUER=https://login.example \
  -e FORMANCY_REPORT_AUDIENCE=formancy-report \
  -e FORMANCY_REPORT_IDENTITY_SECRET=file:/run/secrets/host \
  -e FORMANCY_REPORT_ATTRIBUTES=tenant=tid \
  -e FORMANCY_REPORT_AUTHOR_ROLES=report-authors \
  -v formancy-report-store:/var/lib/formancy-report \
  -v "$PWD/host-secret:/run/secrets/host:ro" \
  formancy/report-server
```

It runs as `node`, on Node 26 at an exact digest, carries `LICENSE.md` and
`NOTICE` in `/app`, and owns `/var/lib/formancy-report`, the directory it
sets `FORMANCY_REPORT_STORE_DIR` to and keeps the template store in, and
nothing else: its code in `/app` is root's, so a process made to write
cannot rewrite it. The volume above is what keeps the store when the
container is removed; run without one, the drafts go with the container.
It runs with `docker run --read-only` as well, which an operator may add,
the store's directory then a volume they mount, since a read-only root file
system leaves it nowhere to write; the container gate runs it both ways.
Unconfigured, it does not start: it prints one line for each setting it
needs, and exits 1.

`node dist/main.mjs` is the image's command. The packages' floor is Node
22.13, and the server is made and asked on the Node CI runs in the install
gate's `server` host, but `main.mjs` itself has been run only on the image's
Node 26.

## Settings

Read once, by `src/main.ts`, the composition root, and nothing else in the
package reads configuration. A variable set to the empty string is unset,
which is what Compose hands a container for one it was not given. Any other
variable whose name begins `FORMANCY_REPORT_` stops the server, naming it,
so a misspelt setting is found at start rather than read as nothing; so a
secret's own variable, which a reference names, is one outside that prefix,
such as `HOST_SECRET`, and a reference to one of the server's own variables
stops it too. No sentence the server prints about a setting repeats its
value.

| Setting | What it is for |
|---|---|
| `FORMANCY_REPORT_ISSUER` | Required: the issuer the host's tokens name in `iss` |
| `FORMANCY_REPORT_AUDIENCE` | Required: the audience the host's tokens name in `aud` |
| `FORMANCY_REPORT_IDENTITY_SECRET` | A secret reference, `env:NAME` or `file:/absolute/path`, to a shared secret of at least 32 bytes, HS256; `NAME` outside `FORMANCY_REPORT_` |
| `FORMANCY_REPORT_IDENTITY_PUBLIC_KEY_FILE` | Or the path of a PEM public key, with `FORMANCY_REPORT_IDENTITY_ALGORITHM` RS256, ES256 or EdDSA |
| `FORMANCY_REPORT_IDENTITY_KEYS_FILE` | Or the absolute path of a JSON Web Key Set, with `FORMANCY_REPORT_IDENTITY_ALGORITHM` RS256, ES256, EdDSA or HS256 for every key; read again on SIGHUP |
| `FORMANCY_REPORT_IDENTITY_ALGORITHM` | The algorithm a public key file or a key set verifies, pinned; never set beside a secret |
| `FORMANCY_REPORT_ATTRIBUTES` | Required: `tenant=<claim>`, once, the claim every token names its tenant in (`tid` for Entra ID). No other attribute is read, and one named is refused: Report's rule, not Data's |
| `FORMANCY_REPORT_ROLES_CLAIM` | The claim holding a token's roles, a list of strings. Unset, `roles`, data-identity's default. Report's own; Data's server has no such setting |
| `FORMANCY_REPORT_AUTHOR_ROLES` | The host's roles that author, comma-separated. Unset, none |
| `FORMANCY_REPORT_PUBLISHER_ROLES` | The roles that publish. Unset, none |
| `FORMANCY_REPORT_ADMIN_ROLES` | The roles that administer. Unset, none |
| `FORMANCY_REPORT_RATE_LIMIT` | Requests a minute per client address, on every route but `/health`. Unset, 600: Formancy Data's default, a choice and not a measurement |
| `FORMANCY_REPORT_TRUSTED_PROXIES` | The proxies whose `X-Forwarded-For` names the client address: IP addresses and CIDR ranges, comma-separated, never `*`, `true`, a hop count (formancy.ai-data 0071), or entries that together trust every IPv4 or every IPv6 peer as Fastify matches one: an IPv4 peer, written plain or IPv4-mapped, against the IPv4 entries and the ranges inside `::ffff:0:0/96`, so `::ffff:0:0/96` trusts every IPv4 peer and `::/1` none; any other IPv6 peer against the other IPv6 ranges. Unset, none |
| `FORMANCY_REPORT_CORS_ORIGINS` | The origins whose pages may call the API, each exactly as a browser sends `Origin`: never a wildcard, a pattern or `null`, and plain HTTP only on loopback (formancy.ai-data 0060). Unset, none |
| `FORMANCY_REPORT_AUDIT_KEY` | A secret reference to the key the audit trail names who asked by: at least 32 bytes, and not the identity key -- the secret, the public key's text, or a key of the set -- as the server compares them at start. Unset, nobody is named |
| `FORMANCY_REPORT_STORE_DIR` | Required: the absolute path of the directory the server keeps its templates' drafts and images in; the image sets `/var/lib/formancy-report`. The directory must exist and be one the process can write: the server does not make it, and stops at start, naming this setting, where it is not one |
| `PORT` | The port it listens on. Unset, 4392: beside formancy's 4380 and Data's 4390, a choice and not a measurement |

**Who may do what** is the actions table in `@formancy/report-server-core`:
three capacities, author, publisher and administrator, and each action with
the capacities that may take it. The three role settings say which of the
host's roles hold each capacity. No capacity implies another, an action the
table does not hold is denied to everybody, and nobody holds anything until
a setting names a role.

**The audit trail** is one line in the server's log for each request a
route of the API answered -- what was asked, its status and its outcome
code -- written from the answer, whichever way it ended. It never holds a
value: no token, no claim, nothing of the path or the body. Who asked is
named by the first 32 hex characters of HMAC-SHA-256 under
`FORMANCY_REPORT_AUDIT_KEY` over a JSON array, as `JSON.stringify` writes
it -- the tenant over `["tenant","<tenant>"]`, the person over
`["actor","<tenant>","<subject>"]` -- which `auditReference` computes, so
whoever holds the key can ask whether an event is a given person's, and no
two people share a reference whatever a host signed into their claims. It
is an operational trail, not evidence (formancy.ai-data 0023's limits).

## Embed the server

```ts
import { createReportServer, createReportVerifier, openFileTemplateStore } from '@formancy/report-server'
const verifyIdentity = await createReportVerifier({
  key: { kind: 'secret', secret: hostSecret },
  issuer: 'https://login.example',
  audience: 'formancy-report',
  tenantClaim: 'tid',
})
const opened = await openFileTemplateStore(storeDirectory)
if (!opened.ok) throw new Error(opened.problem)
const server = await createReportServer({
  verifyIdentity,
  roles: { author: ['report-authors'], publisher: ['report-publishers'], admin: ['report-admins'] },
  audit,
  store: opened.store,
})
await server.listen({ host: '127.0.0.1', port: 0 })
```

The install gate runs these lines from the packed packages, in a Node host
that holds the server and what it declares and nothing else, and they are
held to it (`scripts/readme-example.test.mjs`). `createReportVerifier` takes
data-identity's key options -- one secret, one public key, or a key set
whose `keys()` is asked on every token -- with `tenantClaim`, and refuses at
construction a key that would accept forgeries. `store` is the file store
`openFileTemplateStore(root)` opens on an absolute directory that exists and
that the process can write: it answers `{ ok: true, store }`, or `{ ok: false,
problem }` with one sentence about the root, which names no setting, since an
embedder set none, and never the path; a `store` that lacks a method of the
port does not start the server. A store's file that is not what it wrote
is thrown as `StoredRecordError`, and a failure of the file system under it
as `StoreFileSystemError`, by Node's code, the operation and the path
inside the tenant's directory, never Node's own error, whose message names
the absolute path and with it the tenant's directory, the unkeyed hash of
its claim; the server logs either by those and the tenant's keyed
reference, and answers `internal`. `audit` is `{ sink, key? }`:
the server's own sink writes the log line above, and an embedder may pass
its own; a sink that throws never fails a request; a `key` under 32 bytes
does not start the server. `origins`,
`trustedProxies` and `rateLimit` are held to the settings' rules, and a list
that would be refused as a setting does not start the server. `logger` is
`{ stream }`, whose `write` takes each JSON line, or absent for no log;
anything else, Fastify's own `false` among them, does not start the server
either, since it would turn the log on.

## What it does not do

- **Manage identities.** No sessions, no passwords, no keys of its own. It
  verifies somebody else's tokens, offline, and never fetches a key set or a
  key a token names.
- **Run more than one instance as one service.** Its template store is
  files on one volume (formancy.ai-data 0013's shape), a save decided by a
  hard link that a second instance on a network file system could be told
  wrongly, and its rate limit is in its memory; the record says so.
- **Publish, render or keep anything but a draft.** A template's draft and
  the images it declares are all it stores; no version, job or artifact
  route exists in this release, and nothing deletes a draft or an image.
- **Keep a font.** A draft that declares one is refused `asset-not-kept`,
  naming it, since a draft kept here could not print in the face it names.
- **Prune a revision.** Every revision a save writes stays on disk, with
  `savedBy`, the subject of the token that saved it, a claim's value kept
  at rest beside the tenant's documents and in every backup of the volume;
  the record's digest covers the report and not `savedBy`.
- **Flush a directory.** A revision's file is flushed before it is linked,
  but its directory is not after, as in Formancy Data's store, so an
  acknowledged save can lose its name on power loss; and a volume that
  cannot make a hard link starts and answers every save `internal`.
- **Compare a draft's digest inside the swap.** A replace's version is
  compared with the newest draft just before the store's swap, which is by
  revision alone, so a draft's newest file removed by hand while the
  server runs can let a racing save win over a draft its author never saw:
  restore the volume with the server stopped, and never remove a draft's
  newest file while it runs. After such a restore, or a power cut, a page
  still holding a draft that went is refused by its digest, unless the
  draft given its number since holds the same report to the byte, whose
  save goes through.
- **Stop a client that leaves from having asked.** A request whose client
  left while the route ran is still one event in the trail.

**Licence.** Source-available, not open source: see
[`LICENSE.md`](../../LICENSE.md). It depends on Formancy Data's
`@formancy/data-identity`, which is under the Formancy Data Source-Available
Licence on the same terms, so running the server in production needs a
production licence for both (0047).
