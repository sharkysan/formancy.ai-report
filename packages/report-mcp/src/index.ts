/**
 * @formancy/report-mcp -- Formancy Report as tools a coding agent can use,
 * over the Model Context Protocol (0088).
 *
 * Installed in a client that speaks MCP, it lets a model write and change
 * a report template against the checks that will judge it: the format
 * described, the report validated and diagnosed as the validator and a
 * render judge it and held to a draft's size, report-core's commands
 * applied as the builders apply them, and the report rendered with the
 * data an agent passes in, what its PDF prints read back with PDF.js
 * (0089). Those tools need nothing but their arguments: no server, no
 * file, no network. Given Report's server and the person's token at their
 * host, four more ask it through report-client, as that person: who they
 * are, the tenant's templates, a template's draft, and a save from the
 * version it names, sent only once the report passes the checks. Nothing
 * here publishes or takes an address, and no PDF leaves it.
 */
export { applyCommands, checkReport, describeFormat, listCommands } from './tools.js'
export type { ToolResult, Verdict } from './tools.js'
export { MAX_ANSWER_BYTES, MAX_CHECK_PAGES, RENDER_CHECK_REFUSALS, renderCheck } from './render.js'
export type { CheckedPage, RenderCheckInput, RenderCheckRefusal } from './render.js'
export { listTemplates, MCP_ROUTES, readDraft, saveDraft, whoAmI } from './drafts.js'

export { createReportMcpServer, PACKAGE_VERSION, PROMPTS, SERVER_TOOLS, TOOL_DEFINITIONS } from './server.js'
export type { ReportMcpOptions } from './server.js'
