#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createReportMcpServer } from './server.js'
import { readSettings } from './settings.js'

/**
 * The executable, `formancy-report-mcp`: what a client launches, speaking
 * the protocol down the process's pipes (0088).
 *
 * The composition root, and the only module that touches the process: it
 * reads the environment once, here, handed to settings.ts to parse, with
 * Node's reader of files, through which a token's file is read again
 * before each request. Neither setting is a supported state, not a
 * degraded one: the tools that need nothing are the useful half, and an
 * agent can write and check a whole report before anyone has deployed
 * Report's server. Both, and the tools that ask it are registered too, as
 * the person whose token the setting names. One without the other, or a
 * setting refused, and the bin does not start: a line on standard error
 * for each problem, each naming its setting and none a value, and exit 1.
 * Standard output is the protocol's alone; nothing else is written to it,
 * and nothing is logged. stdio and no port, so nothing here listens where
 * something else could reach it.
 */
const settings = readSettings(process.env, (path) => readFile(path, 'utf8'))
if (settings.ok) {
  const server = createReportMcpServer(settings.client === undefined ? {} : { client: settings.client })
  await server.connect(new StdioServerTransport(process.stdin, process.stdout))
} else {
  process.stderr.write(`${settings.problems.join('\n')}\n`)
  process.exitCode = 1
}
