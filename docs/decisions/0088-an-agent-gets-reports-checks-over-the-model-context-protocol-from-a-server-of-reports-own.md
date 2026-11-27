# 0088 — An agent gets Report's checks over the Model Context Protocol, from a server of Report's own

- **Status:** accepted for the tools that need nothing, the prompts and report-core's two derivations; its server half, the tools that read and save a template's draft, is decided here and built by a later pull request, which states its own tests here when it lands; extends [0008](0008-edits-are-commands-and-a-refused-edit-changes-nothing.md); follows formancy.ai 0056 and 0112
- **Date:** 2026-11-27
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The facts are derived.** `packages/report-core/src/facts.test.ts`:
    `reportFacts()` lists the format by report-spec's and report-core's
    constants, the very objects, each bound the value of report-spec's
    constant of its name, every number a note says written from its
    constant; `describeCommands()` lists every command of `COMMANDS` in its
    order, each argument in the words `invalid-arguments` refuses it in,
    and `MAX_BATCH_COMMANDS`, `PART_COMMANDS` and `REFUSAL_CODES` as they
    are; both exported from the package.
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
    `stale-document`; an unknown command, wrong arguments and a batch
    inside the batch are refused by the registry; an empty list changes
    nothing, said as such; and a report the validator refuses has no
    command run on it.
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
    as `isError` with its structure; the two prompts, each naming only
    tools the server registers, writing in the order the format, the
    report, the checks, and translating from `word-missing` through
    report-core's commands.
  - **The composition root.** `packages/report-mcp/src/composition.test.ts`:
    no module but `main.ts` touches the process, the environment or a
    file, and none reaches the network, each read with TypeScript's
    parser and the reading shown to find each ordinary way in.
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
    manifests packed report-mcp; the sketch without report-mcp's box.

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
Protocol, on the SDK at exactly 1.30.1 and zod at exactly 4.6.5, and its
tools check before they act.**

- **Where.** `packages/report-mcp`, Node, over stdio. It depends on
  report-spec and report-core; a render check, a record of its own,
  brings the runtime and the renderer, and the server half the client.
  The sketch draws it in a row above the L3 packages, where it stands once
  it depends on them.
- **The tools that need nothing**, built:
  - `describe_format`, report-core's `reportFacts()`: the format's
    vocabularies, the names an expression reads in each place and the CEL
    type each field is read as, every diagnostic's code and severity, the
    bounds a report is refused past, each under its constant's name, and
    notes for what a model gets wrong first, each number in them read from
    its constant.
  - `validate_report`, three lists in the order a save, a render and a
    language's render judge: the validator's errors; then `diagnose`'s,
    which gives the report's own and each declared language's, each of
    the latter naming its language, split by that name, so that nothing
    is diagnosed twice; and the report's `reportHash`.
  - `describe_commands`, report-core's `describeCommands()`: every command
    of `COMMANDS` in its order, written as a descriptor is,
    `{ command, args }`, each argument in the words `ARGUMENTS`' shapes
    are refused in; `MAX_BATCH_COMMANDS`, `PART_COMMANDS` and
    `REFUSAL_CODES`.
  - `apply_commands`, a session opened on the report given and the
    commands applied as one batch through `describedCommand`, with an
    optional `expectedHash`: the new report, its hash, its diagnostics and
    whether it changed; or the refusal's code, sentence, path and errors,
    and the hash of the report as given, nothing applied.
- **The tools that need a server**, decided, not yet built: `whoami`,
  `list_templates`, `read_draft` and `save_draft`, through report-client;
  `save_draft` runs the validator first and sends nothing it refuses, and
  saves with `If-Match` from the version given, or `If-None-Match: *` for
  a first save.
- **Documents arrive unchecked**, `z.unknown()`, and are judged by
  report-spec's `validateReport`, the one authority; commands by
  `describedCommand`, a list of them by zod alone.
- **One envelope**, `{ ok, summary, data }`, as text for the model and as
  structured content: `ok` false for a refusal and for a report
  `validate_report` finds a save or a render would refuse -- an edit
  applied is `ok`, its new report's diagnostics beside it -- and a refusal
  `isError`, never a thrown error.
  The text's JSON has no indentation, since a report is the largest thing
  in it. `TOOL_DEFINITIONS` is exported and asserted. Every tool built is
  annotated read-only and closed-world, `apply_commands` among them, which
  answers a new report and keeps none. The server's name is
  `formancy-report`, its version the manifest's.
- **Two prompts** arrive with the server, exported as `PROMPTS`:
  `write_a_report`, the format first, then the report, then
  `validate_report` until it answers ok, every later change through
  `apply_commands`; and `translate_a_report`, from the `word-missing`
  diagnostics a language lists, through `addLanguage`, `translateWord`
  and `translateExpression`. Every tool a prompt names is one the server
  registers, which formancy.ai 0112 left unchecked.
- **The composition root.** `main.ts` is the bin and the only module that
  touches the process; it reads no setting yet. No module reaches the
  network.
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

**What it costs.** **A package's worth of dependencies for an agent**:
the SDK ships its HTTP transports in one package, so Express, Hono, CORS,
a JSON Schema validator and their closure, 84 packages no other published
package reaches, are installed for a server that speaks stdio alone.
Those are ranges inside the SDK's manifest, so what a consumer installs
moves with npm, as the SBOM says (0017). **The pins carry published
advisories**, as `npm audit` read them on 27 November 2026: the SDK
1.30.1 five, GHSA-6qxp-vccf-f47h, GHSA-22jm-h49p-29qw, GHSA-46jr-4wx8-v453,
GHSA-rvq5-wwqv-78pq and GHSA-6prh-2h8m-c8cw, all fixed by 1.32.0, each
about a path this package does not take -- the OAuth client, experimental
tasks, an HTTP server's validation or bearer authentication, an HTTP
client transport -- and the third saying a server over stdio alone is not
affected; zod 4.6.5 one, GHSA-mrhx-c7xc-m3w5, fixed in 4.6.6, the memory a
large array of elements that fail their schema takes, where this
package's one array schema takes any element and nothing here has read
whether the SDK's own schemas hold such an array. `npm audit` and
Dependabot name them in every project that installs report-mcp until the
pins move, which is a decision of its own: these are the releases
formancy's `@formancy/mcp` 0.14.0 resolves, which the design measured.
**The SDK's declarations name
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
`MAX_REPORT_BYTES` costs a model's context that much on every edit. The
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
