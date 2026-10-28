import { STATUS_CODES } from 'node:http'
import type { Socket } from 'node:net'
import { REFUSALS } from '@formancy/report-server-core'

/** The status Node's parser error asks for: its header timeout 408, a header block past its limit 431, any other request it cannot read 400. */
function statusOf(code: unknown): 400 | 408 | 431 {
  if (code === 'ERR_HTTP_REQUEST_TIMEOUT') return 408
  if (code === 'HPE_HEADER_OVERFLOW') return 431
  return 400
}

const BODY = JSON.stringify(REFUSALS['bad-request'])

/**
 * Fastify's `clientErrorHandler`: what the server writes to a connection
 * whose request Node's HTTP parser could not read -- a malformed request
 * line or header, a header block past Node's 16 KiB, headers that did not
 * arrive within Node's header timeout. Answered before any hook, so not by
 * the error handler; Fastify's own answer here is a body of its own and no
 * Cache-Control. This is the fixed `bad-request` refusal with the parser's
 * status, `no-store`, and the connection closed, as Node and Fastify close
 * it.
 *
 * Nothing is logged: Fastify's own handler traces the error, and a parser's
 * error carries the bytes the client sent in `rawPacket`, a token among them.
 */
export function answerClientError(error: Error & { code?: unknown }, socket: Socket): void {
  // Reset by the client, or already gone: nobody to answer.
  if (error.code === 'ECONNRESET' || socket.destroyed) return
  if (socket.writable) {
    const status = statusOf(error.code)
    socket.write(
      `HTTP/1.1 ${String(status)} ${String(STATUS_CODES[status])}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${String(Buffer.byteLength(BODY))}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n${BODY}`,
    )
  }
  socket.destroy()
}
