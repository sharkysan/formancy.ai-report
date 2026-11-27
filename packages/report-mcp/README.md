# @formancy/report-mcp

Formancy Report for a coding agent, over the Model Context Protocol: a
server a client launches, speaking stdio, whose tools let a model write
and change a report template against the checks that will judge it --
the format described, a report validated and diagnosed as the validator
and a render judge it and held to the size a draft may have, and
report-core's commands applied as the builders apply them. The tools need
nothing but their arguments: no server, no file, no network; the server
reads one file, its own manifest, for the version it reports. Nothing here publishes, saves, renders or takes an address, and
no input names a URL, a path or a file. Decision
[0088](../../docs/decisions/0088-an-agent-gets-reports-checks-over-the-model-context-protocol-from-a-server-of-reports-own.md)
is why, after formancy's `@formancy/mcp`
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
bin reads no setting and no environment variable, and writes nothing to
standard output but the protocol.

## The tools

| Tool | What it answers |
| --- | --- |
| `describe_format` | report-core's `reportFacts()`: the version the package reads, the regions, the component kinds, the field and parameter types, the names an expression reads in each place and the CEL type each field is read as, every diagnostic's code and severity, the bounds a report is refused past, and the notes a model gets wrong first |
| `validate_report` | report-spec's `validateReport`, whose errors a save refuses; the report's size against `MAX_REPORT_BYTES`, the UTF-8 length of its JSON, past which a save refuses it as `report-too-large`; then report-core's `diagnose`, the report's own diagnostics, whose errors refuse every render, and each declared language's, whose errors refuse a render in that language alone; with the report's `reportHash`. What a save asks of the server's own state it leaves to the server: the report's id being the template's, every image it declares kept there, and no font |
| `describe_commands` | report-core's `describeCommands()`: every command of its registry, each written as the descriptor `{ "command", "args" }` is, its arguments in the words a refusal names them in; how many one edit holds; and `PART_COMMANDS`, the commands that may change whom a payment reaches |
| `apply_commands` | a session opened on the report given, and the commands applied as one batch through the registry the builders use: the new report, its hash, its size and its diagnostics, or the refusal's code, sentence and path, nothing applied; with `expectedHash`, an edit made against another report is refused `stale-document`, and the agent told to validate the report it means to edit; an edit that grows the report past `MAX_REPORT_BYTES` is applied and answered not `ok` |

Every answer is one envelope, `{ ok, summary, data }`, as text for the
model and as structured content for the client; a refusal is `isError`,
never a thrown error. Every tool is annotated read-only and closed-world,
so a host may run it without asking. Two prompts come with the server:
`write_a_report`, which starts from `describe_format` and ends with
`validate_report`, and `translate_a_report`, which works from the
`word-missing` diagnostics through `addLanguage`, `translateWord` and
`translateExpression`.

## As a library

`describeFormat`, `checkReport`, `listCommands` and `applyCommands` are
the tools as plain functions from JSON to JSON, and
`createReportMcpServer()` is the server, to connect to a transport of
the host's; `TOOL_DEFINITIONS` and `PROMPTS` are what a client is told.
The package's declarations name the SDK's `McpServer`, whose own
declarations name the DOM's `HeadersInit`: a host that type-checks them
with `skipLibCheck` off and Node's types alone declares that one name, as
the install gate's MCP host does (`scripts/install-fixture/mcp-globals.d.ts`).

## What it does not do yet

No tool reads or saves a draft on Report's server, and none renders a
PDF; the tools that need a server, and a render check that reads the PDF
back, are planned ([the roadmap](../../docs/roadmap.md)). `describe_commands`
says each argument's shape -- a string, an object, a location -- and not
what it is for; report-core's declarations and README say which string of
`updateComponent` is the component's id. A refused batch answers the
first refusal word for word, which names what was refused but not which
of the commands it was.

## Dependencies

`@formancy/report-spec` and `@formancy/report-core`; the MCP SDK,
`@modelcontextprotocol/sdk`, at exactly 1.32.2, and `zod`, its peer, at
exactly 4.6.7, both MIT. The SDK brings its HTTP transports in the same
package, so its production closure -- Express, Hono, CORS and a JSON
Schema validator among it -- is installed for a server that speaks stdio
alone; `scripts/dependency-licences.mjs` judges every package of it, all
permissive.
