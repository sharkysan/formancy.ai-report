/**
 * @formancy/report-mcp -- Formancy Report as tools a coding agent can use,
 * over the Model Context Protocol (0088).
 *
 * Installed in a client that speaks MCP, it lets a model write and change
 * a report template against the checks that will judge it: the format
 * described, the report validated and diagnosed as a save and a render
 * judge it, and report-core's commands applied as the builders apply them.
 * The tools need nothing but their arguments: no server, no file, no
 * network. Nothing here publishes, saves or takes an address.
 */
export { applyCommands, checkReport, describeFormat, listCommands } from './tools.js'
export type { ToolResult, Verdict } from './tools.js'

export { createReportMcpServer, PACKAGE_VERSION, PROMPTS, TOOL_DEFINITIONS } from './server.js'
