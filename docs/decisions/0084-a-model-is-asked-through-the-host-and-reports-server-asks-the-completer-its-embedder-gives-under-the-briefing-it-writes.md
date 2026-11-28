# 0084 — A model is asked through the host, and Report's server asks the completer its embedder gives, under the briefing it writes

- **Status:** accepted; numbered before 0085 and merged after it, and after 0088, 0089 and 0090; extends [0046](0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md), whose actions table, wire and trail it adds to, and [0049](0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md), whose routes it sits beside and whose rule that no body is read before the token it keeps for a client gone during the token's check; answers what [0085](0085-a-model-is-asked-only-for-the-words-a-language-lacks-and-its-answer-is-one-batch-held-to-the-format-and-the-compiler-before-a-person-sees-it.md) says a host's server owes, the digest compared where the briefing is written; follows formancy.ai 0163, 0165 and 0183
- **Date:** 2026-11-28
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The use cases.** `packages/report-server-core/src/model.test.ts`,
    against a completer of its own that records what it was asked and an
    ending the case ends by hand: `readModel` says the provider, the model
    and each kind's briefing digest to an author, none as `null` and `null`
    with a 200, and nothing to a publisher, an administrator or a token
    with no capacity; `askModel` asks the completer under the briefing the
    table holds for the kind, never a `system` the body carries, the user
    part as sent; refuses before anything is asked a kind the table does
    not hold, `constructor`, `toString`, `__proto__` and `hasOwnProperty`
    among them, a user part missing, blank or no string, a briefing digest
    that is another kind's, another release's, upper-case or none, and a
    body that is no object; refuses a publisher, an administrator and a
    token with no capacity with or without a model, and answers a server
    with none 404; answers a provider's refusal as a decline, a truncated
    answer and an unreachable provider 502, the latter's status recorded and
    its words nowhere; a completer that throws, answers no completion or
    says it was cancelled uncancelled as unavailable, quoting nothing of it;
    an asker gone 499 and the time up 504, told to the completer once and
    answered at once whether or not it listens, whatever it answers then;
    asks nothing where the request ended before it was asked; tells a
    completer that listens only after the ending at once; keeps an answer
    that came before an ending and tells the completer nothing after it; records the user part's length as JavaScript counts it; and judges
    a request in the order authority, model, kind, user part, briefing.
    `actions.test.ts`: `model.read` and `model.ask` are an author's alone,
    and whoami lists each exactly where `can` allows it. `wire.test.ts`:
    the two routes, each named in the trail by the action it takes, and the
    refusals, each a fixed sentence.
  - **The routes.** `packages/report-server/src/model-route.test.ts`,
    through `createReportServer`: `GET /v1/model` answers an author 200 with
    `provider` and `model` both `null` where the embedder gave none, and
    report-ai's `briefingDigest` of each of its `REQUEST_KINDS`, the names
    the embedder gave where it gave one, a publisher 403 and no token 401;
    `POST /v1/model/complete` refuses a publisher and a token with no
    capacity 403 and answers 404 `model-not-configured` with no model; asks
    under report-ai's `modelBriefing`, a `system` in the body unread;
    refuses `edit`, `constructor` and `toString` 400, another digest and
    none 409, and a body that is not JSON 415, each unasked; answers a
    decline, a truncated answer and an unreachable provider as the use case
    does; takes a body of exactly `MAX_MODEL_REQUEST_BYTES`, `{ kind, user,
    briefing }` as JSON, and refuses one byte past it 413
    `request-too-large`, unasked; counts each person after the token, two
    people behind one address apart, a forged token's 401 spending no
    person's budget, past the limit 429 `model-rate-limited` with
    `Retry-After`, while the per-address limit still counts the route; does
    not start with a model it could not ask or a limit the setting could
    not say; cancels a completer past `MODEL_TIMEOUT_MS`, and not a
    millisecond before, and answers 504 `model-timed-out`; abandons the
    completer's request when its client goes, the trail saying so once;
    asks nothing of a client gone while its token was checked; reads a
    response closed before the handler as an asker gone from the start, a
    finished one and a close after it as none, and an ending as said once;
    and cancels no answer after it was sent.
  - **The trail.** `packages/report-server/src/audit.test.ts`: one event a
    request to the model, its `model` member the kind, the user part's
    length and how it ended, and no string of the request, of the model's
    answer, of a `system` the body carried or the digest, in the event or
    in any log line; a provider's status in the event and in the log's line
    for the failure, and never its words; no `model` member for a request
    refused before it was asked; and a request whose body went with a
    client gone while its token was checked one event, `bad-request`.
  - **The client.** `packages/report-client/src/client.test.ts`, against
    report-server: `model()` answers the server's `GET /v1/model`, none and
    a model's names alike; report-ai's `askThrough(reports.completeModel)`
    reads the server's model's text, hands its decline back as a decline,
    and throws a refusal in the server's sentence; a digest that is not the
    server's is thrown as `briefing-differs`, the refusal as the error's
    `cause`, and nothing is asked; a turn cancelled abandons the request
    and the server tells its completer. Against a recording fetch: the body
    is the request's three members as JSON and nothing else, as long as
    report-ai's `requestBytes` measures it; a 200 that is neither a text
    nor a decline is thrown.
  - **The page's side**, 0085's: `packages/report-ai/src/ask-through.test.ts`
    refuses a prompt not briefed as report-ai briefs its kind before
    `complete` is called, hands a decline back as a decline, and tells the
    host of a stop.
  - **No model in the container.** `packages/report-server/src/settings.test.ts`
    stops the server on `FORMANCY_REPORT_MODEL_PROVIDER`,
    `FORMANCY_REPORT_MODEL_API_KEY` and `FORMANCY_REPORT_MODEL`, as on any
    variable it does not read; `scripts/container.mjs` checks that the
    built image answers an author's `GET /v1/model` with none and a digest
    for each briefing, and `scripts/container.test.mjs` that it plans the
    check, which the release report reads from its `CHECKS`.
  - **The image.** `packages/report-server/src/dockerfile.test.ts`: the
    Dockerfile copies the manifest and the source of every workspace
    package the server runs on, report-ai and report-core among them, the
    manifest alone of every one those name as a dependency of any kind,
    the corpus and the runtime, which report-ai's suite takes, and installs
    and builds by production dependencies, `--filter-prod`.
  - **The install gate.** The `server` host's `server.ts`, from the packed
    packages: the server made with a completer of its own, `model()`
    naming it and report-ai's digest, report-ai's `askThrough` over the
    packed client's `completeModel` answered under report-ai's briefing,
    and the trail's two events, the second with its `model` member and no
    word of what was asked. `apps/pages/src/limits.test.ts` holds that no
    published package but report-server takes report-ai.
  - **Seen failing** on 28 November 2026, each fault planted and put back:
    the briefing taken from the body (one case in the use cases' suite,
    one in the routes'); the kind looked up by `in` (one); the digest
    unchecked (two); the completer's answer awaited and the ending ignored
    (two); the completer asked though the request had ended (one); the
    completer told of an ending after it answered (one); a listener the
    completer gave only after the ending never called (one); the limit keyed
    by address (one); the close heard only from the handler on (one); a
    body whose client went during its token check left to Fastify's reader
    (two, one of them the trail's); the user part in the audit event (two);
    the timer at twice the time (one); the route's own body limit left out
    (one); in the client, the request sent whole (one), a stop not handed
    to fetch (one) and a refusal answered rather than thrown (two); the
    container's check unplanned (one); main's guard on the start page,
    with the server taking report-ai (one); and,
    with the build stage's commands run from a copy of what it copies, the
    image's build on `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` without the
    corpus's and the runtime's manifests. The tests written before the
    code each failed first, for the module or the member they named.

## Context

A model costs money and reads what it is sent. formancy decided whose it is
(formancy.ai 0163, 0165): the host's. A builder is handed an `AskModel` and
never a key; a deployment that has a model keeps it on its server, and the
browser sends a request's kind and its user part, never its briefing, so
the operator's key pays only for the requests the product makes.

report-ai asks a model for a language's missing words and holds the answer
to the format and the compiler (0085). Its `askThrough(complete)` is the
`AskModel` a host makes over its own `complete`, which sends
`{ kind, user, briefing }` -- the briefing's digest, never the briefing --
and 0085 says what the server owes: write the system part by the kind, read
none a page sent, and refuse a digest that is not its own briefing's. No
server of Report's did that yet.

Report has hosts of three kinds. One embeds the builders in its own page and
has its own backend and its own model. One runs Report's server
(`createReportServer`) in its process, as the install gate's `server` host
does. And the Studio, which may ask no site for anything (0023).

Report's server answered `/health`, `/v1/whoami` and the draft slice, and
nothing else (0046, 0049). Every route of its API verifies the token before
a byte of a body is read. Its image is built and run by the `container`
gate and not published.

The providers' adapters are formancy's, in `@formancy/server`, over
Anthropic's and OpenAI's SDKs, each overriding what the SDK would read from
the environment (formancy.ai 0165). That package brings formancy's whole
server: Fastify, Postgres, drizzle, argon2, jose, undici and both SDKs. Its
port, `Completer`, is `@formancy/server-core`'s, which brings formancy's
builder-core, challenge, core and spec, `@noble/hashes` and `recheck`, and a
use case that refuses every kind but formancy's three. The owner decided on
27 November 2026 that only authors may ask the model, and that Report's
container gets no model of its own until formancy releases its providers'
adapters in a package other products may take.

## Decision

**A model reaches a builder through an `AskModel` the host gives, and
Report's server asks a completer its embedder gives, under the briefing the
server writes for the kind a request names, once it has compared the digest
the page reads the answer against with its own.**

- **The port.** report-server-core's `model.ts` holds formancy's
  server-core shapes member for member: `CompletionPrompt`, a system part
  and a user part; `Cancellation`, a callback told once when the request is
  abandoned; `Completion`, the text or a typed failure, `refused` with a
  reason, `truncated`, `unavailable` with the provider's status, or
  `cancelled`; and `Completer`, which completes one prompt and never throws
  for a provider's failure -- so that a completer formancy's adapters make
  is one this server takes. `DeploymentModel` is the embedder's provider,
  model and completer. `ModelBriefings` is the table of each kind's system
  part and its digest, handed to the use cases, so that server-core still
  depends on report-spec alone.
- **The use cases.** `readModel` answers `{ provider, model, briefings }`,
  both of the first `null` where the embedder gave none: none is an answer,
  a 200 (formancy.ai 0183). `askModel` judges a request in this order, each
  refusing what the ones before it let through, and asks nothing unless all
  pass: the capacity, `forbidden`; a model, `model-not-configured`, 404;
  the kind, one the table holds by `Object.hasOwn`, `unknown-request-kind`,
  400; a user part with something in it, `request-empty`, 400; and the
  digest, the table's for the kind, `briefing-differs`, 409. Of the body
  nothing else is read, a `system` above all. Then the completer, under the
  table's system part and the user part as sent, until it answers or the
  route's `ModelEnding` ends the request: an ending tells the completer to
  cancel, once, and is answered at once whether or not the completer
  listens, the asker gone 499 `model-cancelled`, which nobody reads and the
  trail records, the time up 504 `model-timed-out`; a request that ended
  before it was asked is never asked; an answer that came first is kept,
  and the completer told nothing after it. The text is answered `{ text }`,
  a provider's refusal `{ declined }`, a truncated answer 502
  `model-truncated`, an unreachable provider 502 `model-unavailable`; a
  completer that throws, answers what is no completion, or says it was
  cancelled when nothing cancelled it is a model that could not be asked.
  None of the refusals quotes the request or the provider.
- **The routes**, both in `ROUTES`, each named in the trail by the action
  it takes, as every route that takes one is (0049): `GET /v1/model`,
  `model.read`, and `POST /v1/model/complete`, `model.ask`, the body
  `{ kind, user, briefing }`. Both actions are the author's alone: asking
  is authoring, as a draft's save is, and a role that should ask is given
  the author's capacity, as for every action (0046). whoami lists each
  exactly where `can` allows it.
- **The server writes the briefing.** report-server builds the table once,
  where it registers the routes, from report-ai's `modelBriefing` and
  `briefingDigest` over its `REQUEST_KINDS`, so the server asks under the
  briefings the page's report-ai reads the answer against. report-server
  depends on report-ai for that table.
- **Bounds.** The body is JSON alone, up to `MAX_MODEL_REQUEST_BYTES`,
  report-ai's one constant, the route's `bodyLimit`: the bound the request
  builder and `askThrough` hold a page's body to, measured on the same
  bytes, `{ kind, user, briefing }` as JSON as it is sent, which
  report-client's `completeModel` sends and nothing else (0085's review). A
  body past it is refused 413 `request-too-large` by the length it declares
  before it is read, or once it is read past it where it declares none.
  Ten requests a minute per person by default, `model.rateLimit` to change
  it, counted by a limiter of the route's own, keyed by the token's tenant
  and subject, after the token and the body and before the use case, 429
  `model-rate-limited` with `Retry-After`; beside it the per-address limit
  every route but `/health` has still counts the route, before any token.
  `MODEL_TIMEOUT_MS`, 300 s, chosen as `REQUEST_TIMEOUT_MS` and not measured
  against any provider. A client that goes is heard from its response's
  close, or, where the response had closed before the handler, at once.
- **A client gone while its token was checked.** Its body went with it:
  Node destroys the request, and Fastify's reader, which comes after the
  token, waited for it for good, so the request was neither answered nor in
  the trail, on the draft slice's routes as on this one. The API's hook now
  answers such a request where its token is, to nobody, 400 `bad-request`,
  a request that could not be read, so that it is one event; nothing of it
  was read and nothing is asked.
- **The trail.** A request to the model that passed every check gives its
  event a `model` member: the kind, as the table names it; the user part's
  length in UTF-16 code units; how it ended, `answered`, `declined`,
  `truncated`, `unavailable`, `cancelled` or `timed-out`; and the
  provider's status where it could not be asked and gave one, which the
  log's line for the failure carries too. Never the text, the answer, the
  provider's words or its name.
- **The page.** report-client's `model()` asks `GET /v1/model`, and
  `completeModel(request, turn?)` is a `complete` for report-ai's
  `askThrough`: the three members as JSON, a turn's cancellation handed to
  fetch, and a refusal thrown in the server's sentence, the `Answered` it
  came in as the error's `cause`, so that the run ends unreachable in words
  that quote nothing. `askThrough` refuses, before it calls `complete`, a
  prompt whose system part is not report-ai's briefing for its kind
  (0085).
- **Configuration.** The embedder's composition root gives
  `createReportServer({ model: { provider, model, completer, rateLimit? } })`,
  checked at start as every option is, and copied. The container's
  `main.ts` gives none and reads no model setting; any
  `FORMANCY_REPORT_MODEL_*` variable stops it at start by the settings'
  existing rule; and its `GET /v1/model` says none. When formancy releases
  its adapters in a package of their own, the container reads
  `FORMANCY_REPORT_MODEL_PROVIDER`, `FORMANCY_REPORT_MODEL_API_KEY` (a
  secret reference) and `FORMANCY_REPORT_MODEL`, all three or none, through
  it, in a record of its own.
- **The image** copies report-ai and report-core beside report-spec and
  report-server-core, and the manifests alone of the corpus and the
  runtime, which report-ai's suite takes and without which pnpm runs no
  script in the build stage; it installs and builds by production
  dependencies, so nothing of either is installed or built.

## Consequences

**What it buys.** Every request Report's server pays for is asked under one
of Report's briefings, by a person who may author, at a rate and a size the
server bounds, and recorded without its text. A page and a server built from
different releases refuse with a 409 rather than brief a model one way and
read its answer another, which formancy carries as debt (its
SAFETY-ANALYSIS D17), in the same request and with no second round trip. A
host with a model of its own needs no server at all, and the Studio needs
neither. A completer written for formancy's port fits this one. Proposals 2
and 4 add a kind and a briefing to report-ai's table, and no route. A
request with a body whose client went while its token was checked is one
event now, on every route that reads a body.

**What it costs.** **The template's words leave** for the provider an
embedder chose, under its terms: what a request carries is 0085's, and
nothing here says it is private, because it is not. **The endpoint is
narrowed, not closed**: the briefing is pinned, the user part is not, and an
author can ask the model anything under Report's briefing and read the
answer; the capacity, the limit, the cap, the timeout and the trail bound
and record that, and do not prevent it. The limit is counted per process,
as the server runs one (0046), and held for the 5,000 people who asked
last, the rate-limit plugin's own cache, so the next one pushes out whoever
asked longest ago, whose count starts again; a publisher's 403 is counted
with the rest. There is no spending cap; the provider's own is the backstop. **The
container has no model** until formancy releases its adapters, so an
operator of the image cannot give its builders one, and an embedder writes
a completer of its own over its provider's SDK, and finds out for itself
what that SDK reads from the environment, which formancy's adapters had to
override one setting at a time. **The port is formancy's shape, held by
nothing**: no test compares it with `@formancy/server-core`'s, whose
manifest would bring formancy's server's closure into this workspace, so a
formancy release that moved it would be found by an embedder's compiler.
**report-server depends on report-ai, and through it on report-core and
`@formancy/expressions`**, for one table of strings; its install grows by
both, and so does its image, whose build stage now copies two manifests of
packages it neither installs nor builds, and selects by production
dependencies, so a workspace package added to report-ai's suite needs its
manifest copied too, which `dockerfile.test.ts` says. A timeout chosen
rather than measured can cut a long answer a provider would have finished;
the person asks for the rest (0085). A completer that never listens to its
cancellation runs on after the 504 or the 499, paid for, until it ends. A
499 is no status HTTP defines; nobody reads it, and the trail records it. A
request whose client went during its token check is answered `bad-request`,
the one sentence for a request that could not be read, where it is really a
client gone. The audit event, a log line, gains a member, which a collector
reading it by shape meets.

**What it forecloses.** A briefing from a request, a general proxy to a
model, a kind registered at runtime, and a model a publisher or an
administrator asks without the author's capacity.

## Alternatives considered

**Depend on `@formancy/server` for `createCompleter` and `modelSettings`.**
Lost: it brings formancy's whole server, its database drivers and a native
password hash into Report's, and its entry imports them.

**Report's own adapters over the two SDKs.** Lost for now: a second
implementation of formancy.ai 0165's, every override it found to be needed
found again; it is the part of formancy's change the design drafts for
formancy.

**Depend on `@formancy/server-core` for `Completer`.** Lost: three types for
four upstream packages and `recheck`, and a use case that refuses every kind
but formancy's.

**One action, `model.ask`, taken by both routes.** The draft's. Lost to
0049's rule that a route that takes an action is named in the trail by it:
two routes under one name would be one operation, and a question whether
there is a model could not be told from a request the operator pays for.

**The page compares the digest the server serves**, `askThrough(complete,
digests)`, the draft's. Lost to 0085, which sends the digest with the
request: the server that writes the briefing compares it, in the same
request, and a page needs no second round trip first. `GET /v1/model` still
serves the digests, for a page to say what it would be asked under.

**The model's turn run on the server**, the page sending the instruction
alone. Lost as formancy lost it (formancy.ai 0165): the run, the stop, the
review and the relay are the editor's, and a second loop on the server is
the same decision twice.

**A 404 for no model.** Lost to formancy.ai 0183: none is how a deployment
ships, and a failed request on every sign-in teaches whoever reads the
console to step over failures.

**A limit per address**, as the server's global one is, or the plugin's
per-route setting. Lost: an office behind one address would share one
budget, and one person could spend another's; and the per-route setting
replaces the per-address count on its route, where a client replaying
tokens is what that count is for.

**Cancel a completer that went while its token was checked**, as formancy's
route does where its key is checked after the body. Here the token comes
before the body, which goes with the client, so there is nothing to ask:
the request is answered where its token is, never asked.

**Publishers and administrators asking too.** Lost: asking is authoring, and
a role that should may be given the author's capacity, as for every action.
