# @formancy/report-mcp

Formancy Report for a coding agent, over the Model Context Protocol: a
server a client launches, speaking stdio, whose tools let a model write
and change a report template against the checks that will judge it --
the format described, a report validated and diagnosed as the validator
and a render judge it and held to the size a draft may have, and
report-core's commands applied as the builders apply them, and the
report rendered with the data an agent passes in, each page's lines read
back from the PDF with PDF.js. Those tools need
nothing but their arguments: no server, no file, no network; the server
reads one file, its own manifest, for the version it reports, and the
renderer and PDF.js read their own. Given Report's server and the
person's token at their host, four more ask the server through
`@formancy/report-client`, as that person: who they are, the tenant's
templates, a template's draft, and a save, sent only once the checks
pass. Nothing here publishes, keeps an image or takes an address, no PDF
leaves it, and
no input names a URL, a path or a file. Decisions
[0088](../../docs/decisions/0088-an-agent-gets-reports-checks-over-the-model-context-protocol-from-a-server-of-reports-own.md)
and [0089](../../docs/decisions/0089-the-mcps-render-check-reads-the-pdf-back-with-pdfjs-at-the-corpuss-pin-the-first-published-package-that-carries-it.md)
are why, after formancy's `@formancy/mcp`
([formancy.ai 0056](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0056-agents-get-the-checks.md)).

Source-available, as every Formancy Report package: evaluating and
developing with it is free, running it in production is licensed
([`LICENSE.md`](../../LICENSE.md)).

## Add it to a client

A client that speaks MCP launches the bin, `formancy-report-mcp`, and
talks down its pipes. Installed in a project, it is that project's
`node_modules/.bin/formancy-report-mcp`; a client's configuration names
it as a command, as it names any MCP server:

```json
{
  "mcpServers": {
    "formancy-report": { "command": "npx", "args": ["--no", "formancy-report-mcp"] }
  }
}
```

`--no` keeps npx to the project's own install: without it, npx fetches a
package of that name from the registry when the project has none. The
bin writes nothing to standard output but the protocol.

## Give it Report's server

The four tools that read and save a draft are registered only where the
client's configuration gives the bin two settings, both or neither:

```json
{
  "mcpServers": {
    "formancy-report": {
      "command": "npx",
      "args": ["--no", "formancy-report-mcp"],
      "env": { "FORMANCY_REPORT_URL": "https://reports.example", "FORMANCY_REPORT_TOKEN": "file:/home/me/.config/reports/token" }
    }
  }
}
```

| Setting | What it is |
| --- | --- |
| `FORMANCY_REPORT_URL` | Report's server's base URL, `http:` or `https:`, with no credentials, query, fragment or trailing slash, as report-client takes one; it follows no redirect |
| `FORMANCY_REPORT_TOKEN` | A secret reference to the person's token at their host, never the token: `env:NAME`, a variable outside `FORMANCY_REPORT_`, read once when the bin starts; or `file:/absolute/path`, read again before every request to the server, its one line ending taken off |

The token is the person's who runs the agent, as their host's identity
provider issues it, with the tenant claim the server's operator maps and
a role that gives the author's capacity: what the agent saves is saved as
them, `savedBy` their subject, and the agent can do whatever their roles
allow. Its lifetime and its tenant are the host's; the bin mints,
refreshes, writes and logs none. A file lets the host's own tool write the
next token before the last expires; a variable's token is the one the bin
started with. One setting without the other, a token pasted where its
reference goes, a variable unset or under `FORMANCY_REPORT_`, a relative
file or a URL report-client refuses stops the bin at start, with a line on
standard error naming the setting and no value, and exit 1. With neither,
the five tools that need nothing are the bin's only ones, and the
instructions the server hands a client say which four are missing and
why.

## The tools

| Tool | What it answers |
| --- | --- |
| `describe_format` | report-core's `reportFacts()`: the version the package reads, the regions, the component kinds, the field and parameter types, the names an expression reads in each place and the CEL type each field is read as, every diagnostic's code and severity, the bounds a report is refused past, and the notes a model gets wrong first |
| `validate_report` | report-spec's `validateReport`, whose errors a save refuses; the report's size against `MAX_REPORT_BYTES`, the UTF-8 length of its JSON, past which a save refuses it as `report-too-large`; then report-core's `diagnose`, the report's own diagnostics, whose errors refuse every render, and each declared language's, whose errors refuse a render in that language alone, and of what each lacks, what stands in the payment part, `forPerson`, which a person writes and no agent translates; with the report's `reportHash`. What a save asks of the server's own state it leaves to the server: the report's id being the template's, every image it declares kept there, and no font |
| `describe_commands` | report-core's `describeCommands()`: every command of its registry, each written as the descriptor `{ "command", "args" }` is, its arguments in the words a refusal names them in; how many one edit holds; and `PART_COMMANDS`, the commands that may change whom a payment reaches |
| `apply_commands` | a session opened on the report given, and the commands applied as one batch through the registry the builders use: the new report, its hash, its size and its diagnostics, or the refusal's code, sentence and path, nothing applied; with `expectedHash`, an edit made against another report is refused `stale-document`, and the agent told to validate the report it means to edit; an edit that grows the report past `MAX_REPORT_BYTES` is applied and answered not `ok`, and not `isError`, since it was made |
| `whoami` | report-client's `whoami()`: who the server takes the token's holder to be -- subject, tenant, roles -- and the capacities and actions the operator's role policy gives them, and whether `draft.save`, which `save_draft` needs, is among them |
| `list_templates` | the tenant's templates, each by its id with its newest draft's revision and title |
| `read_draft` | a template's newest draft: its report, its version `{ revision, digest }`, which `save_draft` takes as `from`, who saved it, and the report's hash, which `apply_commands` takes as `expectedHash`; a draft of another format, or whose report this release's validator refuses, is said as such |
| `save_draft` | a report judged first as `validate_report` judges it and sent only where that is `ok`, as the template's next draft: from `from`, the version it replaces, with `If-Match`, or with no `from` as its first, with `If-None-Match: *`; a save from a draft somebody has saved over since is refused `draft-changed`, `standing` the revision that stands, nothing written. The server's own refusals -- an id that is not the template's, an image it does not keep, a role that does not save -- come back by their codes, with what to do; it keeps no image and never publishes |
| `render_check` | the report rendered as a host renders it: report-spec's validator, the runtime's `resolveReport` with the `data`, `parameters`, `locale`, `timeZone` and `mode` given, a final render unless `preview` is asked for, and the renderer's `renderPdf`; then the PDF read back with pdfjs-dist 6.4.299, the corpus's pin, its runs joined into lines by the corpus's `pageLines` rule: `{ rendered, pages: [{ page, lines }], warnings, manifest }`, or the first refusal by its package's codes. Each image or font the report or its data names comes in `assets` as `{ asset, digest, mediaType, base64 }`, held to its digest before anything resolves. The report is held to `MAX_REPORT_BYTES`, the data to the runtime's `MAX_DETAIL_ROWS` and `MAX_STRING_LENGTH`, the PDF to `MAX_CHECK_PAGES`, 40, and the answer to `MAX_ANSWER_BYTES`, the report's own bound, refused whole past it. The PDF is never answered |

Every answer is one envelope, `{ ok, summary, data }`, as text for the
model and as structured content for the client; a refusal is `isError`,
never a thrown error, and an edit applied is never `isError`. The five tools that need nothing are annotated read-only and closed-world,
so a host may run them without asking; `whoami`, `list_templates` and
`read_draft` read-only and open-world; `save_draft` writing, never
destructively -- every revision is kept beside the ones before it -- and
not idempotently. The routes the four ask are `MCP_ROUTES`, none a
version's. What the server answered that is not its route's wire type is
said, naming the route, and never read into; what report-client throws is
said in its own sentence, a network that failed by Node's code alone, and
a save with no answer is said not known to be written. Two prompts come with the server:
`write_a_report`, which starts from `describe_format` and ends with
`validate_report` and `render_check`, and `translate_a_report`, which works from the
`word-missing` diagnostics through `addLanguage`, `translateWord` and
`translateExpression`, leaving what `validate_report` lists in
`forPerson` -- the QR-bill's message, which prints on the slip and in
the code a bank reads -- to a person, by report-core's `missingWords`,
the rule report-ai's request reads too.

## As a library

`describeFormat`, `checkReport`, `listCommands`, `applyCommands` and
`renderCheck` are the tools as plain functions from JSON to JSON, and
`whoAmI`, `listTemplates`, `readDraft` and `saveDraft` the server's, each
of a report-client; `createReportMcpServer({ client? })` is the server,
to connect to a transport of the host's, the four registered where a
client is given; `TOOL_DEFINITIONS`, `SERVER_TOOLS`, `MCP_ROUTES` and
`PROMPTS` are what a client is told and asked.
The package's declarations name the SDK's `McpServer`, whose own
declarations name the DOM's `HeadersInit`: a host that type-checks them
with `skipLibCheck` off and Node's types alone declares that one name, as
the install gate's MCP host does (`scripts/install-fixture/mcp-globals.d.ts`).

## What it does not do yet

No tool keeps an image or maps a font, so a report that declares an
image the server does not keep is refused `asset-not-kept` until a person
adds it in a builder; `save_draft` sends only what `validate_report`
answers ok, so a draft a render would refuse -- a language just added,
its words not yet written -- is a person's to save; and no tool publishes
([the roadmap](../../docs/roadmap.md)). The four have asked report-server
in the suites' process and the install gate's alone, through no
gateway or identity provider of a host's. `render_check`
answers a page's lines and not where each stands on it, nor the PDF
itself; its line reader is the corpus's rule written again, held equal
to the corpus's on the corpus's PDFs and not on every report; and a
check runs on the server's one thread, a call within every bound taking
seconds at the most rows. Through stdio a call is at most the SDK's
10 MiB -- the report, the data and every asset's base64 -- past which
the server ends without an answer: about 78,000 of the quotation's lines. The data is the runtime's envelope:
`completeness` and `consistency` beside `header` and `detail`. `describe_commands`
says each argument's shape -- a string, an object, a location -- and not
what it is for; report-core's declarations and README say which string of
`updateComponent` is the component's id. A refused batch answers the
first refusal word for word, which names what was refused but not which
of the commands it was.

## Dependencies

`@formancy/report-spec`, `@formancy/report-core`,
`@formancy/report-runtime` and `@formancy/report-render-pdf`;
`@formancy/report-client`, which the four tools ask the server through,
and `@formancy/report-server-core`, whose routes and wire types they
read; the MCP SDK,
`@modelcontextprotocol/sdk`, at exactly 1.32.2, and `zod`, its peer, at
exactly 4.6.7, both MIT. The SDK brings its HTTP transports in the same
package, so its production closure -- Express, Hono, CORS and a JSON
Schema validator among it -- is installed for a server that speaks stdio
alone; `scripts/dependency-licences.mjs` judges every package of it, all
permissive. `pdfjs-dist` at exactly 6.4.299, Apache-2.0, with
`@napi-rs/canvas`, its optional native dependency, which npm installs
for the platform where it has a build; the render check imports both,
and the renderer, with its first call. pdfjs-dist ships Liberation Sans 1
under GPL-2.0 with a font-embedding exception, which this package never
loads; the canvas is MIT by its manifest, and its builds' SBOMs list code
linked in under MPL-2.0 (cssparser 0.38.0, cssparser-color 0.6.0,
cssparser-macros 0.7.0, dtoa-short 0.3.5), the FTL (FreeType), ICU, IJG
(libjpeg-turbo), libpng-2.0 and Unicode-3.0 (unicode-ident). The owner
admitted both for this package alone on 28 November 2026, and the
licence guard holds each: the faces as never loaded, the canvas's
builds by their SBOMs' digests and the lockfile. pdfjs-dist asks for the
canvas at `^1.0.10`, so a host's own install may take a later build
nobody read. With all of it, the install was 127 third-party packages
and 194 MB on one Windows machine on 27 November 2026.
