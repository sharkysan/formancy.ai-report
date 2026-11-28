/*
 * The MCP's host (0088, 0089): a consumer that knows nothing about the
 * workspace, with Node's types, the packed report-mcp and what it
 * declares -- the runtime, the renderer and PDF.js among it since its
 * render check, and the client and server-core since its server half --
 * the SDK's client at the release report-mcp declares, as a coding
 * agent's client holds one, and the packed report-server beside it, with
 * what it declares, as the server the agent's person saves to.
 *
 * Copied into a temporary npm project by install-test.mjs, installed from
 * the packed tarballs, type-checked with skipLibCheck OFF and run under
 * Node. What is on trial: the bin the manifest names is in the tarball
 * and npm links it; a client launches it as a client launches any MCP
 * server -- by the command npm linked, through its shebang, as an ES
 * module -- and speaks to it over stdio through the SDK's own client.
 * Launched with neither setting, it lists the tools that need nothing with
 * the descriptions and annotations the packed library exports; a report
 * report-spec makes is validated with the packed report-core's
 * diagnostics; a command is applied through the packed registry and
 * session, answering the new report and its hash; a stale hash is refused
 * as isError; the quotation is render-checked, its firm's mark passed as
 * base64 bytes with its digest, and its title read back from page 1 of the
 * PDF the packed renderer drew and the packed PDF.js read, no byte of the
 * PDF in the answer; and the server says the version the tarball carries.
 * Launched with one setting alone, it stops with one line and exit 1.
 * Launched with both, beside the packed server made in this process and
 * listening on a socket, it lists the four tools that ask that server
 * too, says who the token's holder is, saves a draft as them, reads it
 * back, saves it again from that version as the holder of the token the
 * file holds by then -- the file read again before each request -- and
 * has a save from the version since replaced refused draft-changed, with
 * the revision that stands. Nothing else checks a published bin. The
 * tokens are signed with node:crypto alone, as a host on any stack can
 * sign one, and their secret is this check's own.
 */
import { spawnSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SERVER_TOOLS, TOOL_DEFINITIONS } from '@formancy/report-mcp'
import { createReportServer, createReportVerifier, openFileTemplateStore } from '@formancy/report-server'
import { emptyReport, reportHash } from '@formancy/report-spec'
import { logo, quotation, quotationData } from './quotation.js'

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

/** The tools that need nothing: every tool the library exports but those that ask Report's server. */
const local = Object.keys(TOOL_DEFINITIONS)
  .filter((name) => !(SERVER_TOOLS as readonly string[]).includes(name))
  .sort()

// The command npm linked, as a client's configuration names it: on Linux
// the link to dist/main.mjs, run by its shebang; the SDK's spawn finds
// npm's shim on Windows. `env` is what the client's configuration gives
// the bin, beside the few variables the SDK hands every server.
async function launch(env: Readonly<Record<string, string>> = {}): Promise<Client> {
  const client = new Client({ name: 'formancy-report-install', version: '0' })
  await client.connect(new StdioClientTransport({ command: join('node_modules', '.bin', 'formancy-report-mcp'), args: [], env, stderr: 'pipe' }))
  return client
}

/** The bin with no setting: the tools that need nothing, each asked; what it showed, for the line the gate prints. */
async function withNoSetting(): Promise<string> {
  const client = await launch()
  try {
    const version = client.getServerVersion()
    if (version?.name !== 'formancy-report' || version.version !== manifest.version)
      throw new Error(`the server said it is ${JSON.stringify(version)}, where the tarball is ${manifest.version}`)

    const { tools } = await client.listTools()
    const names = tools.map(({ name }) => name).sort()
    if (names.join() !== local.join())
      throw new Error(`the bin with no setting lists ${names.join(', ')}, where the library's tools that need nothing are ${local.join(', ')}`)
    for (const tool of tools) {
      if (tool.description !== TOOL_DEFINITIONS[tool.name as keyof typeof TOOL_DEFINITIONS])
        throw new Error(`${tool.name}'s description is not the one the library exports`)
      if (tool.annotations?.readOnlyHint !== true || tool.annotations.openWorldHint !== false)
        throw new Error(`${tool.name} does not say it changes nothing and reaches nowhere`)
    }
    if (!SERVER_TOOLS.every((name) => client.getInstructions()?.includes(name) === true))
      throw new Error('the bin with no setting does not say which tools are missing')

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

    // The quotation, rendered by the packed renderer from the data passed in
    // and read back by the packed PDF.js: its title on page 1, as a reader
    // sees it, and nothing of the PDF itself in the answer.
    const mark = { asset: 'logo', digest: logo.digest, mediaType: 'image/svg+xml', base64: Buffer.from(logo.bytes).toString('base64') }
    const rendered = (await client.callTool({ name: 'render_check', arguments: { report: quotation, data: quotationData, assets: [mark] } })) as Answer & {
      readonly content?: readonly { readonly text?: string }[]
    }
    const pages = rendered.structuredContent?.data?.pages as readonly { readonly page: number; readonly lines: readonly string[] }[] | undefined
    if (rendered.isError === true || pages?.length !== 1 || pages[0]?.lines[0] !== 'Offerte Q-2026-0415' || !pages[0].lines.includes('Offerte'))
      throw new Error(
        `render_check did not read the quotation's title back from page 1 of its PDF: ${JSON.stringify(rendered.structuredContent).slice(0, 400)}`,
      )
    if ((rendered.content ?? []).some(({ text }) => text?.includes('%PDF') === true)) throw new Error("render_check answered the PDF's bytes")
    return `with no setting ${names.join(', ')}, each read-only, an empty report validated and a title applied, a stale hash refused, the quotation render-checked to ${String(pages.length)} page reading "${pages[0].lines[0]}"`
  } finally {
    await client.close()
  }
}
const localSaid = await withNoSetting()

// The server half: the packed server in this process, on a socket of its
// own, over a file store on a directory this check makes and removes.
const hostSecret = 'the-mcp-install-checks-own-secret-of-at-least-32-bytes'
const base64url = (text: string) => Buffer.from(text).toString('base64url')
/** An HS256 token as a host signs one, for `subject`, an author of acme for five minutes. */
function sign(subject: string): string {
  const now = Math.floor(Date.now() / 1000)
  const claims = { iss: 'https://login.example', aud: 'formancy-report', sub: subject, tid: 'acme', roles: ['report-authors'], iat: now, exp: now + 300 }
  const body = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify(claims))}`
  return `${body}.${createHmac('sha256', hostSecret).update(body).digest('base64url')}`
}

/** The bin with both settings, beside the packed server made here: the four that ask it, each asked; what it showed, for the line the gate prints. */
async function besideTheServer(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'formancy-report-mcp-install-'))
  const store = join(directory, 'store')
  const tokenFile = resolve(directory, 'token')
  await writeFile(tokenFile, `${sign('u-1')}\n`)
  await mkdir(store)
  const opened = await openFileTemplateStore(store)
  if (!opened.ok) throw new Error(opened.problem)
  const verifyIdentity = await createReportVerifier({
    key: { kind: 'secret', secret: hostSecret },
    issuer: 'https://login.example',
    audience: 'formancy-report',
    tenantClaim: 'tid',
  })
  const server = await createReportServer({
    verifyIdentity,
    roles: { author: ['report-authors'], publisher: ['report-publishers'], admin: ['report-admins'] },
    store: opened.store,
  })
  await server.listen({ host: '127.0.0.1', port: 0 })
  const at = `http://127.0.0.1:${String((server.server.address() as AddressInfo).port)}`

  try {
    // One setting alone: one line on standard error, naming both, and exit 1.
    const { FORMANCY_REPORT_TOKEN: _token, ...environment } = process.env
    const half = spawnSync(process.execPath, [join(installed, bin)], { env: { ...environment, FORMANCY_REPORT_URL: at }, input: '', encoding: 'utf8' })
    if (half.status !== 1 || !/^Set FORMANCY_REPORT_URL and FORMANCY_REPORT_TOKEN together, or neither/.test(half.stderr) || half.stdout !== '')
      throw new Error(`the bin with one setting alone exited ${String(half.status)}, saying ${JSON.stringify(half.stderr)}`)

    const agent = await launch({ FORMANCY_REPORT_URL: at, FORMANCY_REPORT_TOKEN: `file:${tokenFile}` })
    try {
      const listed = (await agent.listTools()).tools.map(({ name }) => name).sort()
      if (listed.join() !== Object.keys(TOOL_DEFINITIONS).sort().join()) throw new Error(`the bin with both settings lists ${listed.join(', ')}`)
      const call = async (name: string, args: Record<string, unknown> = {}) => (await agent.callTool({ name, arguments: args })) as Answer
      const me = (await call('whoami')).structuredContent?.data
      if (me?.['subject'] !== 'u-1' || me['tenant'] !== 'acme' || !(me['actions'] as readonly string[] | undefined)?.includes('draft.save'))
        throw new Error(`whoami answered ${JSON.stringify(me)}`)

      const note = emptyReport('delivery-note', 'Delivery note', 'en-GB')
      const first = (await call('save_draft', { template: 'delivery-note', report: note })).structuredContent?.data as
        { revision: number; digest: string } | undefined
      const read = (await call('read_draft', { template: 'delivery-note' })).structuredContent?.data
      if (first?.revision !== 1 || read?.['revision'] !== 1 || read['savedBy'] !== 'u-1' || read['hash'] !== reportHash(note))
        throw new Error(`the first save answered ${JSON.stringify(first)}, and its draft was read back as ${JSON.stringify(read)}`)

      // The host's own tool renews the token in the file; the next request carries the new one.
      await writeFile(tokenFile, `${sign('u-2')}\n`)
      const renamed = emptyReport('delivery-note', 'Lieferschein', 'en-GB')
      const second = (await call('save_draft', { template: 'delivery-note', report: renamed, from: { revision: first.revision, digest: first.digest } }))
        .structuredContent?.data as { revision: number } | undefined
      const reread = (await call('read_draft', { template: 'delivery-note' })).structuredContent?.data
      if (second?.revision !== 2 || reread?.['savedBy'] !== 'u-2')
        throw new Error(`a save from revision 1 answered ${JSON.stringify(second)}, saved by ${String(reread?.['savedBy'])}, where the token file named u-2`)

      const lost = await call('save_draft', { template: 'delivery-note', report: note, from: { revision: first.revision, digest: first.digest } })
      if (
        lost.isError !== true ||
        (lost.structuredContent?.data?.['refusal'] as { readonly code?: string } | undefined)?.code !== 'draft-changed' ||
        lost.structuredContent?.data?.['standing'] !== 2
      )
        throw new Error(`a save from the replaced revision 1 answered ${JSON.stringify(lost.structuredContent)}`)
      const templates = (await call('list_templates')).structuredContent?.data?.['templates']
      if (JSON.stringify(templates) !== JSON.stringify([{ template: 'delivery-note', revision: 2, title: 'Lieferschein' }]))
        throw new Error(`list_templates answered ${JSON.stringify(templates)}`)
      return `with both, beside the packed server on a socket, the four that ask it too, a draft saved as revision ${String(first.revision)} and again as revision ${String(second.revision)} as the holder of the token the file held by then, and a save from the replaced revision refused draft-changed with revision 2 standing`
    } finally {
      await agent.close()
    }
  } finally {
    await server.close()
    await rm(directory, { recursive: true, force: true })
  }
}
const serverSaid = await besideTheServer()

console.log(`the packed bin ${bin}, launched over stdio as ${manifest.version}: ${localSaid}; with one setting alone, refused at start; ${serverSaid}`)
