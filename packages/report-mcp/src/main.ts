#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createReportMcpServer } from './server.js'

/**
 * The executable, `formancy-report-mcp`: what a client launches, speaking
 * the protocol down the process's pipes (0088).
 *
 * The composition root, and the only module that touches the process.
 * Nothing here is configured yet: the tools need nothing but their
 * arguments, so an agent can write and check a whole report before anyone
 * has deployed Report's server. stdio and no port, so nothing here listens
 * where something else could reach it. Standard output is the protocol's
 * alone; nothing here writes to it, or logs.
 */
await createReportMcpServer().connect(new StdioServerTransport(process.stdin, process.stdout))
