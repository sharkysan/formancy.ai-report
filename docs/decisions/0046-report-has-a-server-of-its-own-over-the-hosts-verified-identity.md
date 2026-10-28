# 0046 — Report has a server of its own over the host's verified identity: report-server-core holds who may do what as one actions table, the wire and the audit port, with no Node; report-server is Fastify behind a composition root, answering `/health` and `/v1/whoami` and nothing else; the host's token is verified and its tenant claim required; three capacities from the host's roles, an unknown action denied; one event per answered request, who named by keyed hash; one instance; and the API and the server's records a fourth version line; formancy's server, Data's server, a session, an optional tenant, a policy per route and the actor named plainly lost

- **Status:** accepted; numbered while 0043, 0044 and 0045 were held by branches not yet merged, and numbered before 0048 and merged after it; extends [0004](0004-three-version-lines-each-refused-when-unknown.md) with a fourth version line; its verifier admitted by [0047](0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)
- **Date:** 2026-10-22
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The actions table.** `packages/report-server-core/src/actions.test.ts`:
    the table row by row, frozen, every capacity named by an action and
    none outside the three; `can` allowing a role of a capacity that takes
    the action and denying every other, no capacity implying another;
    every unknown action denied to a person holding all three, `toString`,
    `__proto__`, `constructor` and a name with a space among them; roles
    compared exactly; a policy whose capacity is no list of roles holding
    nothing; and `actionsOf` agreeing with `can` for all eight
    combinations of capacities. Watched failing with `in` for
    `Object.hasOwn` ("TypeError: allowed.includes is not a function", on
    `toString`), and with the policy's roles read unchecked ("rolesOf(...).some
    is not a function").
  - **The wire.** `packages/report-server-core/src/wire.test.ts`: every
    route under `/v1`; every refusal's code its key and its sentence fixed,
    `path-not-plain` among them; a page across origins sending the token's
    header alone; the entry exporting the list and nothing more.
  - **The identity.** `packages/report-server/src/identity.test.ts`:
    formancy.ai-data 0014's cases through Report's wrapper -- a wrong
    signature, issuer or audience, an expired token, one with no `exp` or
    no `sub`, `alg: none`, a short secret refused when the verifier is
    made, HS256 over the text of the public key it is verified against --
    and a token without the tenant claim, with an empty one or with one
    that is a list, each refused, the reason naming the claim and never a
    value. Watched failing with the missing-tenant check removed (2 tests)
    and with the empty-tenant check removed (1).
  - **The surface.** `packages/report-server/src/app.test.ts`: `/health`
    answering without a token, and HEAD on it as GET without a body and
    uncounted; whoami answering the identity, its capacities and its
    actions under the policy given; every route `ROUTES` names answered;
    the same 401, byte for byte, for no token, three malformed headers,
    0014's refusals, a tenantless token and the key confusion, each through
    the real verifier, beside the honest token answered 200; an
    Authorization header read only as `Bearer <token>`, against a stub that
    accepts the token from anything handed it, the verifier asked nothing
    for another case, a second space or a second word; every other method
    and path, HEAD on the API included, the one 404 that echoes nothing,
    answered before its body is read -- broken JSON and a body past
    Fastify's limit counted like any other -- and its connection closed,
    over a socket, for a body sent slowly; a route's `callNotFound` the same
    404; a path that is not plain -- an escape, `/v1/%77hoami` among them,
    a dot or empty segment over a socket, `/` alone, an escape that does
    not decode -- the one 400 `path-not-plain`, counted; a preflight with a
    body refused at once and its connection closed; Node's request timeout
    set; a malformed header and a header block past Node's limit, over a
    socket, the fixed refusal with `no-store` (and Node's 408, in
    `client-errors.test.ts`); an error a request caused the fixed 400
    sentence with its status, the server's own the one 500;
    `Cache-Control: no-store` on every answer; the rate limit sparing
    `/health`; an embedder's `logger` that is no `{ stream }` with a
    `write`, Fastify's `false` among them, refused before anything is
    built; no log line holding a token, the path or query as sent,
    the Host header or a claim's value; and, over a socket, a line naming
    the peer's port beside the peer's address and none beside an address
    a trusted proxy forwarded. `paths.test.ts` holds the plain
    path's rule for targets inject cannot send. Watched failing: Fastify's
    own answer to a path that does not decode quoted it
    (`{"error":"Bad Request","code":"FST_ERR_BAD_URL","message":"'/v1/%E0%A4%A'
    is not a valid url component"…`); with the 404 uncounted, "expected [
    200, 200, 429, 404 ] to deeply equal [ 200, 200, 429, 429 ]"; with the
    404 counted in its handler's preHandler, after its body, "expected [
    400, 400, 413, 400 ] to deeply equal [ 404, 404, 404, 429 ]"; with no
    plain-path refusal, "/v1/%77hoami: expected 200 to be 400"; with
    Fastify's own client error handler, "expected 'http/1.1 400 bad
    request\r\ncontent-l…' to contain '\r\ncache-control: no-store\r\n'";
    with Fastify's HEAD routes left on, the server did not start, because
    `ROUTES` names no HEAD route; with the log off only for an undefined
    `logger`, `false` started a server ("false: expected 'started' to be
    'logger is { stream } whose write(line…'"); and, by mutation, the
    bearer parser made case-insensitive ("bearer good: expected 200 to be
    401"), the 4xx branch echoing Fastify's message, and the log's port
    taken whatever the address (`"remotePort": 61767` beside
    `198.51.100.7`).
  - **The trail.** `packages/report-server/src/audit.test.ts`: one event
    per answered request, refusals by their code; who by keyed hash, one
    subject in two tenants two actors, nobody without a key; nothing for
    `/health`, a 404 or a preflight; no token, claim, path or query in any
    event; a sink that throws or rejects failing no request; a route in the
    API's context that `ROUTES` does not name stopping the server; and, over
    a real socket, one event for a client that left while its route ran,
    one each for two pipelined requests whose connection went, and one each
    for two answered on one kept-alive connection, its close listener gone
    with the last; a path that is not plain written under the route the
    router matched, as its refusal; the reference over a JSON array, so
    that tenant `a\0b` with subject `c` and tenant `a` with subject `b\0c`
    are two actors; and, by calling the hooks in the orders Node and
    Fastify may choose, one event when the connection closes before the
    response finishes, and the event of a request still waiting when
    another on its connection finished. Watched failing with the event
    written from `onResponse` alone ("expected [] to have a length of 1"),
    without the connection's close listener ("expected [ { …(7) } ] to have
    a length of 2 but got 1"), with values ended by a NUL ("expected 7 to
    be 8"), and, by mutation, without the guard that finds an event written
    and with the listener removed while another request waited.
  - **The settings.** `packages/report-server/src/settings.test.ts`: an
    unconfigured server refused with a sentence naming each setting it
    needs; the identity key's rules, formancy.ai-data's under Report's
    names; the tenant the one attribute, mapped once; an empty variable an
    unset one; a `FORMANCY_REPORT_` variable it does not read refused; a
    secret reference to one of the server's own variables refused; no
    problem repeating a value; and the package README's table listing
    exactly the settings it reads. `rate-limit.test.ts`, `proxies.test.ts`
    and `cors.test.ts` hold the rate limit's, the trusted proxies' and the
    origins' rules, Data's, and what the server does with each, watched
    failing with `Number(text)` for the rate limit's digits, with the bits
    past a prefix unread ("10.0.0.1/24: expected true to be false"), with a
    prefix of 0 read as a range, and with entries that together trust every
    IPv4 or IPv6 peer accepted ("0.0.0.0/1, 128.0.0.0/1: expected { ok:
    true … }"); the route a listed origin is refused across, an origin
    that is no string named as none, an OPTIONS without an origin or a
    method logged as no preflight, and `varyWith` watched failing by
    mutation. The trusted proxies' rule is held both ways to
    @fastify/proxy-addr's own matcher, 5.1.2 as Fastify 5.12.7 resolves
    it: every list of one, two or three entries from a pool at the
    families' edges, and longer ones, is refused exactly when the matcher
    trusts every IPv4 peer, plain or IPv4-mapped, or every other IPv6
    peer, asked at each address where what it trusts could stop; and under
    `::/1` the server still counts an IPv4 client by its own address.
    Watched failing with every IPv6 range that holds the mapped one
    counted as IPv4 ("1143 lists differ", the first "0.0.0.0/1,
    0.0.0.0/2, ::/1: proxy-addr undefined, the setting IPv4", and the
    server refusing `::/1`), and with the mapped range left out of IPv6's
    ("2 lists differ"). `serve.test.ts` holds the key and the audit key
    opened through the source main.ts hands over, the audit key at least 32 bytes
    and not the identity key however it is reached, a token's roles read
    from the claim `FORMANCY_REPORT_ROLES_CLAIM` names (watched failing
    with the setting not handed on: "capacities": [] for ["author"]),
    every refusal one sentence, and the key set read again on SIGHUP.
    `composition.test.ts` reads every module with TypeScript's parser and
    fails on any but `main.ts` that imports `process` or the file system,
    with or without `node:`, or names the `process` global; watched failing
    with `node:process`'s `env` imported into `settings.ts` and `fs` into
    `proxies.ts`, which the regex it replaced let through.
  - **The image.** `packages/report-server/src/dockerfile.test.ts`: every
    workspace package the server needs copied, its manifest early and its
    source late, derived from the manifests (watched failing with
    report-server-core's lines removed: "expected [ 'report-server-core' ]
    to deeply equal []", and
    with them commented out, since it reads instructions and never
    comments); one
    Node 26 image pinned by digest in both stages; the pnpm the repository
    pins; the licence in place; the code copied as root's and the store's
    directory the one thing given to `node`; `USER node`; the settings'
    default port; and a `.dockerignore` leaving a machine's installs and
    builds out. The **container gate**, `scripts/container.mjs` as
    gates.yml's `container` job, builds the image and runs every check it
    plans on it: unconfigured, it stops naming every setting it needs;
    with a secret reference it cannot resolve, it exits 1 with that one
    sentence and no stack trace; configured, it answers `/health`, refuses no token, a forgery and a
    tenantless token with the one 401, answers whoami for a token the gate
    signed, answers nothing else, says no-store, runs as `node`, carries the
    repository's `LICENSE.md` and `NOTICE`, writes its store directory and
    cannot write its own code, logs one audit line per answered request and
    no token or part of one, lives through SIGHUP, stops on SIGTERM with
    exit 0 and runs on a read-only root file system; given a key set file,
    it names its kids when it starts and reads the file again on SIGHUP,
    a token under the kid added refused before and answered after; and its
    rate limit,
    trusted proxies and origins change what it does, or stop it naming the
    setting. Watched failing on an image whose store directory was root's:
    "it can write its store directory: docker exec … failed"; on one
    whose tree was copied as `node`'s: "it cannot write its own code: the
    server can write its own code: /app/pnpm-workspace.yaml, /app/LICENSE.md,
    …"; on one whose main.ts threw its refusal: "the server printed a
    stack trace: file:///app/dist/main.mjs:362 …"; on one that handed
    SIGHUP no key set: "SIGHUP did not log the key set read again with
    gate-2 added: null"; and on one whose serving line named none: "the
    serving line named the key set as null". The release report fails a
    run whose gate left no record, did not pass, did not make a check the
    script plans -- read from the script itself, watched failing with the
    report holding the gate to the twenty before these two ("expected
    [ …(20) ] to deeply equal [ …(22) ]") -- or whose image, asked
    itself, runs another Node than the Dockerfile's base or as another user
    than `node` (`scripts/release-report/report.test.mjs`). Which base it
    was built on is the Dockerfile's digest, which Docker verifies when it
    pulls; the report does not compare it again.
  - **From outside.** The install gate's `server` host
    (`scripts/install-fixture/server.ts`) installs the packed server and
    what it declares and nothing else, type-checks with `skipLibCheck` off
    against Node's types, and starts the server in its own process on a
    socket: `/health`, the one 401 for no token, a tenantless token, a
    forgery and a malformed token, whoami for a token signed with
    `node:crypto` alone, nothing else answered, one event for each answered
    request.
  - **Not mechanically enforced:** that the table's rows are the actions
    R14 needs, which review holds until the routes that take them arrive;
    that a route that takes an action asks `can` with it, which holds no
    route yet and the first such route's record holds for its own; that
    one instance runs, which nothing can stop an operator from
    breaking; and that the record formats the next records add carry a
    `format` they are refused by when unknown, which each of those records
    holds for its own.

## Context

The 0.3.0 plan's server slice, R14 to R16, needs drafts and immutable
publication, render jobs in isolated workers, and artifacts per tenant with
retention. Before any of that, something has to know who is asking, for
which tenant, and what they may do. Report had no server at all: arc42 07
said so, and gate G5 was open for it.

Two precedents stood beside it.

- **formancy's server** (formancy.ai 0.6.0): Fastify, PostgreSQL, its own
  users with argon2id and HS256 sessions, API keys, roles in one readable
  table, `can(actor, action)`, and no tenancy anywhere. Its actors are
  formancy's own administrators.
- **Formancy Data's server** (formancy.ai-data 0014, 0020, 0022, 0023,
  0060, 0071): Fastify, a host's JWT verified offline under a pinned
  algorithm, the tenant from a mapped claim, an administrator's plane by
  role, the policy asked on every request, one audit event per request and
  never a value, the rate limit, the trusted proxies and the origins each a
  setting refused when nobody could have meant it, its own state as files,
  one instance, and a container gate that runs the image. Its actors are a
  host application's people, which are Report's too.

The plan's questions were answered by its recommendations, which the user
accepted: the server's state is files, as Data's (SV-Q1); the image's Node
is 26 at an exact digest, the packages staying at 22.13 (SV-Q5); and a
tenant claim is on every token, required (SV-Q6). For the verifier the user
asked Data for a package, and Data released `@formancy/data-identity` 0.3.0
([0047](0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)).

This record is the slice's first: what the server is, before it stores
anything.

## Decision

**Three packages.**
- **`@formancy/report-server-core`**: no Node and no framework, ES2023's
  library and no `@types/node`. It holds who may do what (`ACTIONS`,
  `CAPACITIES`, `can`, `capacitiesOf`, `actionsOf`), who is asking
  (`ReportIdentity`), the wire a client compiles against (`API_PREFIX`,
  `ROUTES`, `WhoAmI`, `Health`, `REFUSALS`, `CROSS_ORIGIN_REQUEST_HEADERS`)
  and the audit port (`AuditEvent`, `AuditSink`). The use cases and the
  stores' ports join it with the records that build them.
- **`@formancy/report-server`**: Fastify, `@fastify/rate-limit` and
  data-identity. `createReportServer(options)`, `createReportVerifier`, the
  settings, and `main.ts`, the composition root and the only module that
  reads configuration. Its Dockerfile is the image.
- **`@formancy/report-client`**, fetch-based and with no Node, arrives with
  the first route a client needs beyond whoami, which is the draft's.

**A token, not a session.** The host signs a short-lived JWT for a person
and the server verifies it offline, with Data's verifier under Data's rules
(formancy.ai-data 0014, 0059; 0047). The server keeps no session, no
password and no key of its own, and fetches nothing.

**The tenant from a required claim.** `FORMANCY_REPORT_ATTRIBUTES` maps
`tenant` to the claim a token names it in, and is required. A token without
that claim, or with an empty one, is refused like any bad token: no request
reaches the server without a tenant, and there is no single-tenant mode. A
single-tenant host puts one constant in every token's claim. Every bad token
is the one 401, `unauthenticated`; which check failed is the log's, by the
verifier's reason, never the token.

**Roles to actions, in one table.** Three capacities -- author, publisher,
administrator -- which the operator gives to the host's roles in
`FORMANCY_REPORT_AUTHOR_ROLES`, `_PUBLISHER_ROLES` and `_ADMIN_ROLES`. One
table of actions, each with the capacities that may take it; a route that
takes an action asks `can(identity, action, policy)` with it, and none
does in this release: whoami takes none, and lists what `can` allows. An
action not in the table is denied to everybody, and no capacity implies
another. The table
holds R14's actions -- a tenant's templates, drafts, assets, versions and
their policies -- before the routes that take them exist, so that whoami
says what each setting grants before any template depends on it; rendering
and downloading are a template's own policy's to grant, and join with it.

**Nothing else answered.** `GET /health`, HEAD on it as GET, and `GET
/v1/whoami`, which says who the server takes the token's holder to be --
subject, tenant, roles -- and the capacities and actions the table gives
them. The API's routes are `ROUTES`', and a route there without its audit
name stops the server starting; HEAD is answered on `/health` alone. Every
other method and path is the one 404, `not-found`, answered before its
body is read, counted by the rate limit, and its connection closed: nothing
reads that body, and read first it was parsed uncounted however broken or
large, and held open however slowly it came. A path with anything a proxy
could normalise -- an escape, a dot or empty segment, `/` alone, an escape
that does not decode -- is the one 400, `path-not-plain`, before any
route's work, by formancy.ai-data 0037's rule, so that a proxy filtering by
path and the router never read one path two ways. A preflight with a body
is refused before it is read. None of these quotes anything of the
request. A request Node's parser cannot read is the fixed `bad-request`
with the parser's status, `no-store`, and a request that takes longer than
300 s to arrive, Node's own default, which Fastify turns off, is cut; the
one answer outside the refusals is Fastify's 503 while the server closes.

**The audit trail.** One event per request an API route answered, from the
answer once it is decided -- from `onResponse`, or from `onSend` or the
connection's close when the client has left -- as Data's (formancy.ai-data
0023, 0033): when, which route, its status and its outcome code, and
whether the request carried a verified identity. Never a value. Who asked
is named by the first 32 hex characters of HMAC-SHA-256 under
`FORMANCY_REPORT_AUDIT_KEY` over a JSON array of the kind and the values,
the tenant and the person within it, or by nothing without a key: a tenant
and a subject are claims' values, a person's identifier at the host among
them, and the trail is the server's log. The key is all that keeps a
reference from being reversed, so it is at least 32 bytes, data-identity's
floor for a shared secret, and it is not the identity key, compared at
start, so that whoever is given it to read the trail cannot sign tokens.
The server's own sink writes one log line per event.

**As Data's.** The rate limit, 600 requests a minute per client address
unless `FORMANCY_REPORT_RATE_LIMIT` says otherwise, `/health` spared; the
proxies whose X-Forwarded-For is believed, by address or range and never
everybody (formancy.ai-data 0071); the origins whose pages may call the
API, each exactly as a browser sends it, never a wildcard, and a
token-bearing request a browser marks cross-site from any other origin
refused before its token is read (formancy.ai-data 0060); and `no-store` on
every answer (formancy.ai-data 0037).

**Its settings.** Read once by `main.ts` and parsed by `settings.ts`, which
is handed the environment. An unconfigured server does not start: it prints
one line for each setting it needs, each naming the setting and none
repeating a value. A variable set to the empty string is unset. A variable
whose name begins `FORMANCY_REPORT_` and which the server does not read
stops it, naming it; a secret's variable is therefore one outside that
prefix, and a reference to one of the server's own variables, which holds
no secret, stops it too. A list of trusted proxies whose entries together
trust every IPv4 or every IPv6 peer is refused as `*` is, read as Fastify's
@fastify/proxy-addr matches a peer: an IPv4 peer, plain or IPv4-mapped,
which it reads as IPv4, against the IPv4 entries and the IPv6 ranges
inside `::ffff:0:0/96`; any other IPv6 peer against the other IPv6
ranges. So `::ffff:0:0/96` alone trusts every IPv4 peer and is refused,
and `::/1`, which holds that range, trusts no IPv4 peer and is not;
beside `8000::/1` it trusts every IPv6 peer, and the two are refused for
that. A list that stops short of a family, half of IPv4 among them, is
the operator's to name. An embedder's `logger` is held as its lists are:
`{ stream }` or absent, since Fastify's own `false` would turn the log on
here. Every default is labelled: the rate limit, the preflight's lifetime
and the image's health check are Data's, derived and not measured here;
the request timeout is Node's own; the port, 4392, is a choice beside
formancy's 4380 and Data's 4390.

**One instance.** The server holds nothing a second instance would share
today, and the store that arrives next is files on one volume, as Data's
(formancy.ai-data 0013; SV-Q1), with its ports shaped so that a database
can be a second store later. Two instances behind one address are not a
deployment this release supports.

**A fourth version line, extending 0004.** The API is versioned by its
path: every route a person's token reaches is under `/v1`, and a shape a
client could not read as before is a route under `/v2` beside it, never
`/v1` changed. The server's own records -- a draft, a version, a policy, a
job, an artifact -- each carry a `format` number from the record that
introduces them, and a reader refuses one it does not know, naming it, as
0004 refuses a report of an unknown version. `/health` is outside the line.

**The image.** `packages/report-server/Dockerfile` builds on Node
26.12.1 on Alpine 3.24 at the digest of its multi-platform index, in both
stages, runs as `node`, carries `LICENSE.md` and `NOTICE`, and owns
`/var/lib/formancy-report`, the store's directory, and nothing of its own
code, which is root's, so a process made to write cannot rewrite the
server; it runs on a read-only root file system too. Data's image gives its
user its tree, and this one does not. The container gate builds
it and runs it on every pull request. This release does not publish it: a
later record signs and publishes it by digest, and decides what its
operating system's layer is under 0006 (SV-Q13).

## Consequences

**What it buys.**
- **One question for every permission.** A route asks the table with its
  action, and whoami answers what the table says, so two routes cannot
  disagree about one action, and a host's wiring shows before anything
  depends on it.
- **No tenant the browser chose.** The tenant comes from a signature, and a
  request without one does not exist.
- **Data's rules, not a copy of them.** One host signs one token, and both
  servers verify it alike (0047); the rate limit, the proxies and the
  origins are held to Data's rules, under Report's names.
- **A server that cannot start wrong.** A missing or misspelt setting, a
  short secret, a proxy list that trusts everybody or an origin nobody
  could have meant stops it, naming what to fix.
- **An image proved, not only built.** The container gate finds what no
  test in the workspace sees: a module the deployed tree lacks, a setting
  `main.ts` does not read, a directory the server cannot write.

**What it costs.**
- **A second server.** A host using Data and Report runs two processes, two
  images and two sets of settings, with the same identity settings under
  two prefixes.
- **A token is trusted until it expires.** The server keeps no session and
  asks the host nothing, so a person removed at the host keeps their
  token's access until its `exp`. The host keeps tokens short.
- **The claim is required.** A single-tenant host adds a constant claim to
  its tokens; an identity provider that cannot add one needs a step that
  mints the token the server reads.
- **Actions before routes.** The table holds actions no route takes yet,
  which whoami lists, and the records that build those routes may change a
  row.
- **Who asked, by reference.** Without an audit key the trail says what was
  asked and how it ended, and not by whom; with one, an operator finds a
  person's events by computing the reference. Formancy Data's trail names
  its actor plainly, so the two trails are read differently.
- **The trail's gaps.** It is operational, not evidence, as Data's: written
  by the same process after the answer, to a sink that may lose it. A
  request no route answered -- a 404, a path that does not decode -- writes
  none; a path that is not plain, which the router matched to a route,
  writes that route's event.
- **No setting staged ahead.** A variable of a later release's, set before
  that release runs, stops this one.
- **The proxies' rule is one matcher's.** It is read as @fastify/proxy-addr
  5.1.2 matches a peer, and refuses only a list that trusts a family
  whole: one that trusts half of IPv4 starts. A Fastify that resolves
  another proxy-addr fails the test that asks its matcher until the rule
  is read again.
- **HEAD on `/health` alone.** A client that probes the API with HEAD gets
  404.
- **A plain path, or 400.** A client that adds a trailing slash, escapes a
  character no name needs escaped, or asks for `/` gets `path-not-plain`.
- **A request arrives within 300 s.** Node's own default; the routes that
  read a body, from the draft's on, are held to it, and one that needs
  longer is a record of its own.
- **One instance.** The rate limit is counted in the process's memory and
  starts again with it. A second instance is a second limit and, once the
  store arrives, a second store.
- **Two Nodes.** The image runs Node 26.12.1, the packages run on Node
  22.13 or later, and Data's image runs 22.12. The image is 189 MB,
  measured with `docker image inspect` on 2026-10-22.
- **The image is the operator's to build** until it is published, and its
  operating system's packages, Alpine's BusyBox under GPL-2.0 among them,
  are not read by `scripts/dependency-licences.mjs`, which reads npm
  packages.
- **Fastify's closure.** The server brings 54 packages that are no
  repository's own, which `scripts/dependency-licences.mjs` walked on
  2026-10-22: under MIT, BSD-3-Clause and ISC, and Data's verifier under
  0047. report-server-core depends on nothing.
- **The bodies.** No route reads a body, and Fastify's default limit of a
  mebibyte stands until the draft's route sets one from report-spec's. A
  request no route answers, and a preflight, are refused before theirs is
  read.
- **What the token's verifier does not hold.** data-identity sets no
  longest lifetime, so a token whose `exp` is years ahead is accepted
  until then, and a signature with `=` appended verifies, so a token's
  text is not unique. Both are Data's rules, which Report takes whole
  (0047); a rule for either goes to Data first, and nothing here keys on a
  token's text.

**What it forecloses.**
- Sessions, passwords and keys of the server's own; identity is the host's.
- A tenant named in a request: a header, a query or a body.
- A permission decided anywhere but the table.
- Reading Formancy Data from the server, which would put it on the network
  (SV-Q3); a host captures data and hands it over.

## Alternatives considered

**formancy's server package.** Rejected. Its actors are formancy's own
administrators, with sessions and passwords; it has no tenancy; and it
brings a native module and the model SDKs. Its patterns are taken -- one
readable table, use cases split from HTTP -- and not its package.

**Formancy Data's server as the base.** Rejected. It brings both database
adapters, their drivers and the Azure SDKs, an administrator's plane over a
customer's database, and a `@formancy/spec` beside Report's; and Report
would depend on Data for a web server. Its shape is taken, and its verifier
by 0047.

**A session the server issues.** Rejected, for formancy.ai-data 0014's
reason: the people asking are the host's, the host already knows who they
are, and a session is a second identity to keep in step with the first.

**An optional tenant, or a single-tenant mode** (SV-Q6 b). Rejected: two
code paths, and a token that forgot its claim would be a tenant of its own,
shared by every host that forgot it.

**A policy per route, or rules on the records.** Rejected: two routes
deciding one action would be two decisions, and nothing would show where
they disagree. One readable table is formancy's choice too, its server
core's `can(actor, action)`.

**An unversioned API.** Rejected, for 0004's reason: a client that reads
a route cannot tell a changed shape from a changed meaning except by a
number it is told.

**The actor named plainly, as formancy.ai-data 0023 names it.** Rejected:
a subject is a claim's value, often an email address or an identity
provider's object id, and the trail is a log whoever runs the collector
reads.

**The 404 in the not-found handler, as Fastify places it.** Rejected: its
body is read and parsed before the handler and its hooks, so a broken or
an oversized body was refused uncounted and a slow one held its
connection. The root's first hook answers it instead, as Data's answers a
path that is not plain.

**The image on Node 22, as Data's** (SV-Q5 a). Rejected: the renderer's
workers will run under the permission model's network scope, which Node
22's documentation does not have.

**A test that spawns `main.ts` instead of a container gate.** Rejected as
the only proof: it would run the workspace, not the deployed tree, which is
where formancy's image failed.
