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
 * (0089).
 * The tools need nothing but their arguments: no server, no file, no
 * network. Nothing here publishes, saves or takes an address, and no PDF
 * leaves it.
 */
export { applyCommands, checkReport, describeFormat, listCommands } from './tools.js'
export type { ToolResult, Verdict } from './tools.js'
export { MAX_ANSWER_BYTES, MAX_CHECK_PAGES, RENDER_CHECK_REFUSALS, renderCheck } from './render.js'
export type { CheckedPage, RenderCheckInput, RenderCheckRefusal } from './render.js'

export { createReportMcpServer, PACKAGE_VERSION, PROMPTS, TOOL_DEFINITIONS } from './server.js'
