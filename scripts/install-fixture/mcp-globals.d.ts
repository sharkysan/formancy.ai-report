/*
 * The one name the MCP's host declares beside Node's types (0088). The
 * SDK's declarations, 1.32.2's, name the DOM's `HeadersInit`, which
 * Node's types 22 do not declare as a global though they declare the
 * `Headers` it is made from; report-mcp's own declarations name the SDK's
 * `McpServer`, which reaches it. A host that type-checks either with
 * skipLibCheck off and Node's types alone is refused that name, so this
 * host declares it, as such a host must, and nothing more: with the DOM's
 * library, a declaration of report-mcp's that named another DOM type
 * would pass here too.
 */
declare global {
  type HeadersInit = NonNullable<ConstructorParameters<typeof Headers>[0]>
}

export {}
