# 0088 — An agent gets Report's checks over the Model Context Protocol, from a server of Report's own

- **Status:** accepted for the tools that need nothing, the prompts and report-core's two derivations; its server half, the four tools that read and save a template's draft through report-client as the person whose token the host gives, and the two settings they ask with, built on 2026-11-28, and after its review the same day a save gated on what an agent can fix, a language that lacks words saved and its payment-part words named for a person, a refusal rebuilt from its code by report-client, its field held to what the server writes there, a template held to the id rule, an error of its own where a person writes named for the person, and both prompts stopping once nothing but the payment part's words is left; a verdict's languages diagnosed from one diagnosis of the report, 2026-11-28; its render check is [0089](0089-the-mcps-render-check-reads-the-pdf-back-with-pdfjs-at-the-corpuss-pin-the-first-published-package-that-carries-it.md)'s; an edit applied past the size bound answered as no error, 2026-11-27; a language's words in the payment part listed for a person and left out by the translate prompt, 2026-11-28; extends [0008](0008-edits-are-commands-and-a-refused-edit-changes-nothing.md); follows formancy.ai 0056 and 0112
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
    past it is applied and not `ok`, and says it was `applied`; and, on
    the invoice in French, the slip's message listed in the language's
    `forPerson`, and none of the `word-missing` an agent is left to
    translate standing in the payment part. The rule `forPerson` is
    listed by is report-core's `missingWords`, held by
    `packages/report-core/src/diagnostics/words.test.ts`: each
    `word-missing` read back to its source, a word that stands first
    elsewhere and in the payment part among the payment part's, and an
    expression printed as a number in the body and as words in the slip's
    message among them too, which failed first on 28 November 2026 matched
    at its first place alone, as report-mcp's own copy of the rule
    matched it.
  - **Through the protocol.** `packages/report-mcp/src/server.test.ts`,
    with the SDK's own `Client` over its `InMemoryTransport`: without a
    server, the five tools that need nothing listed, and the instructions
    naming the four that are missing and both settings that bring them;
    given one, the nine, each with the description `TOOL_DEFINITIONS`
    holds and saying when to call it; the five annotated read-only and
    closed-world, whoami, list_templates and read_draft read-only and
    open-world, save_draft not read-only, not destructive and not
    idempotent, and none named for publishing, sending or fetching;
    every tool declaring the one envelope; no input schema holding, at any
    depth, a property named for an address, a path or a file, or a string
    of format `uri`, and no prompt an argument so named, the walk shown to
    find each; a report taken as any JSON value, save_draft's among them;
    a draft saved, read back and a save from the version since replaced
    refused `draft-changed` as `isError` with the revision that stands,
    `If-None-Match: *` then `If-Match` sent, and a report the validator
    refuses never sent, each through the protocol; the server's version the
    manifest's; arguments surviving the round trip, and a refusal arriving
    as `isError` with its structure, and an edit applied past
    `MAX_REPORT_BYTES` arriving not `ok`, with the report it made, and no
    `isError`; `validate_report`'s description
    saying what a save asks of the server that it does not check; the two
    prompts, each naming only tools the server registers, writing in the
    order the format, the report, the checks, and translating from
    `word-missing`, leaving out what `validate_report` lists in
    `forPerson`, through descriptors `translationSteps` makes, typed by
    report-core's `StepDescriptor`, which the case applies through the
    registry to a starter that prints words by an expression.
  - **The composition root.** `packages/report-mcp/src/composition.test.ts`,
    read with TypeScript's parser, every directory of `src/` read and a
    module named by its path in it: each module imports only the
    specifiers its list names -- `tools.ts` report-core and report-spec;
    `server.ts` `node:module`, the SDK's `server/mcp.js`, `shared/stdio.js`
    and `types.js`, report-client and report-core for types, the runtime
    for its modes, zod, `./drafts.js`, `./render.js`, `./settings.js` and
    `./tools.js`; `drafts.ts` report-client for types, report-server-core,
    report-spec, `./settings.js` and `./tools.js`; `settings.ts`
    `node:path` and report-client, the one module that makes a client;
    `main.ts` `node:fs/promises`, the SDK's `server/stdio.js`,
    `./server.js` and `./settings.js`; `index.ts` its four modules;
    `render.ts` and `pdf-text.ts` as 0089 says -- and
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
    module in a directory of `src/`, which the walk had not read; and,
    with the server half, report-client's `createReportClient` imported,
    re-exported or loaded by `import()` anywhere but `settings.ts`,
    `globalThis.fetch` in `drafts.ts`, `process.env` and `console` in
    `settings.ts`, and `node:fs/promises` anywhere but `main.ts`.
  - **The server half, as functions.** `packages/report-mcp/src/drafts.test.ts`,
    against report-server itself, made in the suite's process over a file
    store of its own and asked through a fetch that records each route, its
    headers and its body before it hands the request on: the routes the
    four tools ask are exactly `MCP_ROUTES`, each a route of `ROUTES` and
    none a version's, and no case asks another; whoami answers the token's
    holder and whether save_draft is theirs, and roles the operator gave
    nothing; an expired token is `unauthenticated` on whoami, the list and a
    read, said with what to do; a template saved is listed, and its draft
    read with its version, `savedBy` and the hash apply_commands then takes;
    a template with no draft is `no-draft`, said with the first save; a
    save sends `If-None-Match: *` for no version and `If-Match` from the
    version given, as `draftTag` writes it; a report the validator refuses,
    one past `MAX_REPORT_BYTES`, one whose own diagnostics refuse a render
    and one with a language's error that is no word missing, a translation
    of another type, are answered as validate_report answers them and
    never sent; the French invoice, every word translated but the slip's
    message, `'Rechnung '`, is saved, its answer naming that word for the
    person, which failed first while the gate was validate_report's `ok`;
    a draft a person saved in a builder with a language unfinished takes
    an agent's one-word fix; a template that is no report id -- `..`,
    `.`, a lone surrogate, nothing -- is refused `template-id-invalid`
    before anything is sent, where `..` had asked `GET /v1/draft`; each
    tool works given the one method of the client it asks, which its
    parameter's type is; a save from a version since replaced, and
    a first save of a template that has a draft, are `draft-changed` with
    the revision that stands, and one from a version of a template with
    none with none standing, nothing written; a `from` that is no version is
    refused before anything is sent; `template-id-mismatch`,
    `asset-not-kept` and `forbidden` are answered by their codes with what
    to do, and a refusal with nothing more by its own sentence; and a
    gateway's page on each route is said as no answer of the API, naming
    the route, a save with no answer as not known to be written, a throw of
    what is no error as such, and a 2xx of another shape -- a whoami, a
    list, a draft of another format or template, a save that answers
    another template or revision 0 -- and a draft whose report this release
    refuses are each said and handed on in nothing; an `asset-not-kept`
    naming an asset the report sent does not declare is no answer of the
    API, its ids handed on in nothing; and an error of the report's own in
    the payment part, an amount reading a field that is not there, refuses
    the save and is named for the person, in the summary and as
    `forPerson`, which failed first named for nobody.
  - **The settings.** `packages/report-mcp/src/main.test.ts`, `main.ts`
    itself imported afresh for each start, the environment stubbed, its
    standard streams watched and the stdio transport replaced by one end of
    the SDK's in-memory pair, report-client's global fetch by one that
    answers as the API does and records what it was asked: neither setting,
    or both set empty, starts with the five tools and instructions that
    say why the four are missing, asking and writing nothing; one without
    the other stops with one line naming both and quoting neither, exit 1;
    both register the four, asking the URL's server with the token a
    variable held at start, though the variable changes after; a token
    pasted where its reference goes, or in capitals after `env:`, a
    variable unset, misnamed, under `FORMANCY_REPORT_` or holding no bearer
    token, a relative file and a URL with a password each stop the bin by a
    sentence that quotes no value; a file's token is read again before each
    request, its one line ending taken off; a file gone, empty or holding
    no bearer token sends nothing and says that nothing was sent, of a
    save too, naming the setting and not the path; and a token planted in
    the file, carried by every request, is in no answer, no instruction, no
    tool's description and nothing written, on every path -- answered,
    refused 401, a gateway's 401 under the API's code that quotes it in its
    sentence and in a key of its own, a gateway's page that quotes it, a
    network failure whose message quotes it, a save refused
    `draft-changed` and one saved -- a network failure said by Node's code
    alone. `src/settings.test.ts`: a token's file named, on POSIX, by an
    absolute path, and on Windows by a drive and its root or a share,
    never by the root alone or a drive alone, nor by a share whose server
    holds a colon, as `file://C:/token` gives, which had passed as a share
    on a server `C:`.
  - **A refusal rebuilt from its code.** `packages/report-client/src/client.test.ts`:
    a 401 whose JSON body quotes a planted token in its sentence and in a
    key of its own, and a 412 that quotes it beside its revision, are
    answered with `REFUSALS`' fixed sentence and the one field the code
    carries, the token in neither; that field read as what the server
    writes there -- each error of `report-invalid` a code of report-spec's
    `REPORT_ERROR_CODES` with a path, a sentence and a component's id, and
    nothing else of it; each asset of `asset-not-kept` an identifier; the
    reason of `image-refused` one of report-spec's image and SVG refusal
    codes or the server's own `not-an-image` -- a token riding in an
    error's code, an asset or a reason thrown as no answer of the API, and
    in an error's key of its own dropped, which had all been handed on;
    and the server's own `not-an-image` answered as the refusal it is;
    every code `REFUSALS` holds, sent with a token in its sentence and a
    key of its own, answered as its fixed sentence, or thrown for the four
    that carry a field and were sent none, which the case lists; `FIELDS`
    typed over every code `ServerRefusal` gives a field, so that a code a
    release gives one and the rebuild does not read fails to compile,
    which it did with `image-refused`'s entry taken out;
    `isBearerToken` the rule a request is held to. What it cannot hold is
    an error's sentence, the validator's own words about the requester's
    report, which a gateway answering under `report-invalid` could fill.
  - **The client's whoami.** `packages/report-client/src/client.test.ts`:
    `whoami()` against report-server answers the token's holder with the
    tenant, the roles, and the capacities and actions the policy gives
    them, roles given nothing answered with none, and an expired token
    `unauthenticated`; sent as a GET with the bearer and no body.
  - **One diagnosis.** `packages/report-core/src/diagnostics/diagnose-by-language.test.ts`:
    `diagnoseByLanguage` gives the report's own diagnostics, each declared
    language's and what each lacks, equal to what `diagnose`,
    `languageDiagnostics` and `missingWords` give, and diagnoses the report
    given once however many languages it declares, where `diagnose` and
    `missingWords` once a language diagnosed it once a language more.
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
    hash refused, and reads the version the tarball carries; and, since
    the server half, the host holds the packed report-server beside it:
    with one setting alone the packed `dist/main.mjs` stops with one line
    and exit 1, and with both, beside that server on a socket, the bin
    lists the nine, says who the token's holder is, saves a draft, reads it
    back, saves it again from that version as the holder of the token the
    file holds by then -- read again before the request -- and has a save
    from the replaced version refused `draft-changed` with revision 2
    standing.
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
    `row["amount"]`, is a member's read, refused only when computed. With
    the server half: report-client without `whoami`; `diagnoseByLanguage`
    before it was written; the drafts suite before `drafts.ts`; the server
    suite before the four were registered, and the settings' cases before
    `main.ts` read them; the guard before `drafts.ts` and `settings.ts` had
    lists; the install plan before the server stood beside the MCP; and,
    planted in the real modules one at a time, a save sent though
    validate_report refused it, a save from a version sent with
    `If-None-Match: *`, `draft-changed` answered without the revision that
    stands, `MCP_ROUTES` holding the image's keep, a 2xx of another shape
    handed on, a file's token read once, a network failure quoted as fetch
    gave it, the four registered without a server, save_draft annotated
    read-only and the guard's rule that report-client is named for its
    types alone dropped, each caught by its case; and a pasted token quoted
    in the sentence that refuses it, which passed until the case that
    refuses it looked for the token in what the bin wrote. After #116's
    review: the French invoice lacking the slip's message alone, and a
    person's draft with a language unfinished, each refused while the gate
    was validate_report's `ok`; `..` asking `GET /v1/draft`; a 401 whose
    body quoted the token in its sentence and a key of its own handed on,
    through report-client and through the MCP's answer; a save whose token
    file was gone said not known to be written; a variable's token with a
    line ending, and a token pasted in capitals after `env:`, which the
    sentence quoted, each starting the bin or quoted; `isBearerToken` and
    `isFilePath` before they were exported; and each tool given the one
    method it asks, which did not compile while it took the whole client.
    After the re-review: both prompts' stop conditions, which could be met
    only by writing the payment part's words; a token riding in an
    error's code, an asset and an image's reason, and an error's key of
    its own, each handed on by report-client; an `asset-not-kept` naming
    an asset the report did not declare, handed on by the MCP; an error of
    the report's own in the payment part named for nobody; and
    `//C:/token` read as a share.

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
  runtime, the renderer and PDF.js, and the server half report-client and
  report-server-core, whose wire types and `ROUTES` the tools read.
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
    before reading it; then report-core's `diagnoseByLanguage`, the
    report's own diagnostics and each declared language's with what it
    lacks, from one diagnosis of the report, so that nothing is diagnosed
    twice; and the report's `reportHash`. What a save asks of the server's own state
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
- **The tools that need a server**, built on 2026-11-28, in `drafts.ts`,
  each a function of a report-client: `whoami`, who the server takes the
  token's holder to be and whether `draft.save` is among their actions;
  `list_templates`, the tenant's templates by id; `read_draft`, a
  template's newest draft with its version `{ revision, digest }`, who
  saved it, and its report's `reportHash`, which `apply_commands` takes;
  and `save_draft`, a report judged first by tools.ts's `judgedForSave`
  and sent unless it holds what an agent can and should fix: the
  validator's errors, the size bound, a diagnostic error of its own, and a
  declared language's error other than a word it lacks, as
  `translation-differs` (formancy.ai 0056). A draft is unfinished by
  nature, and a word missing refuses that language's render and no save,
  as a builder and the server hold a report being translated (0063): a
  report whose languages still lack words is saved, and the answer names
  each such language, how many words it lacks, and of them those that
  stand in the payment part, `forPerson`, which a person writes, so the
  agent asks the person. An error of the report's own that stands in the
  payment part or the e-invoice, which a person's draft can bring -- an
  amount reading a field since removed -- refuses the save as any error
  of its own does, and is named for the person, `forPerson` in the
  refusal's data. It is sent from `from`, the version it replaces,
  with `If-Match`, or with none, as the template's first, with
  `If-None-Match: *` (0049); a `draft-changed` answered with the revision
  that stands, `standing`, and what to do. A template is held to
  report-spec's `isIdentifier`, the server's own `template-id-invalid`
  rule, before anything is sent, since `..` would be resolved by fetch's
  URL parser into another route. Each tool takes the one method of the
  client it asks, a `Pick` of `ReportClient`, so that no other route can be
  asked from `drafts.ts`. The routes they ask are
  `MCP_ROUTES`, typed by `ROUTES`' own keys: whoami, the list, a draft's
  read and its save, and no image's keep or read and no version's.
  Registered only where the server is given a client: without one, they
  are not there to be called and refused, and the server's MCP
  instructions, which a client may hand its model, say they are missing and
  which two settings bring them; with one, the instructions say what
  save_draft saves is saved as the token's holder. whoami, the list and a
  read are annotated read-only and open-world; save_draft not read-only,
  never destructive, since every revision is kept beside the ones before
  it (0049), and not idempotent.
- **What the server answered is read, never guessed.** A 2xx is held to
  the wire type report-server-core gives its route as far as a tool reads
  it -- strings, `isRevision`'s revisions, report-spec's `isDigest`'s
  digests, `DRAFT_FORMAT`, the template asked -- and a draft's report to
  report-spec's validator, since the server serves a draft as it was
  saved and never validates it again (0049); what is none is said, naming
  the route, and nothing of it handed on. A refusal is answered with its
  status, its code and its sentence, and, for those an agent can act on
  -- `unauthenticated`, `forbidden`, `no-draft`, `asset-not-kept`,
  `template-id-mismatch` -- what to do; report-client rebuilds every
  refusal from its code, `REFUSALS`' fixed sentence and the one field the
  code carries, never the body's own sentence or any other key, which a
  gateway in front of the server may fill with what the request carried
  (#116's review, F2). What report-client throws is said
  by its own sentence, which names a route by its pattern and quotes no
  token, or the token reader's; a failure of the network, which fetch
  throws as a `TypeError`, by a sentence of this package's and Node's code
  alone, since fetch's message is not this package's to vouch for. A
  token the settings could not give, `TokenUnavailable`, is said with
  nothing sent; any other throw, and a save with no answer above all, is
  said not known to be written, with read_draft to see which revision
  stands.
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
  in it. `TOOL_DEFINITIONS` is exported and asserted. Every tool that
  needs nothing is annotated read-only and closed-world, `apply_commands`
  among them, which answers a new report and keeps none; the server
  half's are below. The server's name is
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
- **Added 2026-11-28: the payment part's words are a person's.** The
  translate prompt told an agent to translate every `word-missing` a
  language lists, and report-core's `missing()` walks the QR-bill's
  message, a word (0063) that prints on the slip and is encoded in the
  code a bank reads: on the invoice starter an agent would have written
  French into it, which no proposal may change (0039, 0048) and report-ai
  never asks a model for (0085). `validate_report` now lists, for each
  language, what it lacks that stands anywhere in the payment part,
  `forPerson` -- a word that also stands elsewhere among them, since a
  word is translated once -- by report-core's `missingWords`, the one rule
  report-ai's request reads too (0085): each `word-missing` read back to
  its source through report-spec's one walk of a report's words and
  expressions, and matched at any place it stands, since an expression's
  stands at its first site that prints words, which need not be its
  first. Each package held a copy of the rule while 0085 was on a branch
  of its own, and report-mcp's matched an expression at its first site
  alone, so that one printed as a number in the body and as words in the
  slip's message was offered to the agent to translate; both copies are
  gone. The prompt tells the agent to leave those out and name them to
  the person, and the description says so; an e-invoice's texts are no
  words in that walk. `tools.test.ts`
  holds it on the invoice, and failed first on the verdict without it.
  It is a request to the agent and no refusal: the agent acts for a
  person, who may choose the slip's text in another language, so
  `apply_commands` applies a `translateWord` of the payment part's words
  as a builder's field does, and the word is then listed for nobody --
  where report-ai, which asks a model, drops such an entry from its
  proposal (0085). `tools.test.ts` holds that too.
- **Added 2026-11-28: one diagnosis for a verdict.** #112's re-review
  (N-H) measured each `validate_report` and `apply_commands` diagnosing
  the report once more for every declared language, through
  `missingWords`, which diagnoses it again on each call: about +80 % on a
  starter in twenty-three languages, the most a report may declare.
  report-core's `diagnoseByLanguage` gives the report's own diagnostics,
  each language's and what each lacks from one diagnosis of the report,
  each language's written report diagnosed once as `diagnose` diagnoses
  it, and the verdict reads it. Measured on 28 November 2026 under Node
  24.21 on an Intel i9-10900K on Windows, against report-core's built
  `dist`, each starter given twenty-three empty translations, the three
  ways interleaved, ten runs of each after two, by a script kept outside
  the repository whose method this is: `diagnose` alone, the old way -- `diagnose`,
  then `missingWords` once a language -- and the new, `diagnoseByLanguage`,
  each as minimum, mean and maximum in ms. The invoice: 40, 46, 56; 74,
  81, 103; 42, 46, 50. The sales report: 33, 35, 44; 59, 65, 78; 33, 37,
  40. The quotation: 58, 61, 67; 110, 117, 134; 59, 63, 73. The old way
  cost 76 to 92 % more than `diagnose` by its means, every run of it
  above every run of `diagnose`; the new way's runs overlap `diagnose`'s
  spread, their means 0 to 2 ms above it, so what the record claims is
  the extra diagnoses gone, and not a cost of `diagnose`'s alone.
- **Two prompts** arrive with the server, exported as `PROMPTS`:
  `write_a_report`, the format first, then the report, then
  `validate_report` until it answers ok, or nothing is left but the words
  it lists in `forPerson`, which the agent names to the person, every
  later change through `apply_commands`; and `translate_a_report`, from
  the `word-missing` diagnostics a language lists, through `addLanguage`,
  `translateWord` and `translateExpression`, printed from the descriptors
  `translationSteps` makes, stopping once nothing is listed but what
  `forPerson` names, which the agent names to the person: a stop on
  nothing listed at all could only be met by writing the slip's words
  (#116's re-review, F11). Every tool a prompt names is one the server
  registers, which formancy.ai 0112 left unchecked.
- **The composition root.** `main.ts` is the bin and the only module that
  touches the process: it reads the environment once and hands it, with
  Node's reader of files, to `settings.ts`, which parses the two settings
  and makes the one report-client, at the server the setting names; no
  other module makes one. `server.ts` reads one file, the package's own
  manifest, for the version it reports. No module names the network --
  the server half reaches it through report-client alone, whose own
  default is the global fetch -- or writes to the console, since standard
  output is the protocol's; the bin writes to standard error only the
  problems it stops on, one line each, naming a setting and never a
  value.
- **The bound on a call.** The SDK's stdio transport reads at most
  `STDIO_DEFAULT_MAX_BUFFER_SIZE`, 10 MiB, of one message, forty times
  `MAX_REPORT_BYTES`; past it the transport closes and the process ends
  without an answer, so an agent that sends more loses the server for the
  rest of its session. `maxToolInputElements`, new in the SDK's 1.32.0,
  is left unset: the client is the person's own, over stdio, and what a
  tool reads is bounded by the validator and the size check.
- **Identity, for the server half, is the host's, for a person.**
  `FORMANCY_REPORT_URL` and `FORMANCY_REPORT_TOKEN`, both or neither, a
  variable set empty an unset one: neither starts the five tools alone,
  one without the other stops the bin, as formancy's `main.ts` does. The
  URL is held to report-client's rule of a base URL, said in its own
  sentence, which quotes none. The token is a secret reference, as
  report-server's are: `env:NAME`, its name in upper case, digits and
  underscores and never under `FORMANCY_REPORT_`, read once when the bin
  starts and refused there where it is unset or empty or no bearer token
  by report-client's own rule, `isBearerToken`, a sentence naming neither
  the variable nor its value, since a token pasted there in capitals is a
  name to that rule; or `file:/absolute/path` -- on Windows from a drive
  and its root or a share whose server holds no colon, since a path from
  the root alone is read from whichever drive the bin runs on and
  `file://C:/token` would name a server `C:` -- read again before each request, its
  one line ending taken off, so that a host's own tool can write the next
  token there before the last expires; anything else, a token pasted
  where its reference goes among it, is refused at start by a sentence
  that quotes none of it. A file that cannot be read, is empty or holds no
  bearer token sends nothing, and is said naming the setting, not the
  path. The token is the person's who
  runs the agent, as their host's identity provider issues it, its
  lifetime and its tenant the host's, and what the agent saves is saved as
  them, `savedBy` the token's subject. Nothing here mints, refreshes, logs
  or writes the token; standard output is the protocol's, and standard
  error names no value.
- **Never**: publish -- no tool does, and the routes the server half asks
  are `MCP_ROUTES`, none a version's, which a recording fetch holds;
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
holds a person's token**, and can do whatever that person may -- save
over a colleague's draft from the version it read, at the person's name.
A host decides how long such a token lives and in which tenant, and
whether its identity provider issues one for a coding agent at all.
**A token in a variable is read once**, so one that expires leaves the
agent refused `unauthenticated` until its client starts the bin again; a
token in a file costs a read of it before every request. **An agent
saves a draft a render would refuse in a language that lacks words**:
the save is gated on what an agent can fix, and a language's words are
written over turns, so a saved draft may still be refused a render in
that language until somebody writes them -- the payment part's by a
person, whom the answer names them to. A draft with an error of its own,
or a language's error that is no word missing, is not saved until the
agent fixes it. **No tool keeps an image**, so a report
that declares one the server does not keep is refused `asset-not-kept`
until a person adds it in a builder, and one that maps a font is refused
as every draft that maps one is (0049). **read_draft answers the whole
report**, in the text and again in the structured answer, as
apply_commands does. **Without the settings the four are not
registered**: an agent whose client does not hand its model the server's
instructions is not told why it cannot save. **What the server answered
that the client cannot read is said and not read**: behind a gateway
that answers for the server, an agent learns the route and the status
alone, and of a network that failed, Node's code alone; a save with no
answer is not known to have been written.

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
mid-session leaves the agent refused until the person restarts it. A
variable is read once all the same: a client hands the bin its
environment once.

**The server's tools registered without a server, each answering that
none is configured**, as formancy's `@formancy/mcp` 0.14.0 does. An agent
would be shown four tools that can only refuse, a host that runs
read-only tools without asking would see open-world tools where nothing
reaches the world, and the refusal would be learnt one call at a time;
the instructions say it once, before any call.

**save_draft sending only what validate_report answers ok**, as first
built. A word a language lacks is a diagnostic error, so an agent that
left the slip's message to a person, as the translate prompt tells it,
could never save the invoice in French, and one asked to fix a title in a
draft a person saved with a language unfinished could save nothing until
it wrote that language: the gate pushed an agent to invent translations,
or to write into the payment part. #116's review found it, and the gate
is now what an agent can fix.

**save_draft sending what the validator alone accepts**, the design's
first wording: a draft with an error of its own is a draft, and a builder
saves one. The owner's ask was that an agent saves only what was checked:
an error of its own, or a translation that differs, is the agent's to
fix before it saves, and a word a language lacks is not always its to
write.

**fetch's own message in the answer.** It names what failed more
precisely, and it is not this package's to vouch for: a fetch a host
wraps, or a later release of Node's, may quote what the request carried.

**Every language's missing words asked of `missingWords`.** One rule, as
now, and a diagnosis of the report for each language besides the one
`diagnose` makes; `diagnoseByLanguage` reads both from one.

**An OAuth flow in the MCP.** The host's identity provider, not Report,
decides how a person signs in; the MCP would hold a client secret and a
refresh token of its own.
