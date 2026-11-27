/*
 * The MCP's host (0088): a consumer that knows nothing about the
 * workspace, with Node's types, the packed report-mcp and what it
 * declares, and the SDK's client at the release report-mcp declares, as
 * a coding agent's client holds one -- no runtime, no renderer, no server.
 *
 * Copied into a temporary npm project by install-test.mjs, installed from
 * the packed tarballs, type-checked with skipLibCheck OFF and run under
 * Node. What is on trial: the bin the manifest names is in the tarball
 * and npm links it; a client launches it as a client launches any MCP
 * server -- by the command npm linked, through its shebang, as an ES
 * module -- and speaks to it over stdio through the SDK's own client;
 * the four tools are listed with the descriptions and annotations the
 * packed library exports; a report report-spec makes is validated with
 * the packed report-core's diagnostics; a command is applied through the
 * packed registry and session, answering the new report and its hash;
 * a stale hash is refused as isError; and the server says the version
 * the tarball carries. Nothing else checks a published bin.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { TOOL_DEFINITIONS } from '@formancy/report-mcp'
import { emptyReport, reportHash } from '@formancy/report-spec'

const installed = join('node_modules', '@formancy', 'report-mcp')
const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')) as {
  readonly version: string
  readonly bin?: Readonly<Record<string, string>>
}
const bin = manifest.bin?.['formancy-report-mcp']
if (bin === undefined || !existsSync(join(installed, bin)))
  throw new Error(`the packed report-mcp names its bin formancy-report-mcp at ${String(bin)}, which its tarball does not hold`)

interface Answer {
  readonly isError?: boolean
  readonly structuredContent?: { readonly ok?: boolean; readonly data?: Record<string, unknown> }
}

// The command npm linked, as a client's configuration names it: on Linux
// the link to dist/main.mjs, run by its shebang; the SDK's spawn finds
// npm's shim on Windows.
const client = new Client({ name: 'formancy-report-install', version: '0' })
await client.connect(new StdioClientTransport({ command: join('node_modules', '.bin', 'formancy-report-mcp'), args: [], stderr: 'pipe' }))
try {
  const version = client.getServerVersion()
  if (version?.name !== 'formancy-report' || version.version !== manifest.version)
    throw new Error(`the server said it is ${JSON.stringify(version)}, where the tarball is ${manifest.version}`)

  const { tools } = await client.listTools()
  const names = tools.map(({ name }) => name).sort()
  if (names.join() !== Object.keys(TOOL_DEFINITIONS).sort().join())
    throw new Error(`the bin lists ${names.join(', ')}, where the library exports ${Object.keys(TOOL_DEFINITIONS).join(', ')}`)
  for (const tool of tools) {
    if (tool.description !== TOOL_DEFINITIONS[tool.name as keyof typeof TOOL_DEFINITIONS])
      throw new Error(`${tool.name}'s description is not the one the library exports`)
    if (tool.annotations?.readOnlyHint !== true || tool.annotations.openWorldHint !== false)
      throw new Error(`${tool.name} does not say it changes nothing and reaches nowhere`)
  }

  const report = emptyReport('delivery-note', 'Delivery note', 'en-GB')
  const checked = (await client.callTool({ name: 'validate_report', arguments: { report } })) as Answer
  const diagnostics = checked.structuredContent?.data?.diagnostics as readonly { readonly code: string }[] | undefined
  if (checked.isError === true || checked.structuredContent?.data?.hash !== reportHash(report))
    throw new Error('validate_report did not pass an empty report with its hash')
  if (!diagnostics?.some(({ code }) => code === 'empty-body')) throw new Error('validate_report did not say that an empty report prints nothing')

  const applied = (await client.callTool({
    name: 'apply_commands',
    arguments: { report, commands: [{ command: 'setTitle', args: ['Lieferschein'] }], expectedHash: reportHash(report) },
  })) as Answer
  const changed = applied.structuredContent?.data as { readonly report?: { readonly title?: string }; readonly hash?: string } | undefined
  if (applied.isError === true || changed?.report?.title !== 'Lieferschein' || changed.hash === reportHash(report))
    throw new Error('apply_commands did not answer the new report and its hash')

  const stale = (await client.callTool({ name: 'apply_commands', arguments: { report, commands: [], expectedHash: 'sha256:00' } })) as Answer
  if (stale.isError !== true || (stale.structuredContent?.data?.refusal as { readonly code?: string } | undefined)?.code !== 'stale-document')
    throw new Error('apply_commands did not refuse a stale hash as isError')

  console.log(
    `the packed bin ${bin}, launched over stdio as ${manifest.version}: ${names.join(', ')}, each read-only; an empty report validated and a title applied, a stale hash refused`,
  )
} finally {
  await client.close()
}
