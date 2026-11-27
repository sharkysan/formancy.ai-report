# 0088 — An agent gets Report's checks over the Model Context Protocol, from a server of Report's own

- **Status:** accepted for the tools that need nothing, the prompts and report-core's two derivations; its server half, the tools that read and save a template's draft and the identity they ask with, is decided and not yet built, and no test holds it until the pull request that builds it states its own here; its render check is [0089](0089-the-mcps-render-check-reads-the-pdf-back-with-pdfjs-at-the-corpuss-pin-the-first-published-package-that-carries-it.md)'s; an edit applied past the size bound answered as no error, 2026-11-27; extends [0008](0008-edits-are-commands-and-a-refused-edit-changes-nothing.md); follows formancy.ai 0056 and 0112
- **Date:** 2026-11-27
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The facts are derived.** `packages/report-core/src/facts.test.ts`:
    `reportFacts()` lists the format by report-spec's and report-core's
    constants, the very objects; each bound is the value of report-spec's
    constant of its name, and every `MAX_` and `MIN_` report-spec exports
    is a bound or is named there with why no report written as JSON is
    refused past it -- `MAX_ERRORS`, the number of errors the validator
    lists, and the limits of a font, an SVG or an image file; every number
    a note says is written from its constant; `describeCommands()` lists
    every command of `COMMANDS` in its order, each argument in the words
    `invalid-arguments` refuses it in, and `MAX_BATCH_COMMANDS`,
    `PART_COMMANDS` and `REFUSAL_CODES` as they are; both exported from
    the package.
  - **The notes are held.** `packages/report-core/src/facts-notes.test.ts`:
    each note `reportFacts()` gives is one of `NOTES`, and each is held to
    the validator, the compiler or the command that refuses what it says
    -- another version and a formancy form refused whole; a decimal
    default written as a number refused, a double and `/` refused, `dec()`
    and `divide()` of two decimals not; a third dataset and a table past
    `MAX_TABLES` refused; a name read out of its place, whole or by a key
    computed as it renders, an image field, the clock and a random draw
    refused; a translation keyed by a word the report does not print
    refused; a QR-bill as a component refused; the account written into
    the e-invoice and every EPC QR code by one command, and a term EN
    16931 does not allow refused; a length of three places refused; a
    diagnostic error beside a report the validator takes. Its cases are
    typed over every key of `NOTES`, so a note without one does not
    compile; and the names a note gives are typed against what they name.
  - **The tools as functions.** `packages/report-mcp/src/tools.test.ts`,
    over the corpus's starters: `describe_format` and `describe_commands`
    answer report-core's derivations; every starter validates, with its
    hash, the diagnostics `diagnose` gives of its own, and for each
    language it declares the list `languageDiagnostics` gives; a language
    added lists its `word-missing` errors under it, not among the report's
    own; a document that is no report answers the validator's errors
    alone, each with the validator's path; commands applied answer the new
    report, its hash and its diagnostics, every part they do not name
    kept; a refused command answers its code, sentence and path and the
    hash of the report as it was given; a result the validator refuses is
    `invalid-document` with its errors; a stale `expectedHash` is
    `stale-document`, answering no hash and telling the agent to validate
    the report it means to edit; an unknown command, wrong arguments and
    a batch inside the batch are refused by the registry; an empty list
    changes nothing, said as such; a report the validator refuses has no
    command run on it; and a report of exactly `MAX_REPORT_BYTES`, measured
    as report-spec states the bound is, passes, one a byte past it is not
    `ok` and names `report-too-large`, and an edit that grows a report
    past it is applied and not `ok`, and says it was `applied`.
  - **Through the protocol.** `packages/report-mcp/src/server.test.ts`,
    with the SDK's own `Client` over its `InMemoryTransport`: the four
    tools listed, each with the description `TOOL_DEFINITIONS` holds and
    saying when to call it; every tool annotated read-only and
    closed-world, none named for publishing, saving, sending or fetching;
    every tool declaring the one envelope; no input schema holding, at any
    depth, a property named for an address, a path or a file, or a string
    of format `uri`, and no prompt an argument so named, the walk shown to
    find each; a report taken as any JSON value; the server's version the
    manifest's; arguments surviving the round trip, and a refusal arriving
    as `isError` with its structure, and an edit applied past
    `MAX_REPORT_BYTES` arriving not `ok`, with the report it made, and no
    `isError`; `validate_report`'s description
    saying what a save asks of the server that it does not check; the two
    prompts, each naming only tools the server registers, writing in the
    order the format, the report, the checks, and translating from
    `word-missing` through descriptors `translationSteps` makes, typed by
    report-core's `StepDescriptor`, which the case applies through the
    registry to a starter that prints words by an expression.
  - **The composition root.** `packages/report-mcp/src/composition.test.ts`,
    read with TypeScript's parser, every directory of `src/` read and a
    module named by its path in it: each module imports only the
    specifiers its list names -- `tools.ts` report-core and report-spec;
    `server.ts` `node:module`, the SDK's `server/mcp.js` and `types.js`,
    report-core for types, zod and `./tools.js`; `main.ts` the SDK's
    `server/stdio.js` and `./server.js`; `index.ts` its two modules -- and
    a module with no list fails; `main.ts` alone names `process`;
    `server.ts` alone takes `createRequire`, as `import { createRequire }
    from 'node:module'` and in no other way, and calls it once, its result
    called at once with `'../package.json'` alone, and no module names it
    by a string; no module names `console`,
    `fetch`, `WebSocket`, `XMLHttpRequest` or `EventSource`. The guard is
    shown to find, planted, Express, Hono, cross-spawn, the SDK's HTTP
    server transport and its stdio client, `node:fs` imported, required
    or loaded through `createRequire`, a `require` kept and called later,
    `console` by name and by index, `process` outside `main.ts`, `fetch`,
    and a module of its own; and, after the re-review, `createRequire`
    imported under an alias, called by a namespace's string index,
    re-exported and imported as a type, each of which had passed, and a
    module in a directory of `src/`, which the walk had not read.
  - **The licences.** `scripts/dependency-licences.mjs` over the
    SDK's and zod's production closure, as this repository's lockfile
    installs it, every package permissive, judged as any package is.
  - **From outside.** A new install host, `mcp`, in
    `scripts/install-hosts.mjs`, held by `scripts/install-hosts.test.mjs`:
    Node's types, report-mcp and what it declares, and the SDK's client
    at the release report-mcp declares, read from its manifest;
    `scripts/install-fixture/mcp.ts` launches the bin npm linked through
    the SDK's stdio client as a client launches it, lists the tools with
    the descriptions and annotations the packed library exports,
    validates a report report-spec makes, applies a command, has a stale
    hash refused, and reads the version the tarball carries.
  - **Seen failing before merge**: `validate_report` registered under the
    argument `document`; the report argument a zod schema of the format;
    a language's diagnostics listed among the report's own; a step of the
    batch dropped before the registry saw it; `tools.ts` reading
    `process.env`; `reportFacts()` holding a copy of `COMPONENT_KINDS`;
    the install plan's tests once the host was planned, before their
    manifests packed report-mcp; the sketch without report-mcp's box; and,
    after review, the size cases before the bound was checked, a stale
    refusal answering the hash, the description that said "as a save
    would", the limits case while `MAX_ERRORS` was a bound and the list
    lacked others, the prompt's descriptors before `translationSteps`,
    and, planted in the real modules, `console.log` in `tools.ts`, a
    `createRequire` of `node:fs` and an import of Express in `server.ts`,
    the SDK's stdio client in `main.ts`, `process.env` in `tools.ts` and a
    module with no list. Two notes failed their cases and were wrong: a
    double mixed with a decimal is a type error, not an inexact one, and
    `/` on two decimals is no operation; and a key written out, as
    `row["amount"]`, is a member's read, refused only when computed.

## Context

An integrator's coding agent writes report templates. Without help it
writes them from memory of other report writers: a field typed as a
float, a second detail dataset, a word translated by a key it invented.
The format refuses each, but a model corrects what it is told in the same
turn and forgets what it wrote three turns ago. formancy gave its agents
the checks, not the API (formancy.ai 0056): `@formancy/mcp`'s tools check
before they act, and the checking half needs no server; formancy.ai 0112
made them say what they do, answer in structure and ship the order of
operations as prompts.

Report has more to check than a form: the validator, the compiler's
diagnostics, each language's, the runtime's refusals and the renderer's,
a page break the PDF alone shows. Its edits are commands, run through one
registry (`describedCommand`) and a session that refuses a stale edit
(0008). Its server keeps a draft per template, saved from the version it
names ([0049](0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)).

`@formancy/mcp` 0.14.0 is a form's server: its tools are forms', and it
registers all of them. Its shape -- tools as plain functions, a thin
registration, one result envelope, asserted descriptions, annotations, a
document arriving unchecked to be judged by the format's own validator
-- is the part worth taking, and it is a pattern, not a package.

## Decision

**`@formancy/report-mcp`, a published package with a `bin`,
`formancy-report-mcp`, is Report's own server over the Model Context
Protocol, on the SDK at exactly 1.32.2 and zod at exactly 4.6.7, and its
tools check before they act.**

- **Where.** `packages/report-mcp`, Node, over stdio. It depends on
  report-spec and report-core; the render check, 0089's, brings the
  runtime, the renderer and PDF.js, and the server half the client.
  The sketch draws it in a row above the L3 packages, where it stands once
  it depends on them.
- **The tools that need nothing**, built:
  - `describe_format`, report-core's `reportFacts()`: the format's
    vocabularies, the names an expression reads in each place and the CEL
    type each field is read as, every diagnostic's code and severity, the
    bounds a report is refused past, each under its constant's name, and
    notes for what a model gets wrong first, each number in them read from
    its constant.
  - `validate_report`, a report judged as the validator and a render
    judge it: the validator's errors, which a save refuses; the report's
    size as report-spec measures `MAX_REPORT_BYTES`, the UTF-8 length of
    its JSON, past which a save refuses the body as `report-too-large`
    before reading it; then `diagnose`'s, which gives the report's own and
    each declared language's, each of the latter naming its language,
    split by that name, so that nothing is diagnosed twice; and the
    report's `reportHash`. What a save asks of the server's own state
    stays on the server, and the tool's description says so, as
    formancy.ai 0056 asks of a check that stays there: the report's id
    being the template's, `template-id-mismatch`; every image it declares
    kept by the tenant as the kind it declares, and no font, since no
    store keeps one, `asset-not-kept` (0049).
  - `describe_commands`, report-core's `describeCommands()`: every command
    of `COMMANDS` in its order, written as a descriptor is,
    `{ command, args }`, each argument in the words `ARGUMENTS`' shapes
    are refused in; `MAX_BATCH_COMMANDS`, `PART_COMMANDS` and
    `REFUSAL_CODES`.
  - `apply_commands`, a session opened on the report given and the
    commands applied as one batch through `describedCommand`, with an
    optional `expectedHash`: the new report, its hash, its size, its
    diagnostics and whether it changed; or the refusal's code, sentence,
    path and errors, and the hash of the report as given, nothing
    applied -- but a stale edit, `stale-document`, answers no hash, whose
    retry would disarm the check, and tells the agent to validate the
    report it means to edit.
- **The tools that need a server**, decided, not yet built: `whoami`,
  `list_templates`, `read_draft` and `save_draft`, through report-client;
  `save_draft` runs the validator first and sends nothing it refuses, and
  saves with `If-Match` from the version given, or `If-None-Match: *` for
  a first save.
- **Documents arrive unchecked**, `z.unknown()`, and are judged by
  report-spec's `validateReport`, the one authority; commands by
  `describedCommand`, a list of them by zod alone.
- **One envelope**, `{ ok, summary, data }`, as text for the model and as
  structured content: `ok` false for a refusal, for a report past
  `MAX_REPORT_BYTES`, and for a report `validate_report` finds the
  validator or a render would refuse -- an edit applied is `ok` though its
  report has a diagnostic error, since a language just added lacks every
  word until the next edit, but not past the bound, which no save takes
  -- and a refusal `isError`, never a thrown error; an edit applied is
  never `isError`, below.
  The text's JSON has no indentation, since a report is the largest thing
  in it. `TOOL_DEFINITIONS` is exported and asserted. Every tool built is
  annotated read-only and closed-world, `apply_commands` among them, which
  answers a new report and keeps none. The server's name is
  `formancy-report`, its version the manifest's.
- **Added 2026-11-27: an edit applied is no error.** B1's re-review
  (N-D) found an edit that grows a report past `MAX_REPORT_BYTES`
  answered `isError: true`, though it was applied and its answer holds
  the report it made. MCP's `isError` says the call ended in an error,
  and formancy.ai 0112 sets it for a refusal, "an answer the model should
  read and act on"; neither is an edit made. A client may fold an error's
  content away, or a model retry what failed, and either loses the report
  the agent has to bring back within the bound. So such an answer is
  `ok: false` -- something to fix before a save -- and `applied`, which
  `server.ts` answers with no `isError`; every refusal, and
  `validate_report`'s verdict of a report a save or a render refuses, as
  upstream's `validate_form`, stays `isError`. `server.test.ts` holds it
  through the protocol, and failed first on the answer as it was.
- **Two prompts** arrive with the server, exported as `PROMPTS`:
  `write_a_report`, the format first, then the report, then
  `validate_report` until it answers ok, every later change through
  `apply_commands`; and `translate_a_report`, from the `word-missing`
  diagnostics a language lists, through `addLanguage`, `translateWord`
  and `translateExpression`, printed from the descriptors
  `translationSteps` makes. Every tool a prompt names is one the server
  registers, which formancy.ai 0112 left unchecked.
- **The composition root.** `main.ts` is the bin and the only module that
  touches the process; it reads no setting yet. `server.ts` reads one
  file, the package's own manifest, for the version it reports. No module
  reaches the network or writes to the console, since standard output is
  the protocol's.
- **The bound on a call.** The SDK's stdio transport reads at most
  `STDIO_DEFAULT_MAX_BUFFER_SIZE`, 10 MiB, of one message, forty times
  `MAX_REPORT_BYTES`; past it the transport closes and the process ends
  without an answer, so an agent that sends more loses the server for the
  rest of its session. `maxToolInputElements`, new in the SDK's 1.32.0,
  is left unset: the client is the person's own, over stdio, and what a
  tool reads is bounded by the validator and the size check.
- **Identity, for the server half, is the host's, for a person.**
  `main.ts` will read `FORMANCY_REPORT_URL` and `FORMANCY_REPORT_TOKEN`,
  both or neither; the token a secret reference, `env:NAME` read once or
  `file:/absolute/path` read before each request, so a host's own tool can
  refresh it. The token is the person's who runs the agent, as their host
  issues it, and what the agent saves is saved as them. Nothing mints,
  refreshes, logs or writes the token; stdout is the protocol's, and
  stderr names no value.
- **Never**: publish -- no tool does, and the routes the server half's
  client may ask will be a list of `ROUTES` without `version.publish`;
  fetch by address or read a path -- no input carries a URL, a path or a
  file name, and an asset's bytes will come in the call, held to the
  digest the report declares; send anything to any host but the
  configured server.
- **The pins.** The SDK at 1.32.2 and zod at 4.6.7, each past the
  advisories published against the releases formancy's `@formancy/mcp`
  0.14.0 resolves, 1.30.1 and 4.6.5, which the design first measured:
  1.32.0 fixed the SDK's, 4.6.6 zod's. Of what this package calls, the
  SDK's release notes from 1.30.1 to 1.32.2 change only that a call of a
  tool or a prompt may omit its arguments and that a transport's optional
  properties are declared `| undefined`.
- **The licences.** The SDK and zod are MIT, judged as any package by
  `scripts/dependency-licences.mjs` on this repository's lockfile. With
  the SDK, its production closure as the lockfile installed it on 27
  November 2026 is 92 packages, MIT 82, ISC 7, BSD-3-Clause 2 (`fast-uri`,
  `qs`) and BSD-2-Clause 1 (`json-schema-typed`), 84 of which no other
  published package reaches. The guard's rules are 0006's, unchanged.

## Consequences

**What it buys.** An agent writes a template against the checks that
will judge it, before anything is stored, and the checking half works
with no server deployed: an integrator can have an agent write, validate
and edit a report by commands before deciding to run Report's server. An
edit made by an agent runs through the builder's own registry and
session, so an agent and a click cannot do the same thing two ways, and
what an agent is told of the format and the commands is what report-core
derives from its own constants, so a kind or a command added there is
one the agent is told about.

**What it costs.** **`validate_report` is not a save.** What a save asks
of the server's own state -- the report's id, the images it keeps, no
font -- is answered only by the server, as `template-id-mismatch` or
`asset-not-kept`, after the fact. **A package's worth of dependencies for an agent**:
the SDK ships its HTTP transports in one package, so Express, Hono, CORS,
a JSON Schema validator and their closure, 84 packages no other published
package reaches, are installed for a server that speaks stdio alone.
Those are ranges inside the SDK's manifest, so what a consumer installs
moves with npm, as the SBOM says (0017). **The SDK's declarations name
the DOM's `HeadersInit`**, which Node's types 22 do not declare as a
global, and report-mcp's own declarations name the SDK's `McpServer`,
which reaches it: a host that type-checks either with `skipLibCheck` off
and Node's types alone is refused that name until it declares it, as the
install gate's host does in `scripts/install-fixture/mcp-globals.d.ts`,
or skips library checks. **`describe_commands` says each argument's
shape**, a string, an object, a location, and not what it is for: which
string of `updateComponent` is the component's id is report-core's
declarations' and README's to say, and a model that guesses is refused
`not-found` or `kind-mismatch`. **A refused batch answers the first
refusal word for word**, which names what was refused but not which of
the commands it was. **`apply_commands` answers the whole new report**,
in the text and again in the structured answer, so a report near
`MAX_REPORT_BYTES` goes out twice on every edit, up to twice that bound
of a model's context. **A message past 10 MiB ends the server** for the
rest of the agent's session, with no answer. The
tool descriptions and the prompts are asserted for what they say, never
for whether a model follows them: nothing here runs a model against the
tools. The bin has been launched by the SDK's stdio client alone -- in the
install gate, and by hand on Windows -- and by no agent's client. A
second MCP server in the formancy family carries its own envelope and
annotations, twenty lines formancy's has too. The start page's "no AI
proposes changes for a person to review" stays true: nothing here
proposes anything for a review, and an agent's edit is applied to the
report it holds, which nothing keeps. **For the server half, an agent
will hold a person's token**, and can do whatever that person may -- save
over a colleague's draft from the version it read, at the person's name.
A host decides how long such a token lives and in which tenant.

**What it forecloses.** A tool that publishes, a tool that takes an
address, and a server over HTTP, until a record decides each.

## Alternatives considered

**Extend `@formancy/mcp`.** Register Report's tools on formancy's server:
an agent would see a form's tools beside a report's, formancy's core would
enter Report's install, and Report's server would depend on formancy's for
twenty lines of envelope.

**Wrap the REST API and stop there.** What a model gets from it is a 422
after the fact; formancy.ai 0056 lost it for that.

**Describe the format in zod.** A second authority on what a report is,
which would one day refuse a report report-spec accepts.

**Call `languageDiagnostics` for each language after `diagnose`.** The
draft of this record said so; `diagnose` already gives each declared
language's diagnostics, each naming it, so the languages would be
diagnosed twice and listed twice.

**Tools in report-server.** The checks would need a deployed server,
which is the half of the value that should need nothing.

**A token read once at start.** Simpler, and a token that expires
mid-session leaves the agent refused until the person restarts it.

**An OAuth flow in the MCP.** The host's identity provider, not Report,
decides how a person signs in; the MCP would hold a client secret and a
refresh token of its own.
